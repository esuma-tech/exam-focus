from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, selectinload

from ..database import get_db
from ..deps import require_roles
from ..models import AnalyticsEvent, Course, Enrollment, Lesson, Module, ParentStudent, Quiz, QuizAttempt, User
from ..schemas import Message, ParentQuizOut, ParentStudentLink, ParentStudentOut, QuizResultItem, StudentCourseProgress

router = APIRouter(prefix="/parents", tags=["parents"])

parent_only = require_roles("parent")


def _total_lessons(db: Session, course_id: int) -> int:
    return db.query(Lesson).join(Module).filter(Module.course_id == course_id).count()


def _progress_for(db: Session, enrollment: Enrollment) -> float:
    total = _total_lessons(db, enrollment.course_id)
    if total == 0:
        return 0.0
    done = set(enrollment.completed_lesson_ids or [])
    return round(min(len(done) / total, 1.0) * 100, 1)


def _avg_quiz(db: Session, student_id: int) -> float:
    rows = db.query(QuizAttempt).filter(QuizAttempt.user_id == student_id).all()
    if not rows:
        return 0.0
    return round(sum(r.percent for r in rows) / len(rows), 1)


def _student_summary(db: Session, student: User) -> ParentStudentOut:
    enrollments = (
        db.query(Enrollment)
        .options(selectinload(Enrollment.course))
        .filter(Enrollment.user_id == student.id)
        .all()
    )
    courses: list[StudentCourseProgress] = []
    total_progress = 0.0
    for e in enrollments:
        progress = _progress_for(db, e)
        total_progress += progress
        courses.append(
            StudentCourseProgress(
                course_id=e.course.id,
                title=e.course.title,
                subject=e.course.subject,
                grade=e.course.grade,
                progress_percent=progress,
                average_quiz_score=_avg_quiz_for_course(db, student.id, e.course_id),
            )
        )
    avg_progress = round(total_progress / len(enrollments), 1) if enrollments else 0.0
    return ParentStudentOut(
        student=student,
        avg_progress=avg_progress,
        avg_quiz_score=_avg_quiz(db, student.id),
        courses=courses,
    )


def _avg_quiz_for_course(db: Session, student_id: int, course_id: int) -> float:
    rows = (
        db.query(QuizAttempt)
        .filter(
            QuizAttempt.user_id == student_id,
            QuizAttempt.quiz_id.in_(
                db.query(Quiz.id).filter(Quiz.course_id == course_id)
            ),
        )
        .all()
    )
    if not rows:
        return 0.0
    return round(sum(r.percent for r in rows) / len(rows), 1)


@router.get("/students", response_model=list[ParentStudentOut])
def list_students(db: Session = Depends(get_db), current: User = Depends(parent_only)):
    links = (
        db.query(ParentStudent)
        .options(selectinload(ParentStudent.student))
        .filter(ParentStudent.parent_id == current.id)
        .order_by(ParentStudent.created_at.asc())
        .all()
    )
    return [_student_summary(db, link.student) for link in links]


@router.post("/students", response_model=list[ParentStudentOut])
def add_students(
    payload: ParentStudentLink,
    db: Session = Depends(get_db),
    current: User = Depends(parent_only),
):
    cleaned = {i.strip() for i in payload.student_ids if i and i.strip()}
    if not cleaned:
        raise HTTPException(status_code=422, detail="Provide at least one student ID")
    rows = db.query(User).filter(User.student_id.in_(cleaned)).all()
    found = {u.student_id: u for u in rows if u.role == "learner"}
    missing = cleaned - set(found)
    if missing:
        raise HTTPException(status_code=422, detail="Student ID not found: " + ", ".join(sorted(missing)))

    existing = {
        p.student_id
        for p in db.query(ParentStudent).filter(ParentStudent.parent_id == current.id).all()
    }
    for child in found.values():
        if child.id in existing:
            continue
        db.add(ParentStudent(parent_id=current.id, student_id=child.id))
        db.add(AnalyticsEvent(event_name="student.linked", entity="user", entity_id=child.id, user_id=current.id))
    db.commit()
    return list_students(db, current)


@router.delete("/students/{student_id}", response_model=Message)
def remove_student(student_id: int, db: Session = Depends(get_db), current: User = Depends(parent_only)):
    link = (
        db.query(ParentStudent)
        .filter(ParentStudent.parent_id == current.id, ParentStudent.student_id == student_id)
        .first()
    )
    if not link:
        raise HTTPException(status_code=404, detail="This student is not linked to your account")
    db.delete(link)
    db.commit()
    return Message(message="Student removed from your account")


@router.get("/quizzes", response_model=list[ParentQuizOut])
def child_quiz_results(db: Session = Depends(get_db), current: User = Depends(parent_only)):
    """Quiz results for every student linked to this parent."""
    links = (
        db.query(ParentStudent)
        .options(selectinload(ParentStudent.student))
        .filter(ParentStudent.parent_id == current.id)
        .order_by(ParentStudent.created_at.asc())
        .all()
    )
    out: list[ParentQuizOut] = []
    for link in links:
        attempts = (
            db.query(QuizAttempt)
            .filter(QuizAttempt.user_id == link.student_id)
            .order_by(QuizAttempt.created_at.desc())
            .limit(100)
            .all()
        )
        items = []
        for a in attempts:
            quiz = db.get(Quiz, a.quiz_id)
            course = db.get(Course, quiz.course_id) if quiz else None
            items.append(
                QuizResultItem(
                    attempt_id=a.id,
                    quiz_id=a.quiz_id,
                    quiz_title=quiz.title if quiz else "Deleted quiz",
                    course_id=quiz.course_id if quiz else 0,
                    course_title=course.title if course else "",
                    score=a.score,
                    max_score=a.max_score,
                    percent=a.percent,
                    passed=a.passed,
                    created_at=a.created_at,
                )
            )
        out.append(ParentQuizOut(student=link.student, attempts=items))
    return out