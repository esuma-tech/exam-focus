"""Bootstraps a fresh database with the single administrator account and the
school profile. No demo users or demo content are created — all other accounts
and content must be added and approved by the administrator."""

from sqlalchemy.orm import Session

from .database import SessionLocal, Base, engine
from .models import SchoolProfile, User
from .security import hash_password

ADMIN_EMAIL = "esuman82@gmail.com"
ADMIN_PASSWORD = "Bro@1005"


def _has_data(db: Session) -> bool:
    return db.query(User).first() is not None


def seed_all() -> None:
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        if _has_data(db):
            return

        profile = SchoolProfile(
            name="EXAM FOCUS",
            tagline="Focused Preparation. Real Results.",
            mission=("To give Grade 9–12 students affordable, structured, teacher-led online classes and exam "
                     "preparation."),
            about="EXAM FOCUS is an online teaching and learning platform serving Grade 9–12 students.",
            address="",
            phone="",
            email=ADMIN_EMAIL,
        )
        db.add(profile)

        admin = User(
            email=ADMIN_EMAIL,
            full_name="Administrator",
            role="admin",
            password_hash=hash_password(ADMIN_PASSWORD),
            is_active=True,
            is_approved=True,
        )
        db.add(admin)

        db.commit()
        print("Fresh database created. Single admin account:")
        print(f"  admin:  {ADMIN_EMAIL} / {ADMIN_PASSWORD}")
    finally:
        db.close()


if __name__ == "__main__":
    seed_all()