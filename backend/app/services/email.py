import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from ..config import get_settings

settings = get_settings()


def send_email(to: str, subject: str, html: str) -> bool:
    if not settings.SMTP_HOST:
        print(f"[email:disabled] to={to} subject={subject}")
        return False
    try:
        msg = MIMEMultipart("alternative")
        msg["From"] = settings.SMTP_FROM
        msg["To"] = to
        msg["Subject"] = subject
        msg.attach(MIMEText(html, "html"))
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
            if settings.SMTP_TLS:
                server.starttls()
            if settings.SMTP_USER:
                server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.sendmail(settings.SMTP_FROM, [to], msg.as_string())
        return True
    except Exception as exc:  # pragma: no cover
        print(f"[email:error] {exc}")
        return False


def send_grade_email(to: str, quiz_title: str, percent: float, passed: bool) -> bool:
    return send_email(
        to,
        f"Your {quiz_title} result is ready",
        f"<h2>EXAM FOCUS</h2><p>You scored <b>{percent:.1f}%</b> on <b>{quiz_title}</b>.</p>"
        f"<p>Result: <b>{'PASSED' if passed else 'TRY AGAIN'}</b></p>",
    )