import mimetypes
import uuid
from io import BytesIO
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from ..config import get_settings
from ..database import get_db
from ..deps import admin_only, get_current_user
from ..models import (
    AnalyticsEvent,
    Certificate,
    ForumComment,
    ForumPost,
    LiveClass,
    Notification,
    User,
)
from ..schemas import Message, UserOut, UserUpdate
from ..security import hash_password
from ..services import storage

router = APIRouter(prefix="/users", tags=["users"])
settings = get_settings()


def _delete_user_contents(db: Session, user: User) -> None:
    """Remove rows that reference a user but aren't covered by an ORM cascade
    before the user row itself is deleted (reject / delete account)."""
    db.query(ForumComment).filter(ForumComment.author_id == user.id).delete(
        synchronize_session=False
    )
    own_post_ids = select(ForumPost.id).where(ForumPost.author_id == user.id)
    db.query(ForumComment).filter(ForumComment.post_id.in_(own_post_ids)).delete(
        synchronize_session=False
    )
    db.query(ForumPost).filter(ForumPost.author_id == user.id).delete(synchronize_session=False)
    db.query(LiveClass).filter(LiveClass.instructor_id == user.id).delete(synchronize_session=False)
    db.query(Certificate).filter(
        or_(Certificate.student_id == user.id, Certificate.issued_by == user.id)
    ).delete(synchronize_session=False)
    db.query(AnalyticsEvent).filter(AnalyticsEvent.user_id == user.id).delete(
        synchronize_session=False
    )
    for course in list(user.courses_taught):
        db.query(LiveClass).filter(LiveClass.course_id == course.id).delete(synchronize_session=False)
        db.delete(course)


@router.get("", response_model=list[UserOut])
def list_users(
    role: str | None = None,
    search: str | None = None,
    _: User = Depends(admin_only),
    db: Session = Depends(get_db),
):
    q = db.query(User)
    if role:
        q = q.filter(User.role == role)
    if search:
        like = f"%{search}%"
        q = q.filter(User.email.like(like) | User.full_name.like(like))
    return q.order_by(User.created_at.desc()).limit(500).all()


@router.get("/instructors", response_model=list[UserOut])
def list_instructors(db: Session = Depends(get_db)):
    return db.query(User).filter(User.role == "instructor", User.is_active == True).all()


@router.get("/{user_id}/receipt")
def download_receipt(
    user_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(admin_only),
):
    """Stream a learner's registration receipt for admins. The file may live
    in object storage (S3) or on local disk (dev fallback), never exposed
    publicly to non-admins."""
    user = db.get(User, user_id)
    if not user or not user.receipt_url:
        raise HTTPException(status_code=404, detail="No receipt attached")
    filename = Path(user.receipt_url).name
    content_type = mimetypes.guess_type(filename)[0] or "application/octet-stream"
    headers = {
        "X-Content-Type-Options": "nosniff",
        "Content-Disposition": f'inline; filename="{filename}"',
    }

    key = storage.key_from_url(user.receipt_url)
    if key:
        body, ct = storage.read_object(key)
        headers["Content-Type"] = ct
        return StreamingResponse(body, headers=headers, media_type=ct)

    local = Path(settings.UPLOAD_DIR).resolve() / filename
    if not local.exists():
        raise HTTPException(status_code=404, detail="Receipt file missing")
    return FileResponse(local, media_type=content_type, headers=headers)


_AVATAR_EXTS = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg"}
_MAX_AVATAR = 8 * 1024 * 1024


@router.post("/me/avatar")
def upload_avatar(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    """Upload a profile photo (used on the student ID card)."""
    ext = Path(file.filename or "").suffix.lower()
    if ext not in _AVATAR_EXTS:
        raise HTTPException(status_code=400, detail="Image type not allowed")
    buf = BytesIO()
    size = 0
    while chunk := file.file.read(1024 * 1024):
        size += len(chunk)
        if size > _MAX_AVATAR:
            raise HTTPException(status_code=413, detail="Image too large (max 8 MB)")
        buf.write(chunk)
    buf.seek(0)

    settings = get_settings()
    if storage.storage_enabled():
        key = f"avatars/{uuid.uuid4().hex[:20]}{ext}"
        content_type = mimetypes.guess_type(file.filename or "")[0] or "application/octet-stream"
        url = storage.put_object(key, buf, content_type)
    else:
        upload_dir = Path(settings.UPLOAD_DIR).resolve()
        upload_dir.mkdir(parents=True, exist_ok=True)
        filename = f"{uuid.uuid4().hex[:16]}{ext}"
        with (upload_dir / filename).open("wb") as out:
            buf.seek(0)
            out.write(buf.read())
        url = f"{settings.API_PREFIX}/uploads/{filename}"

    current.avatar = url
    db.commit()
    db.refresh(current)

    # A student's ID card is generated automatically the moment they upload a
    # profile photo, so every student with a picture has an ID card to download.
    if current.role == "learner":
        existing = (
            db.query(Certificate)
            .filter(Certificate.student_id == current.id, Certificate.kind == "id_card")
            .first()
        )
        if not existing:
            db.add(
                Certificate(
                    kind="id_card",
                    course_title="",
                    student_id=current.id,
                    issued_by=current.id,
                )
            )
            db.add(
                AnalyticsEvent(
                    event_name="id_card.generated",
                    entity="certificate",
                    entity_id=current.id,
                    user_id=current.id,
                    meta={"kind": "id_card", "trigger": "avatar_upload"},
                )
            )
            db.commit()
            db.refresh(current)

    return {"avatar": url}


@router.post("/{user_id}/approve", response_model=UserOut)
def approve_user(user_id: int, db: Session = Depends(get_db), _: User = Depends(admin_only)):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.is_approved = True
    user.is_active = True
    db.add(AnalyticsEvent(event_name="user.approved", entity="user", entity_id=user.id, user_id=user.id))
    db.commit()
    db.refresh(user)
    return user


@router.post("/{user_id}/reject", response_model=Message)
def reject_user(user_id: int, db: Session = Depends(get_db), _: User = Depends(admin_only)):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.role == "admin":
        raise HTTPException(status_code=400, detail="Cannot reject an admin account")
    _delete_user_contents(db, user)
    db.delete(user)
    db.commit()
    return Message(message="Registration rejected and account removed")


@router.get("/{user_id}", response_model=UserOut)
def get_user(user_id: int, db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    if current.role == "learner" and current.id != user_id:
        raise HTTPException(status_code=403, detail="Forbidden")
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.patch("/{user_id}", response_model=UserOut)
def update_user(
    user_id: int,
    payload: UserUpdate,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    if current.role != "admin" and current.id != user_id:
        raise HTTPException(status_code=403, detail="Forbidden")
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    data = payload.model_dump(exclude_unset=True)
    password = data.pop("password", None)
    # Only admins can change roles / disable accounts.
    if current.role != "admin":
        data.pop("role", None)
        data.pop("is_active", None)
    if "email" in data:
        new_email = data.pop("email").lower()
        duplicate = db.query(User).filter(User.email == new_email, User.id != user_id).first()
        if duplicate:
            raise HTTPException(status_code=409, detail="An account with this email already exists")
        user.email = new_email
    if password:
        user.password_hash = hash_password(password)
    for key, value in data.items():
        setattr(user, key, value)
    db.commit()
    db.refresh(user)
    return user


@router.delete("/{user_id}", response_model=Message)
def delete_user(user_id: int, db: Session = Depends(get_db), _: User = Depends(admin_only)):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.role == "admin":
        raise HTTPException(status_code=400, detail="Cannot delete an admin account")
    _delete_user_contents(db, user)
    db.delete(user)
    db.commit()
    return Message(message="User deleted")