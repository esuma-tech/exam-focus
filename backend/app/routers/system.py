from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..config import get_settings
from ..database import get_db
from ..deps import admin_only
from ..models import Course, SchoolProfile, User
from ..schemas import HealthOut, Message, SchoolProfileIn, SchoolProfileOut

router = APIRouter(tags=["system"])
settings = get_settings()


def _profile(db: Session) -> SchoolProfile:
    profile = db.query(SchoolProfile).first()
    if not profile:
        profile = SchoolProfile()
        db.add(profile)
        db.commit()
        db.refresh(profile)
    return profile


@router.get("/health", response_model=HealthOut)
def health():
    return HealthOut(status="ok", app=settings.APP_NAME, version=settings.VERSION, environment=settings.ENVIRONMENT)


@router.get("/public", response_model=dict)
def public_info(db: Session = Depends(get_db)):
    profile = _profile(db)
    featured = (
        db.query(Course)
        .filter(Course.status == "published", Course.is_featured == True)
        .order_by(Course.created_at.desc())
        .limit(6)
        .all()
    )
    subject_counts = {}
    for c in db.query(Course).filter(Course.status == "published").all():
        subject_counts[c.subject] = subject_counts.get(c.subject, 0) + 1
    return {
        "school": SchoolProfileOut.model_validate(profile),
        "featured_courses": [
            {
                "id": c.id, "title": c.title, "subtitle": c.subtitle, "subject": c.subject,
                "grade": c.grade, "thumbnail": c.thumbnail, "price_etb": c.price_etb,
                "difficulty": c.difficulty, "instructor": c.instructor.full_name,
            }
            for c in featured
        ],
        "subject_counts": subject_counts,
        "stats": {
            "courses": db.query(Course).filter(Course.status == "published").count(),
            "learners": db.query(User).filter(User.role == "learner").count(),
            "instructors": db.query(User).filter(User.role == "instructor").count(),
        },
    }


@router.get("/school", response_model=SchoolProfileOut)
def get_school(db: Session = Depends(get_db)):
    return _profile(db)


@router.put("/school", response_model=SchoolProfileOut)
def update_school(payload: SchoolProfileIn, db: Session = Depends(get_db), _: User = Depends(admin_only)):
    profile = _profile(db)
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(profile, key, value)
    db.commit()
    db.refresh(profile)
    return profile


@router.patch("/school", response_model=SchoolProfileOut)
def patch_school(payload: SchoolProfileIn, db: Session = Depends(get_db), _: User = Depends(admin_only)):
    return update_school(payload, db, _)


@router.post("/reset", response_model=Message)
def reset_system(db: Session = Depends(get_db), _: User = Depends(admin_only)):
    """Factory reset: drops all tables and re-creates the admin account and the
    default school profile. All users and content are permanently deleted."""
    from ..seed import seed_all
    from ..database import Base, engine
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    seed_all()
    return Message(message="System reset complete: only the admin account and default profile remain")