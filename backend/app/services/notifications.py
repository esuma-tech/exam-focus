from sqlalchemy.orm import Session

from ..models import Notification, User
from .email import send_grade_email
from .sms import send_sms


def create_notification(
    db: Session,
    user_id: int,
    title: str,
    body: str = "",
    kind: str = "info",
    channel: str = "in_app",
) -> Notification:
    notif = Notification(user_id=user_id, title=title, body=body, kind=kind, channel=channel)
    db.add(notif)
    db.commit()
    db.refresh(notif)

    user = db.get(User, user_id)
    if user:
        if channel in ("email", "both") and user.email:
            send_grade_email(user.email, title, 0.0, False)  # generic email stub
        if channel in ("sms", "both") and user.phone:
            send_sms(user.phone, body or title)
    return notif


def notify_quiz_result(db: Session, user: User, quiz_title: str, percent: float, passed: bool):
    notif = Notification(
        user_id=user.id,
        kind="quiz",
        title=f"Quiz result: {quiz_title}",
        body=f"You scored {percent:.1f}%. {'Passed!' if passed else 'Keep practicing.'}",
    )
    db.add(notif)
    db.commit()
    db.refresh(notif)
    if user.email:
        send_grade_email(user.email, quiz_title, percent, passed)
    return notif