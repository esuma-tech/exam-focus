from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import admin_only, get_current_user
from ..models import Notification, User
from ..schemas import NotificationCreate, NotificationOut
from ..services.notifications import create_notification

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("", response_model=list[NotificationOut])
def my_notifications(include_read: bool = False, db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    q = db.query(Notification).filter(Notification.user_id == current.id)
    if not include_read:
        q = q.filter(Notification.is_read == False)
    return q.order_by(Notification.created_at.desc()).limit(100).all()


@router.get("/unread-count", response_model=dict)
def unread_count(db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    count = (
        db.query(Notification)
        .filter(Notification.user_id == current.id, Notification.is_read == False)
        .count()
    )
    return {"count": count}


@router.post("/{notif_id}/read", response_model=NotificationOut)
def mark_read(notif_id: int, db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    notif = db.get(Notification, notif_id)
    if not notif:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Notification not found")
    notif.is_read = True
    db.commit()
    db.refresh(notif)
    return notif


@router.post("/read-all", response_model=dict)
def mark_all_read(db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    db.query(Notification).filter(Notification.user_id == current.id, Notification.is_read == False).update(
        {"is_read": True}
    )
    db.commit()
    return {"message": "All read"}


@router.post("/broadcast", response_model=list[NotificationOut], status_code=status.HTTP_201_CREATED)
def broadcast(payload: NotificationCreate, db: Session = Depends(get_db), _: User = Depends(admin_only)):
    created = []
    if payload.user_id == 0:
        users = db.query(User).filter(User.is_active == True).all()
        for u in users:
            created.append(create_notification(db, u.id, payload.title, payload.body, payload.kind, payload.channel))
    else:
        created.append(create_notification(db, payload.user_id, payload.title, payload.body, payload.kind, payload.channel))
    return created