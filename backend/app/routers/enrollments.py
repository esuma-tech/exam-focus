from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, selectinload

from ..database import get_db
from ..deps import get_current_user
from ..models import AnalyticsEvent, Course, Enrollment, Lesson, Module, User
from ..schemas import EnrollmentOut, LessonCompleteIn, Message

router = APIRouter(prefix="/enrollments", tags=["enrollments"])


def _total_lessons(db: Session, course_id: int) -> int:
    return db.query(Lesson).join(Module).filter(Module.course_id == course_id).count()


def _progress_for(db: Session, enrollment: Enrollment) -> float:
    total = _total_lessons(db, enrollment.course_id)
    if total == 0:
        return 0.0
    done = set(enrollment.completed_lesson_ids or [])
    return round(min(len(done) / total, 1.0) * 100, 1)


@router.get("/my", response_model=list[EnrollmentOut])
def my_enrollments(db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    rows = (
        db.query(Enrollment)
        .options(selectinload(Enrollment.course))
        .filter(Enrollment.user_id == current.id)
        .order_by(Enrollment.created_at.desc())
        .all()
    )
    for r in rows:
        r.progress_percent = _progress_for(db, r)
    return rows


@router.post("/{course_id}", response_model=EnrollmentOut, status_code=status.HTTP_201_CREATED)
def enroll(course_id: int, db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    if current.role not in ("learner", "parent"):
        raise HTTPException(status_code=403, detail="Only learners can enroll")
    course = db.get(Course, course_id)
    if not course or course.status != "published":
        raise HTTPException(status_code=404, detail="Course not found")
    existing = (
        db.query(Enrollment)
        .filter(Enrollment.user_id == current.id, Enrollment.course_id == course_id)
        .first()
    )
    if existing:
        raise HTTPException(status_code=409, detail="Already enrolled")
    enrollment = Enrollment(user_id=current.id, course_id=course_id, completed_lesson_ids=[])
    db.add(enrollment)
    db.add(AnalyticsEvent(event_name="course.enrolled", entity="course", entity_id=course_id, user_id=current.id))
    db.commit()
    db.refresh(enrollment)
    enrollment = (
        db.query(Enrollment)
        .options(selectinload(Enrollment.course))
        .filter(Enrollment.id == enrollment.id)
        .first()
    )
    return enrollment


@router.post("/{course_id}/lessons/complete", response_model=EnrollmentOut)
def complete_lesson(
    course_id: int,
    payload: LessonCompleteIn,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    enrollment = (
        db.query(Enrollment)
        .filter(Enrollment.user_id == current.id, Enrollment.course_id == course_id)
        .first()
    )
    if not enrollment:
        raise HTTPException(status_code=404, detail="Not enrolled in this course")

    lesson = db.get(Lesson, payload.lesson_id)
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")

    done = list(enrollment.completed_lesson_ids or [])
    if payload.lesson_id not in done:
        done.append(payload.lesson_id)
    enrollment.completed_lesson_ids = done
    enrollment.progress_percent = _progress_for(db, enrollment)
    db.add(AnalyticsEvent(event_name="lesson.completed", entity="lesson", entity_id=payload.lesson_id, user_id=current.id))
    db.commit()
    enrollment = (
        db.query(Enrollment)
        .options(selectinload(Enrollment.course))
        .filter(Enrollment.id == enrollment.id)
        .first()
    )
    return enrollment


@router.delete("/{course_id}", response_model=Message)
def unenroll(course_id: int, db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    enrollment = (
        db.query(Enrollment)
        .filter(Enrollment.user_id == current.id, Enrollment.course_id == course_id)
        .first()
    )
    if not enrollment:
        raise HTTPException(status_code=404, detail="Not enrolled")
    db.delete(enrollment)
    db.commit()
    return Message(message="Unenrolled")