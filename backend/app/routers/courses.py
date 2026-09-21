import hashlib
import hmac
import mimetypes
import re
import time
from pathlib import Path

from fastapi import APIRouter, Depends, Header, HTTPException
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy.orm import Session, selectinload

from ..config import get_settings
from ..database import get_db
from ..deps import get_current_user, get_optional_user, instructor_or_admin
from ..models import AnalyticsEvent, Course, Enrollment, Lesson, LiveClass, Module, User
from ..schemas import (
    CourseDetail,
    CourseIn,
    CourseOut,
    CourseUpdate,
    LessonOut,
    LessonUpdate,
    Message,
    ModuleIn,
    ModuleOut,
    ModuleUpdate,
)
from ..security import hash_password
from ..services import storage

router = APIRouter(prefix="/courses", tags=["courses"])

settings = get_settings()

MEDIA_TOKEN_TTL = 12 * 3600  # signed lesson media links stay valid for 12 hours


def _is_real_media_url(value: str) -> bool:
    """True when the stored value points at real content (S3 key or local
    upload), not at a backend signed-media path returned to clients."""
    if not value:
        return False
    s3_prefix = settings.AWS_ENDPOINT_URL_S3
    return (
        bool(s3_prefix) and value.startswith(s3_prefix)
    ) or value.startswith(f"{settings.API_PREFIX}/uploads/")


def _media_sig(lesson_id: int, kind: str, exp: int) -> str:
    msg = f"{lesson_id}:{kind}:{exp}".encode()
    return hmac.new(settings.SECRET_KEY.encode(), msg, hashlib.sha256).hexdigest()


def _verify_media_sig(lesson_id: int, kind: str, exp: int | None, sig: str) -> None:
    if not exp or time.time() > exp:
        raise HTTPException(status_code=403, detail="Media link has expired")
    expected = _media_sig(lesson_id, kind, exp)
    if not sig or not hmac.compare_digest(sig, expected):
        raise HTTPException(status_code=403, detail="Invalid media link")


def _media_url(lesson_id: int, course_id: int, kind: str) -> str:
    exp = int(time.time()) + MEDIA_TOKEN_TTL
    sig = _media_sig(lesson_id, kind, exp)
    return (
        f"{settings.API_PREFIX}/courses/{course_id}/lessons/{lesson_id}/media"
        f"?kind={kind}&exp={exp}&sig={sig}"
    )


def _authorized_for_content(db: Session, current: User, course_id: int) -> bool:
    if current.role == "admin":
        return True
    course = db.get(Course, course_id)
    if not course:
        return False
    if current.role == "instructor" and course.instructor_id == current.id:
        return True
    if current.role == "learner":
        seeded = (
            db.query(Enrollment)
            .filter(Enrollment.user_id == current.id, Enrollment.course_id == course_id)
            .first()
        )
        return seeded is not None
    return False


def _apply_lesson_media(lesson: Lesson, course: Course, db: Session, current: User | None) -> None:
    """Mask lesson media before serialization: enrolled learners get signed,
    expiring backend links; everyone else gets no direct storage URL."""
    is_owner = current is not None and (
        current.role == "admin"
        or (current.role == "instructor" and course.instructor_id == current.id)
    )
    if is_owner:
        return  # teachers/admins manage the real files
    if current is not None and _authorized_for_content(db, current, course.id):
        if lesson.video_url:
            lesson.video_url = _media_url(lesson.id, course.id, "video")
        if lesson.attachment_url:
            lesson.attachment_url = _media_url(lesson.id, course.id, "file")
    else:
        lesson.video_url = ""
        lesson.attachment_url = ""


def _owned_course(course_id: int, db: Session, current: User) -> Course:
    course = db.get(Course, course_id)
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    if current.role != "admin" and course.instructor_id != current.id:
        raise HTTPException(status_code=403, detail="You can only edit your own courses")
    return course


def _course_with_children(course: Course, db: Session, current: User | None = None) -> CourseDetail:
    detail = CourseDetail.model_validate(course)
    detail.enrollment_count = len(course.enrollments)
    detail.instructor = course.instructor
    for mod in course.modules:
        for lesson in mod.lessons:
            _apply_lesson_media(lesson, course, db, current)
    detail.modules = course.modules
    return detail


@router.get("", response_model=list[CourseOut])
def list_courses(
    status_filter: str | None = None,
    subject: str | None = None,
    grade: str | None = None,
    featured: bool | None = None,
    public: bool = True,
    db: Session = Depends(get_db),
    current: User | None = Depends(get_optional_user),
):
    q = db.query(Course).options(selectinload(Course.instructor))
    if public and (current is None or current.role == "learner"):
        q = q.filter(Course.status == "published")
    elif status_filter:
        q = q.filter(Course.status == status_filter)
    if subject:
        q = q.filter(Course.subject == subject)
    if grade:
        q = q.filter(Course.grade == grade)
    if featured is not None:
        q = q.filter(Course.is_featured == featured)
    return q.order_by(Course.created_at.desc()).all()


@router.get("/subjects", response_model=list[str])
def list_subjects(db: Session = Depends(get_db)):
    rows = db.query(Course.subject).distinct().all()
    return sorted({r[0] for r in rows if r[0]})


@router.get("/{course_id}", response_model=CourseDetail)
def get_course(
    course_id: int,
    db: Session = Depends(get_db),
    current: User | None = Depends(get_optional_user),
):
    course = (
        db.query(Course)
        .options(selectinload(Course.instructor), selectinload(Course.modules).selectinload(Module.lessons))
        .filter(Course.id == course_id)
        .first()
    )
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    return _course_with_children(course, db, current)


@router.post("", response_model=CourseDetail, status_code=201)
def create_course(
    payload: CourseIn,
    db: Session = Depends(get_db),
    current: User = Depends(instructor_or_admin),
):
    course = Course(
        title=payload.title,
        subtitle=payload.subtitle,
        description=payload.description,
        subject=payload.subject,
        grade=payload.grade,
        thumbnail=payload.thumbnail,
        price_etb=payload.price_etb,
        difficulty=payload.difficulty,
        status=payload.status,
        is_featured=payload.is_featured,
        instructor_id=current.id,
    )
    db.add(course)
    db.flush()

    for mi, mod_data in enumerate(payload.modules):
        mod = Module(title=mod_data.title, description=mod_data.description, position=mod_data.position or mi, course_id=course.id)
        db.add(mod)
        db.flush()
        for li, les_data in enumerate(mod_data.lessons):
            db.add(Lesson(
                title=les_data.title,
                summary=les_data.summary,
                content=les_data.content,
                video_url=les_data.video_url,
                attachment_url=les_data.attachment_url,
                duration_min=les_data.duration_min,
                position=les_data.position or li,
                module_id=mod.id,
            ))

    db.add(AnalyticsEvent(event_name="course.created", entity="course", entity_id=course.id, user_id=current.id))
    db.commit()
    course = (
        db.query(Course)
        .options(selectinload(Course.instructor), selectinload(Course.modules).selectinload(Module.lessons))
        .filter(Course.id == course.id)
        .first()
    )
    return _course_with_children(course, db, current)


@router.patch("/{course_id}", response_model=CourseDetail)
def update_course(
    course_id: int,
    payload: CourseUpdate,
    db: Session = Depends(get_db),
    current: User = Depends(instructor_or_admin),
):
    course = db.get(Course, course_id)
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    if current.role != "admin" and course.instructor_id != current.id:
        raise HTTPException(status_code=403, detail="You can only edit your own courses")
    data = payload.model_dump(exclude_unset=True)
    if current.role != "admin":
        data.pop("is_featured", None)
    for key, value in data.items():
        setattr(course, key, value)
    db.commit()
    course = (
        db.query(Course)
        .options(selectinload(Course.instructor), selectinload(Course.modules).selectinload(Module.lessons))
        .filter(Course.id == course.id)
        .first()
    )
    return _course_with_children(course, db, current)


@router.delete("/{course_id}", response_model=Message)
def delete_course(course_id: int, db: Session = Depends(get_db), current: User = Depends(instructor_or_admin)):
    course = db.get(Course, course_id)
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    if current.role != "admin" and course.instructor_id != current.id:
        raise HTTPException(status_code=403, detail="You can only delete your own courses")
    # Live classes reference the course without a cascade rule, so remove them
    # first; other children (modules, lessons, enrollments, quizzes, forums)
    # are removed by the ORM cascade.
    db.query(LiveClass).filter(LiveClass.course_id == course_id).delete()
    db.delete(course)
    db.commit()
    return Message(message="Course deleted")


@router.post("/{course_id}/modules", response_model=CourseDetail, status_code=201)
def add_module(
    course_id: int,
    payload: ModuleIn,
    db: Session = Depends(get_db),
    current: User = Depends(instructor_or_admin),
):
    course = db.get(Course, course_id)
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    mod = Module(title=payload.title, description=payload.description, position=payload.position, course_id=course.id)
    db.add(mod)
    db.flush()
    for li, les_data in enumerate(payload.lessons):
        db.add(Lesson(
            title=les_data.title, summary=les_data.summary, content=les_data.content,
            video_url=les_data.video_url, attachment_url=les_data.attachment_url,
            duration_min=les_data.duration_min, position=les_data.position or li, module_id=mod.id,
        ))
    db.commit()
    return get_course(course_id, db, current)


@router.patch("/{course_id}/modules/{module_id}", response_model=ModuleOut)
def update_module(
    course_id: int,
    module_id: int,
    payload: ModuleUpdate,
    db: Session = Depends(get_db),
    current: User = Depends(instructor_or_admin),
):
    _owned_course(course_id, db, current)
    mod = db.get(Module, module_id)
    if not mod or mod.course_id != course_id:
        raise HTTPException(status_code=404, detail="Module not found")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(mod, key, value)
    db.commit()
    db.refresh(mod)
    return mod


@router.delete("/{course_id}/modules/{module_id}", response_model=Message)
def delete_module(
    course_id: int,
    module_id: int,
    db: Session = Depends(get_db),
    current: User = Depends(instructor_or_admin),
):
    _owned_course(course_id, db, current)
    mod = db.get(Module, module_id)
    if not mod or mod.course_id != course_id:
        raise HTTPException(status_code=404, detail="Module not found")
    for lesson in mod.lessons:
        storage.delete_by_url(lesson.video_url)
        storage.delete_by_url(lesson.attachment_url)
    db.delete(mod)
    db.commit()
    return Message(message="Module deleted")


@router.patch("/{course_id}/lessons/{lesson_id}", response_model=LessonOut)
def update_lesson(
    course_id: int,
    lesson_id: int,
    payload: LessonUpdate,
    db: Session = Depends(get_db),
    current: User = Depends(instructor_or_admin),
):
    _owned_course(course_id, db, current)
    lesson = db.get(Lesson, lesson_id)
    if not lesson or lesson.module.course_id != course_id:
        raise HTTPException(status_code=404, detail="Lesson not found")
    data = payload.model_dump(exclude_unset=True)
    # Ignore masked backend links if they are ever echoed back; only accept
    # genuine storage URLs for video/attachments.
    for field in ("video_url", "attachment_url"):
        if field in data and not _is_real_media_url(data[field]):
            data.pop(field, None)
    if "video_url" in data:
        storage.delete_by_url(lesson.video_url)
    if "attachment_url" in data:
        storage.delete_by_url(lesson.attachment_url)
    for key, value in data.items():
        setattr(lesson, key, value)
    db.commit()
    db.refresh(lesson)
    course = db.get(Course, course_id)
    _apply_lesson_media(lesson, course, db, current)
    return lesson


@router.delete("/{course_id}/lessons/{lesson_id}", response_model=Message)
def delete_lesson(
    course_id: int,
    lesson_id: int,
    db: Session = Depends(get_db),
    current: User = Depends(instructor_or_admin),
):
    _owned_course(course_id, db, current)
    lesson = db.get(Lesson, lesson_id)
    if not lesson or lesson.module.course_id != course_id:
        raise HTTPException(status_code=404, detail="Lesson not found")
    storage.delete_by_url(lesson.video_url)
    storage.delete_by_url(lesson.attachment_url)
    db.delete(lesson)
    db.commit()
    return Message(message="Lesson deleted")


def _parse_range(range_header: str | None, size: int) -> tuple[int | None, int | None]:
    """Return (start, end) for a bytes range, or (None, None) for the whole file."""
    m = re.match(r"^bytes=(\d*)-(\d*)$", range_header or "")
    if not m:
        return None, None
    start_s, end_s = m.groups()
    if start_s == "" and end_s == "":
        return None, None
    if start_s == "":
        start = max(size - int(end_s), 0)
        end = size - 1
    else:
        start = int(start_s)
        end = min(int(end_s), size - 1) if end_s else size - 1
    if start >= size or end < start:
        return None, None
    return start, end


# Some upload pipelines store .docx/.doc/.pdf objects as application/octet-stream,
# which makes browsers download instead of stream; map common extensions back.
_EXT_CONTENT_TYPES = {
    ".pdf": "application/pdf",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".doc": "application/msword",
    ".xls": "application/vnd.ms-excel",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".ppt": "application/vnd.ms-powerpoint",
    ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ".txt": "text/plain; charset=utf-8",
}


def _content_type(key_or_url: str, stored: str | None) -> str:
    guessed = mimetypes.guess_type(key_or_url)[0] or stored or ""
    if guessed and "text/plain" not in guessed and "application/octet-stream" not in guessed:
        return guessed
    suffix = Path(key_or_url).suffix.lower()
    return _EXT_CONTENT_TYPES.get(suffix) or guessed or "application/octet-stream"


def _stream_s3(key: str, range_header: str | None, inline_name: str | None = None) -> StreamingResponse:
    client = storage._client()
    head = client.head_object(Bucket=settings.STORAGE_BUCKET, Key=key)
    size = int(head["ContentLength"])
    content_type = _content_type(key, head.get("ContentType"))

    headers = {
        "Accept-Ranges": "bytes",
        "Content-Type": content_type,
        "X-Content-Type-Options": "nosniff",
    }
    if inline_name:
        headers["Content-Disposition"] = f'inline; filename="{inline_name}"'
    start, end = _parse_range(range_header, size)
    if range_header and start is None:
        raise HTTPException(
            status_code=416,
            detail="Range not satisfiable",
            headers={"Content-Range": f"bytes */{size}"},
        )
    if start is None:
        body = client.get_object(Bucket=settings.STORAGE_BUCKET, Key=key)["Body"]
        headers["Content-Length"] = str(size)
        return StreamingResponse(body, headers=headers)
    length = end - start + 1
    body = client.get_object(
        Bucket=settings.STORAGE_BUCKET, Key=key, Range=f"bytes={start}-{end}"
    )["Body"]
    headers.update(
        {
            "Content-Range": f"bytes {start}-{end}/{size}",
            "Content-Length": str(length),
        }
    )
    return StreamingResponse(body, status_code=206, headers=headers)


@router.get("/{course_id}/lessons/{lesson_id}/media")
def lesson_media(
    course_id: int,
    lesson_id: int,
    kind: str = "video",
    exp: int = 0,
    sig: str = "",
    range_header: str | None = Header(default=None),
    db: Session = Depends(get_db),
    current: User | None = Depends(get_optional_user),
):
    """Stream a lesson's video or attachment behind a short-lived signed link.

    The signed URL is the credential (expired links and forgeries are
    rejected); browsers load media without an Authorization header, so the
    signature alone must authorize the fetch. A logged-in viewer who is not
    enrolled is still rejected."""
    if kind not in ("video", "file"):
        raise HTTPException(status_code=400, detail="Unknown media kind")
    lesson = db.get(Lesson, lesson_id)
    if not lesson or lesson.module.course_id != course_id:
        raise HTTPException(status_code=404, detail="Lesson not found")
    _verify_media_sig(lesson_id, kind, exp, sig)
    if current is not None and not _authorized_for_content(db, current, course_id):
        raise HTTPException(status_code=403, detail="You are not enrolled in this course")

    url = lesson.video_url if kind == "video" else lesson.attachment_url
    if not url:
        raise HTTPException(status_code=404, detail="No media for this lesson")

    inline_name = Path(url).name if kind == "file" else None
    key = storage.key_from_url(url)
    if key:
        return _stream_s3(key, range_header, inline_name)

    filename = Path(url).name
    local = Path(settings.UPLOAD_DIR).resolve() / filename
    if not local.exists():
        raise HTTPException(status_code=404, detail="File not found")
    media_type = _content_type(url, None)
    headers = {"X-Content-Type-Options": "nosniff"}
    if inline_name:
        headers["Content-Disposition"] = f'inline; filename="{inline_name}"'
    return FileResponse(local, media_type=media_type, headers=headers)