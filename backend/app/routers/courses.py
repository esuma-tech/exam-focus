from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, selectinload

from ..database import get_db
from ..deps import get_current_user, get_optional_user, instructor_or_admin
from ..models import AnalyticsEvent, Course, Lesson, Module, User
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


def _owned_course(course_id: int, db: Session, current: User) -> Course:
    course = db.get(Course, course_id)
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    if current.role != "admin" and course.instructor_id != current.id:
        raise HTTPException(status_code=403, detail="You can only edit your own courses")
    return course


def _course_with_children(course: Course) -> CourseDetail:
    detail = CourseDetail.model_validate(course)
    detail.enrollment_count = len(course.enrollments)
    detail.instructor = course.instructor
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
def get_course(course_id: int, db: Session = Depends(get_db)):
    course = (
        db.query(Course)
        .options(selectinload(Course.instructor), selectinload(Course.modules).selectinload(Module.lessons))
        .filter(Course.id == course_id)
        .first()
    )
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    return _course_with_children(course)


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
    return _course_with_children(course)


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
    return _course_with_children(course)


@router.delete("/{course_id}", response_model=Message)
def delete_course(course_id: int, db: Session = Depends(get_db), current: User = Depends(instructor_or_admin)):
    course = db.get(Course, course_id)
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    if current.role != "admin" and course.instructor_id != current.id:
        raise HTTPException(status_code=403, detail="You can only delete your own courses")
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
    return get_course(course_id, db)


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
    if "video_url" in data:
        storage.delete_by_url(lesson.video_url)
    if "attachment_url" in data:
        storage.delete_by_url(lesson.attachment_url)
    for key, value in data.items():
        setattr(lesson, key, value)
    db.commit()
    db.refresh(lesson)
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