import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..config import get_settings
from ..database import get_db
from ..deps import get_current_user, instructor_or_admin
from ..models import Course, Enrollment, LiveClass, User
from ..schemas import LiveClassIn, LiveClassOut, LiveClassUpdate, LiveJoinIn, Message
from ..services.notifications import create_notification
from ..services.sms import send_sms

router = APIRouter(prefix="/live", tags=["live-classes"])
settings = get_settings()

UNIQUE_KEYS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"


def _gen_key(db: Session) -> str:
    for _ in range(50):
        key = "".join(secrets.choice(UNIQUE_KEYS) for _ in range(6))
        if not db.query(LiveClass).filter(LiveClass.invite_key == key).first():
            return key
    raise HTTPException(status_code=500, detail="Could not generate a unique class key")


def _build_meeting_url(live: LiveClass) -> str:
    if live.provider.lower() == "jitsi":
        room = f"examfocus-{live.id}-{live.title.strip().replace(' ', '-')[:40].lower()}"
        return f"https://{settings.LIVE_JITSI_DOMAIN}/{room}"
    if live.provider.lower() == "meet":
        return f"https://meet.google.com/?examfocus={live.id}"
    return live.meeting_url or ""


def _managed_live(db: Session, live_id: int, user: User) -> LiveClass:
    live = db.get(LiveClass, live_id)
    if not live:
        raise HTTPException(status_code=404, detail="Live class not found")
    if user.role != "admin" and live.instructor_id != user.id:
        raise HTTPException(status_code=403, detail="Not your live class")
    return live


@router.get("", response_model=list[LiveClassOut])
def list_live(course_id: int | None = None, upcoming: bool = False, db: Session = Depends(get_db),
              current: User = Depends(get_current_user)):
    now = datetime.now(timezone.utc)
    q = db.query(LiveClass)
    if course_id:
        q = q.filter(LiveClass.course_id == course_id)
    if current.role == "learner":
        enrolled_courses = [e.course_id for e in db.query(Enrollment).filter(Enrollment.user_id == current.id).all()]
        q = q.filter(LiveClass.course_id.in_(enrolled_courses))
    if upcoming:
        q = q.filter(LiveClass.scheduled_at >= now - timedelta(hours=2))
    return q.order_by(LiveClass.scheduled_at.asc()).all()


@router.post("", response_model=LiveClassOut, status_code=status.HTTP_201_CREATED)
def create_live_class(
    payload: LiveClassIn,
    db: Session = Depends(get_db),
    current: User = Depends(instructor_or_admin),
):
    course = db.get(Course, payload.course_id)
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    if current.role != "admin" and course.instructor_id != current.id:
        raise HTTPException(status_code=403, detail="Not your course")

    live = LiveClass(
        title=payload.title,
        description=payload.description,
        provider=payload.provider,
        scheduled_at=payload.scheduled_at,
        duration_min=payload.duration_min,
        course_id=payload.course_id,
        instructor_id=current.id,
        invite_key=_gen_key(db),
    )
    db.add(live)
    db.flush()
    live.meeting_url = _build_meeting_url(live)
    db.commit()
    db.refresh(live)

    # Notify enrolled learners + SMS reminder to the class.
    for e in db.query(Enrollment).filter(Enrollment.course_id == course.id).all():
        create_notification(db, e.user_id, "New live class scheduled",
                            f"{live.title} on {live.scheduled_at:%Y-%m-%d %H:%M}. Join: {live.meeting_url}",
                            kind="course")
        if e.user.phone:
            send_sms(e.user.phone, f"EXAM FOCUS: Live class '{live.title}' {live.scheduled_at:%d/%m %H:%M}. {live.meeting_url}")
    return live


@router.patch("/{live_id}", response_model=LiveClassOut)
def update_live(
    live_id: int,
    payload: LiveClassUpdate,
    db: Session = Depends(get_db),
    current: User = Depends(instructor_or_admin),
):
    live = _managed_live(db, live_id, current)
    data = payload.model_dump(exclude_unset=True)
    for key, value in data.items():
        setattr(live, key, value)
    db.commit()
    db.refresh(live)
    return live


@router.post("/join", response_model=LiveClassOut)
def join_live(payload: LiveJoinIn, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    key = payload.code.strip().upper()
    live = db.query(LiveClass).filter(LiveClass.invite_key == key).first()
    if not live or live.status == "cancelled":
        raise HTTPException(status_code=404, detail="No live class found for that join key")
    return live


@router.delete("/{live_id}", response_model=Message)
def delete_live(live_id: int, db: Session = Depends(get_db), current: User = Depends(instructor_or_admin)):
    live = _managed_live(db, live_id, current)
    db.delete(live)
    db.commit()
    return Message(message="Live class deleted")