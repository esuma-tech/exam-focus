from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, selectinload

from ..database import get_db
from ..deps import get_current_user, instructor_or_admin
from ..models import AnalyticsEvent, Course, Question, Quiz, QuizAttempt, User
from ..schemas import (
    AnswerIn,
    QuizAttemptOut,
    QuizDetail,
    QuizDetailForLearner,
    QuizIn,
    QuizOut,
    QuizSubmitIn,
    Message,
)
from ..services.notifications import notify_quiz_result

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