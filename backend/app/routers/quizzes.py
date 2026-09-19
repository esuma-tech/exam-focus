from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy import func
from sqlalchemy.orm import Session, selectinload

from ..database import get_db
from ..deps import get_current_user, instructor_or_admin
from ..models import AnalyticsEvent, Course, Enrollment, Question, Quiz, QuizAttempt, User
from ..schemas import (
    AnswerIn,
    LearnerQuizOut,
    QuizAttemptFullOut,
    QuizAttemptOut,
    QuizDetail,
    QuizDetailForLearner,
    QuizIn,
    QuizManageOut,
    QuizOut,
    QuizSubmitIn,
    Message,
    QuestionImportOut,
)
from ..services.notifications import notify_quiz_result
from ..services.question_import import extract_text, parse_questions

router = APIRouter(prefix="/quizzes", tags=["quizzes"])


def _can_edit(db: Session, current: User, quiz_id: int) -> Quiz:
    quiz = db.get(Quiz, quiz_id)
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")
    course = db.get(Course, quiz.course_id)
    if current.role != "admin" and course.instructor_id != current.id:
        raise HTTPException(status_code=403, detail="Not your course")
    return quiz


@router.get("", response_model=list[QuizOut])
def list_quizzes(course_id: int, db: Session = Depends(get_db)):
    return db.query(Quiz).filter(Quiz.course_id == course_id).order_by(Quiz.created_at.desc()).all()


@router.get("/mine", response_model=list[QuizManageOut])
def manage_quizzes(db: Session = Depends(get_db), current: User = Depends(instructor_or_admin)):
    """Quizzes the instructor owns (or all quizzes for admins), for management."""
    q = db.query(Quiz).options(selectinload(Quiz.course), selectinload(Quiz.questions))
    if current.role != "admin":
        q = q.join(Course, Quiz.course_id == Course.id).filter(Course.instructor_id == current.id)
    quizzes = q.order_by(Quiz.created_at.desc()).all()
    ids = [qz.id for qz in quizzes]
    counts = {}
    if ids:
        rows = (
            db.query(QuizAttempt.quiz_id, func.count(QuizAttempt.id))
            .filter(QuizAttempt.quiz_id.in_(ids))
            .group_by(QuizAttempt.quiz_id)
            .all()
        )
        counts = dict(rows)
    out = []
    for qz in quizzes:
        data = QuizManageOut.model_validate(qz)
        data.course_title = qz.course.title
        data.attempts_count = counts.get(qz.id, 0)
        out.append(data)
    return out


@router.get("/my", response_model=list[LearnerQuizOut])
def my_quizzes(db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    """Published quizzes for the learner's enrolled courses, with their attempt status."""
    if current.role != "learner":
        return []
    course_ids = [e.course_id for e in db.query(Enrollment).filter(Enrollment.user_id == current.id).all()]
    quizzes = []
    if course_ids:
        quizzes = (
            db.query(Quiz)
            .options(selectinload(Quiz.course))
            .filter(Quiz.course_id.in_(course_ids), Quiz.is_published == True)
            .order_by(Quiz.created_at.desc())
            .all()
        )
    attempts = {}
    if quizzes:
        rows = (
            db.query(QuizAttempt)
            .filter(QuizAttempt.user_id == current.id, QuizAttempt.quiz_id.in_([q.id for q in quizzes]))
            .all()
        )
        for a in rows:
            attempts.setdefault(a.quiz_id, []).append(a)
    out = []
    for q in quizzes:
        q_attempts = attempts.get(q.id, [])
        best = max((a.percent for a in q_attempts), default=0.0)
        out.append(
            LearnerQuizOut(
                id=q.id,
                title=q.title,
                description=q.description,
                time_limit_min=q.time_limit_min,
                pass_percent=q.pass_percent,
                attempt_limit=q.attempt_limit,
                course_id=q.course_id,
                course_title=q.course.title,
                attempts_taken=len(q_attempts),
                best_percent=round(best, 1),
                passed=any(a.passed for a in q_attempts),
                can_take=len(q_attempts) < q.attempt_limit,
            )
        )
    return out


@router.get("/{quiz_id}", response_model=QuizDetail)
def get_quiz(quiz_id: int, db: Session = Depends(get_db), current: User = Depends(instructor_or_admin)):
    quiz = db.get(Quiz, quiz_id)
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")
    return quiz


@router.get("/{quiz_id}/take", response_model=QuizDetailForLearner)
def get_quiz_for_learner(quiz_id: int, db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    quiz = (
        db.query(Quiz)
        .options(selectinload(Quiz.questions))
        .filter(Quiz.id == quiz_id)
        .first()
    )
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")
    attempts_taken = (
        db.query(QuizAttempt).filter(QuizAttempt.quiz_id == quiz_id, QuizAttempt.user_id == current.id).count()
    )
    if current.role == "learner" and not quiz.is_published:
        raise HTTPException(status_code=404, detail="Quiz not found")
    if attempts_taken >= quiz.attempt_limit:
        raise HTTPException(status_code=403, detail="Attempt limit reached")

    data = QuizDetailForLearner.model_validate(quiz)
    data.attempts_taken = attempts_taken
    return data


@router.post("/import", response_model=QuestionImportOut)
def import_questions(
    file: UploadFile = File(...),
    _: User = Depends(instructor_or_admin),
):
    """Parse a PDF / Word document of questions and answers into the platform format."""
    name = file.filename or ""
    data = file.file.read(11 * 1024 * 1024)
    if len(data) >= 11 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File is too large. Maximum size is 10 MB.")
    try:
        text = extract_text(name, data)
        questions = parse_questions(text)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except Exception:
        raise HTTPException(
            status_code=422,
            detail="Could not read the document. Make sure it is a valid PDF or Word file.",
        )
    notes = []
    if not questions:
        notes.append("No numbered questions with answer markers were found in the document.")
    elif any(q.get("correct_answer") in (None, "") for q in questions):
        notes.append(
            "Some questions have no detected answer — finish them by setting the correct answer before publishing."
        )
    return QuestionImportOut(questions=questions, notes=notes)


@router.post("", response_model=QuizOut, status_code=201)
def create_quiz(
    course_id: int,
    payload: QuizIn,
    db: Session = Depends(get_db),
    current: User = Depends(instructor_or_admin),
):
    course = db.get(Course, course_id)
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    if current.role != "admin" and course.instructor_id != current.id:
        raise HTTPException(status_code=403, detail="Not your course")

    quiz = Quiz(
        title=payload.title,
        description=payload.description,
        time_limit_min=payload.time_limit_min,
        pass_percent=payload.pass_percent,
        attempt_limit=payload.attempt_limit,
        is_published=payload.is_published,
        course_id=course_id,
    )
    db.add(quiz)
    db.flush()
    for qi, q_data in enumerate(payload.questions):
        db.add(Question(
            prompt=q_data.prompt,
            question_type=q_data.question_type,
            options=q_data.options,
            correct_answer=q_data.correct_answer,
            explanation=q_data.explanation,
            points=q_data.points,
            position=q_data.position or qi,
            quiz_id=quiz.id,
        ))
    db.add(AnalyticsEvent(event_name="quiz.created", entity="quiz", entity_id=quiz.id, user_id=current.id))
    db.commit()
    db.refresh(quiz)
    return quiz


@router.patch("/{quiz_id}", response_model=QuizOut)
def update_quiz(
    quiz_id: int,
    payload: dict,
    db: Session = Depends(get_db),
    current: User = Depends(instructor_or_admin),
):
    quiz = _can_edit(db, current, quiz_id)
    for key in ("title", "description", "time_limit_min", "pass_percent", "attempt_limit", "is_published"):
        if key in payload:
            setattr(quiz, key, payload[key])
    db.commit()
    db.refresh(quiz)
    return quiz


@router.put("/{quiz_id}", response_model=QuizDetail)
def replace_quiz(
    quiz_id: int,
    payload: QuizIn,
    db: Session = Depends(get_db),
    current: User = Depends(instructor_or_admin),
):
    """Full replace of a quiz's metadata AND questions (used by the manager)."""
    quiz = _can_edit(db, current, quiz_id)
    quiz.title = payload.title
    quiz.description = payload.description
    quiz.time_limit_min = payload.time_limit_min
    quiz.pass_percent = payload.pass_percent
    quiz.attempt_limit = payload.attempt_limit
    quiz.is_published = payload.is_published
    db.query(Question).filter(Question.quiz_id == quiz_id).delete()
    db.flush()
    for qi, q_data in enumerate(payload.questions):
        db.add(Question(
            prompt=q_data.prompt,
            question_type=q_data.question_type,
            options=q_data.options,
            correct_answer=q_data.correct_answer,
            explanation=q_data.explanation,
            points=q_data.points,
            position=q_data.position or qi,
            quiz_id=quiz.id,
        ))
    db.add(AnalyticsEvent(event_name="quiz.updated", entity="quiz", entity_id=quiz.id, user_id=current.id))
    db.commit()
    db.refresh(quiz)
    return quiz


@router.delete("/{quiz_id}", response_model=Message)
def delete_quiz(quiz_id: int, db: Session = Depends(get_db), current: User = Depends(instructor_or_admin)):
    quiz = _can_edit(db, current, quiz_id)
    db.delete(quiz)
    db.commit()
    return Message(message="Quiz deleted")


def _grade(answers: dict, questions: list[Question]) -> tuple[float, float, list]:
    graded = []
    score = 0.0
    max_score = sum(q.points for q in questions)
    for q in questions:
        submitted = answers.get(str(q.id), "").strip().lower()
        correct = (q.correct_answer or "").strip().lower()
        is_correct = submitted == correct
        if is_correct:
            score += q.points
        graded.append({
            "question_id": q.id,
            "prompt": q.prompt,
            "submitted": submitted,
            "correct_answer": q.correct_answer,
            "is_correct": is_correct,
            "points_earned": q.points if is_correct else 0.0,
            "explanation": q.explanation,
        })
    return score, max_score, graded


@router.post("/{quiz_id}/submit", response_model=QuizAttemptOut)
def submit_quiz(
    quiz_id: int,
    payload: QuizSubmitIn,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    quiz = db.get(Quiz, quiz_id)
    if not quiz or not quiz.is_published:
        raise HTTPException(status_code=404, detail="Quiz not found")
    questions = db.query(Question).filter(Question.quiz_id == quiz_id).order_by(Question.position).all()
    if not questions:
        raise HTTPException(status_code=400, detail="Quiz has no questions")

    attempts_taken = (
        db.query(QuizAttempt).filter(QuizAttempt.quiz_id == quiz_id, QuizAttempt.user_id == current.id).count()
    )
    if attempts_taken >= quiz.attempt_limit:
        raise HTTPException(status_code=403, detail="Attempt limit reached")

    answers_map = {
        str(a.question_id): " ".join(a.options).strip() if (a.options and not a.answer) else a.answer
        for a in payload.answers
    }
    score, max_score, graded = _grade(answers_map, questions)
    percent = round(score / max_score * 100, 1) if max_score else 0.0
    passed = percent >= quiz.pass_percent

    attempt = QuizAttempt(
        quiz_id=quiz_id,
        user_id=current.id,
        score=score,
        max_score=max_score,
        percent=percent,
        passed=passed,
        answers=graded,
    )
    db.add(attempt)
    db.add(AnalyticsEvent(event_name="quiz.submitted", entity="quiz", entity_id=quiz_id, user_id=current.id,
                          meta={"percent": percent, "passed": passed}))
    db.commit()
    db.refresh(attempt)

    notify_quiz_result(db, current, quiz.title, percent, passed)
    return attempt


@router.get("/{quiz_id}/attempts/my", response_model=list[QuizAttemptOut])
def my_attempts(quiz_id: int, db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    return (
        db.query(QuizAttempt)
        .filter(QuizAttempt.quiz_id == quiz_id, QuizAttempt.user_id == current.id)
        .order_by(QuizAttempt.created_at.desc())
        .all()
    )


@router.get("/{quiz_id}/attempts", response_model=list[QuizAttemptFullOut])
def quiz_attempts(quiz_id: int, db: Session = Depends(get_db), current: User = Depends(instructor_or_admin)):
    """All student attempts on a quiz (instructor/admin view)."""
    _can_edit(db, current, quiz_id)
    rows = (
        db.query(QuizAttempt)
        .filter(QuizAttempt.quiz_id == quiz_id)
        .order_by(QuizAttempt.created_at.desc())
        .limit(200)
        .all()
    )
    return [
        QuizAttemptFullOut(
            id=a.id,
            score=a.score,
            max_score=a.max_score,
            percent=a.percent,
            passed=a.passed,
            answers=a.answers,
            created_at=a.created_at,
            student=a.user,
        )
        for a in rows
    ]