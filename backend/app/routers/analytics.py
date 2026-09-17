from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import admin_only, get_current_user, instructor_or_admin
from ..models import (
    AnalyticsEvent,
    Course,
    Enrollment,
    ForumPost,
    Quiz,
    QuizAttempt,
    User,
)
from ..schemas import (
    CourseEnrollmentStats,
    OverviewStats,
    QuizAnalyticsItem,
    RevenueSeries,
    UserActivitySeries,
)

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/overview", response_model=OverviewStats)
def overview(db: Session = Depends(get_db), _: User = Depends(admin_only)):
    total_users = db.query(func.count(User.id)).scalar() or 0
    total_learners = db.query(func.count(User.id)).filter(User.role == "learner").scalar() or 0
    total_instructors = db.query(func.count(User.id)).filter(User.role == "instructor").scalar() or 0
    total_courses = db.query(func.count(Course.id)).scalar() or 0
    published_courses = db.query(func.count(Course.id)).filter(Course.status == "published").scalar() or 0
    total_enrollments = db.query(func.count(Enrollment.id)).scalar() or 0
    active_enrollments = db.query(func.count(Enrollment.id)).filter(Enrollment.status == "active").scalar() or 0
    total_quizzes = db.query(func.count(Quiz.id)).scalar() or 0
    quiz_attempts = db.query(func.count(QuizAttempt.id)).scalar() or 0
    avg_quiz_percent = db.query(func.avg(QuizAttempt.percent)).scalar() or 0.0
    forum_posts = db.query(func.count(ForumPost.id)).scalar() or 0

    rows = (
        db.query((Enrollment.course_id).label("cid"), func.count(Enrollment.id))
        .group_by(Enrollment.course_id)
        .all()
    )
    revenue_etb = 0.0
    for cid, count in rows:
        course = db.get(Course, cid)
        if course:
            revenue_etb += course.price_etb * count

    return OverviewStats(
        total_users=total_users, total_learners=total_learners, total_instructors=total_instructors,
        total_courses=total_courses, published_courses=published_courses,
        total_enrollments=total_enrollments, active_enrollments=active_enrollments,
        total_quizzes=total_quizzes, quiz_attempts=quiz_attempts,
        avg_quiz_percent=round(avg_quiz_percent, 1), forum_posts=forum_posts, revenue_etb=round(revenue_etb, 2),
    )


@router.get("/learner", response_model=dict)
def learner_analytics(db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    enrollments = db.query(Enrollment).filter(Enrollment.user_id == current.id).all()
    avg_progress = round(sum(e.progress_percent for e in enrollments) / len(enrollments), 1) if enrollments else 0.0
    completed = sum(1 for e in enrollments if e.progress_percent >= 100)
    attempts = (
        db.query(QuizAttempt)
        .filter(QuizAttempt.user_id == current.id)
        .order_by(QuizAttempt.created_at.desc())
        .all()
    )
    avg_score = round(sum(a.percent for a in attempts) / len(attempts), 1) if attempts else 0.0
    best = max((a.percent for a in attempts), default=0.0)
    return {
        "enrolled": len(enrollments),
        "avg_progress": avg_progress,
        "completed": completed,
        "attempts": len(attempts),
        "avg_score": avg_score,
        "best_score": best,
        "recent_attempts": [
            {"quiz_id": a.quiz_id, "percent": a.percent, "passed": a.passed,
             "created_at": a.created_at.isoformat()}
            for a in attempts[:10]
        ],
    }


@router.get("/instructor", response_model=dict)
def instructor_analytics(db: Session = Depends(get_db), current: User = Depends(instructor_or_admin)):
    if current.role == "admin":
        courses = db.query(Course).all()
    else:
        courses = db.query(Course).filter(Course.instructor_id == current.id).all()
    course_ids = [c.id for c in courses]

    stats = []
    for c in courses:
        enrollments = db.query(Enrollment).filter(Enrollment.course_id == c.id).all()
        active = sum(1 for e in enrollments if e.status == "active")
        avg_progress = round(sum(e.progress_percent for e in enrollments) / len(enrollments), 1) if enrollments else 0.0
        quiz_scores = (
            db.query(func.avg(QuizAttempt.percent))
            .filter(QuizAttempt.quiz_id.in_([q.id for q in c.quizzes]))
            .scalar()
        ) if c.quizzes else None
        stats.append(CourseEnrollmentStats(
            course_id=c.id, course_title=c.title, enrollments=len(enrollments),
            active=active, avg_progress=avg_progress,
            avg_quiz_score=round(quiz_scores, 1) if quiz_scores is not None else 0.0,
        ))

    total_revenue = 0.0
    for c in courses:
        count = db.query(func.count(Enrollment.id)).filter(Enrollment.course_id == c.id).scalar() or 0
        total_revenue += c.price_etb * count

    return {
        "courses": stats,
        "total_courses": len(courses),
        "total_enrollments": sum(s.enrollments for s in stats),
        "total_revenue_etb": round(total_revenue, 2),
        "activity": _build_activity(db, course_ids or [-1]),
    }


@router.get("/activity", response_model=list[UserActivitySeries])
def activity(days: int = 14, db: Session = Depends(get_db), _: User = Depends(admin_only)):
    return _build_activity(db, None, days)


@router.get("/revenue", response_model=list[RevenueSeries])
def revenue(days: int = 30, db: Session = Depends(get_db), _: User = Depends(admin_only)):
    now = datetime.now(timezone.utc).date()
    start = now - timedelta(days=days - 1)
    enrollments = (
        db.query(Enrollment)
        .options()
        .filter(func.date(Enrollment.created_at) >= start)
        .all()
    )
    price_map = {c.id: c.price_etb for c in db.query(Course).all()}
    by_day: dict[str, float] = {}
    for e in enrollments:
        day = e.created_at.date().isoformat()
        by_day[day] = by_day.get(day, 0.0) + price_map.get(e.course_id, 0.0)
    return [RevenueSeries(label=d.isoformat(), amount_etb=round(by_day.get(d.isoformat(), 0.0), 2))
            for d in (start + timedelta(days=i) for i in range(days))]


@router.get("/quiz-performance", response_model=list[QuizAnalyticsItem])
def quiz_performance(db: Session = Depends(get_db), _: User = Depends(admin_only)):
    items = []
    for quiz in db.query(Quiz).all():
        attempts = db.query(QuizAttempt).filter(QuizAttempt.quiz_id == quiz.id).all()
        if not attempts:
            continue
        avg = sum(a.percent for a in attempts) / len(attempts)
        pass_rate = sum(1 for a in attempts if a.passed) / len(attempts) * 100
        items.append(QuizAnalyticsItem(
            quiz_id=quiz.id, quiz_title=quiz.title, attempts=len(attempts),
            avg_percent=round(avg, 1), pass_rate=round(pass_rate, 1),
        ))
    return items


def _build_activity(db: Session, entity_ids: list[int] | None, days: int = 14,
                    course_ids: list[int] | None = None) -> list[UserActivitySeries]:
    now = datetime.now(timezone.utc).date()
    start = now - timedelta(days=days - 1)
    q = db.query(
        func.date(AnalyticsEvent.created_at).label("day"),
        func.count(AnalyticsEvent.id),
    ).filter(AnalyticsEvent.created_at >= datetime.combine(start, datetime.min.time(), tzinfo=timezone.utc))
    if course_ids:
        q = q.filter(AnalyticsEvent.entity.in_(["lesson.completed", "quiz.submitted", "course.enrolled"]))
    q = q.group_by(func.date(AnalyticsEvent.created_at)).all()
    by_day = {str(day): count for day, count in q}
    return [UserActivitySeries(label=d.isoformat(), events=by_day.get(d.isoformat(), 0))
            for d in (start + timedelta(days=i) for i in range(days))]