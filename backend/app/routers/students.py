import re

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy import func
from sqlalchemy.orm import Session, selectinload

from ..database import get_db
from ..deps import admin_only, get_current_user
from ..models import (
    AnalyticsEvent,
    Certificate,
    Course,
    Enrollment,
    Lesson,
    Module,
    ParentStudent,
    Quiz,
    QuizAttempt,
    User,
)
from ..schemas import (
    CertificateIssueIn,
    CertificateOut,
    QuizResultItem,
    StudentCourseProgress,
    StudentDetailOut,
    StudentListItem,
)
from ..services.certificates import build_certificate_pdf, build_id_card_pdf

router = APIRouter(prefix="/students", tags=["students"])


def _get_learner(db: Session, student_id: int) -> User:
    student = db.get(User, student_id)
    if not student or student.role != "learner":
        raise HTTPException(status_code=404, detail="Student not found")
    return student


def _can_view(db: Session, current: User, student: User) -> bool:
    if current.role == "admin":
        return True
    if current.id == student.id:
        return True
    if current.role == "parent":
        link = (
            db.query(ParentStudent)
            .filter(ParentStudent.parent_id == current.id, ParentStudent.student_id == student.id)
            .first()
        )
        return link is not None
    return False


def _progress_for(db: Session, enrollment: Enrollment) -> float:
    total = db.query(Lesson).join(Module).filter(Module.course_id == enrollment.course_id).count()
    if total == 0:
        return 0.0
    done = set(enrollment.completed_lesson_ids or [])
    return round(min(len(done) / total, 1.0) * 100, 1)


def _avg_quiz_for_course(db: Session, student_id: int, course_id: int) -> float:
    rows = (
        db.query(QuizAttempt)
        .filter(QuizAttempt.user_id == student_id, QuizAttempt.quiz_id.in_(db.query(Quiz.id).filter(Quiz.course_id == course_id)))
        .all()
    )
    if not rows:
        return 0.0
    return round(sum(r.percent for r in rows) / len(rows), 1)


def _quiz_results(db: Session, student_id: int, limit: int = 100) -> list[QuizResultItem]:
    attempts = (
        db.query(QuizAttempt)
        .options(selectinload(QuizAttempt.quiz))
        .filter(QuizAttempt.user_id == student_id)
        .order_by(QuizAttempt.created_at.desc())
        .limit(limit)
        .all()
    )
    out = []
    for a in attempts:
        quiz = db.get(Quiz, a.quiz_id)
        course = db.get(Course, quiz.course_id) if quiz else None
        out.append(
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
    return out


@router.get("", response_model=list[StudentListItem])
def list_students(db: Session = Depends(get_db), _: User = Depends(admin_only)):
    learners = db.query(User).filter(User.role == "learner").order_by(User.full_name.asc()).limit(500).all()
    if not learners:
        return []
    ids = [u.id for u in learners]
    enroll_counts = dict(
        db.query(Enrollment.user_id, func.count(Enrollment.id))
        .filter(Enrollment.user_id.in_(ids))
        .group_by(Enrollment.user_id)
        .all()
    )
    avg_scores = dict(
        db.query(QuizAttempt.user_id, func.avg(QuizAttempt.percent))
        .filter(QuizAttempt.user_id.in_(ids))
        .group_by(QuizAttempt.user_id)
        .all()
    )
    return [
        StudentListItem(
            id=u.id,
            full_name=u.full_name,
            email=u.email,
            grade=u.grade,
            student_id=u.student_id,
            avatar=u.avatar,
            enrollments=enroll_counts.get(u.id, 0),
            avg_quiz_score=round(avg_scores.get(u.id, 0.0), 1),
        )
        for u in learners
    ]


@router.get("/{student_id}", response_model=StudentDetailOut)
def student_detail(student_id: int, db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    student = _get_learner(db, student_id)
    if not _can_view(db, current, student):
        raise HTTPException(status_code=403, detail="You cannot view this student")
    enrollments = (
        db.query(Enrollment)
        .options(selectinload(Enrollment.course))
        .filter(Enrollment.user_id == student.id)
        .all()
    )
    courses = []
    for e in enrollments:
        courses.append(
            StudentCourseProgress(
                course_id=e.course.id,
                title=e.course.title,
                subject=e.course.subject,
                grade=e.course.grade,
                progress_percent=_progress_for(db, e),
                average_quiz_score=_avg_quiz_for_course(db, student.id, e.course_id),
            )
        )
    def _avg_quiz() -> float:
        rows = db.query(QuizAttempt).filter(QuizAttempt.user_id == student.id).all()
        if not rows:
            return 0.0
        return round(sum(r.percent for r in rows) / len(rows), 1)

    certs = [CertificateOut.model_validate(c) for c in student.certificates]
    return StudentDetailOut(
        id=student.id,
        full_name=student.full_name,
        email=student.email,
        grade=student.grade,
        student_id=student.student_id,
        avatar=student.avatar,
        enrollments=len(enrollments),
        avg_quiz_score=_avg_quiz(),
        courses=courses,
        quiz_results=_quiz_results(db, student.id),
        certificates=certs,
    )


@router.post("/{student_id}/certificate", response_model=CertificateOut, status_code=201)
def issue_certificate(
    student_id: int,
    payload: CertificateIssueIn,
    db: Session = Depends(get_db),
    current: User = Depends(admin_only),
):
    student = _get_learner(db, student_id)
    cert = Certificate(
        kind="certificate",
        course_title=(payload.course_title or "").strip(),
        student_id=student.id,
        issued_by=current.id,
    )
    db.add(cert)
    db.add(
        AnalyticsEvent(
            event_name="certificate.issued",
            entity="certificate",
            entity_id=student.id,
            user_id=current.id,
            meta={"kind": "certificate", "course_title": cert.course_title},
        )
    )
    db.commit()
    db.refresh(cert)
    return cert


@router.post("/{student_id}/id-card", response_model=CertificateOut, status_code=201)
def issue_id_card(
    student_id: int,
    db: Session = Depends(get_db),
    current: User = Depends(admin_only),
):
    student = _get_learner(db, student_id)
    cert = Certificate(kind="id_card", course_title="", student_id=student.id, issued_by=current.id)
    db.add(cert)
    db.add(
        AnalyticsEvent(
            event_name="certificate.issued",
            entity="certificate",
            entity_id=student.id,
            user_id=current.id,
            meta={"kind": "id_card"},
        )
    )
    db.commit()
    db.refresh(cert)
    return cert


def _pdf_response(pdf_bytes: bytes, filename: str) -> Response:
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


def _latest_certificate(db: Session, student_id: int, kind: str) -> Certificate | None:
    return (
        db.query(Certificate)
        .filter(Certificate.student_id == student_id, Certificate.kind == kind)
        .order_by(Certificate.created_at.desc())
        .first()
    )


def _slug(text: str) -> str:
    return re.sub(r"[^a-zA-Z0-9]+", "-", text).strip("-").lower() or "student"


@router.get("/{student_id}/certificate.pdf")
def download_certificate(
    student_id: int,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    student = _get_learner(db, student_id)
    if not _can_view(db, current, student):
        raise HTTPException(status_code=403, detail="You cannot download this certificate")
    latest = _latest_certificate(db, student.id, "certificate")
    if not latest:
        raise HTTPException(status_code=404, detail="No certificate has been awarded yet")
    pdf = build_certificate_pdf(student.full_name, latest.course_title, current.full_name)
    return _pdf_response(pdf, f"certificate-{_slug(student.full_name)}.pdf")


# Alias used by the learner/parent dashboards (same download, no .pdf suffix).
@router.get("/{student_id}/certificate")
def download_certificate_alias(
    student_id: int, db: Session = Depends(get_db), current: User = Depends(get_current_user)
):
    return download_certificate(student_id, db, current)


@router.get("/{student_id}/id-card.pdf")
def download_id_card(
    student_id: int,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    student = _get_learner(db, student_id)
    if not _can_view(db, current, student):
        raise HTTPException(status_code=403, detail="You cannot download this ID card")
    if not _latest_certificate(db, student.id, "id_card"):
        raise HTTPException(
            status_code=404,
            detail="No ID card has been generated yet. Upload a profile photo to create one.",
        )
    pdf = build_id_card_pdf(student.full_name, student.student_id or "", student.grade, student.avatar)
    return _pdf_response(pdf, f"id-card-{_slug(student.full_name)}.pdf")


# Alias used by the learner/parent dashboards (id_card instead of id-card).
@router.get("/{student_id}/id_card")
def download_id_card_alias(
    student_id: int, db: Session = Depends(get_db), current: User = Depends(get_current_user)
):
    return download_id_card(student_id, db, current)