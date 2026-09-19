import random

from sqlalchemy.orm import Session

from ..models import User


def generate_student_id(db: Session) -> str:
    """Return a 6-digit student ID that is not currently used by another user."""
    while True:
        candidate = f"{random.randint(0, 999999):06d}"
        if not db.query(User).filter(User.student_id == candidate).first():
            return candidate