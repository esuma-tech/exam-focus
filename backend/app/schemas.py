from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ---------- Auth ----------
class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    full_name: str = Field(min_length=2)
    phone: str = ""
    role: Literal["learner", "instructor", "parent"] = "learner"
    grade: str = ""


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: "UserOut"


class RefreshRequest(BaseModel):
    refresh_token: str


# ---------- Users ----------
class UserOut(ORMModel):
    id: int
    email: EmailStr
    full_name: str
    phone: str
    role: str
    is_active: bool
    is_approved: bool
    avatar: str
    bio: str
    grade: str
    created_at: datetime


class UserUpdate(BaseModel):
    email: EmailStr | None = None
    full_name: str | None = None
    phone: str | None = None
    avatar: str | None = None
    bio: str | None = None
    grade: str | None = None
    role: str | None = None
    is_active: bool | None = None
    password: str | None = Field(default=None, min_length=8)


# ---------- Courses ----------
class ModuleIn(BaseModel):
    title: str
    description: str = ""
    position: int = 0
    lessons: list["LessonIn"] = []


class LessonIn(BaseModel):
    title: str
    summary: str = ""
    content: str = ""
    video_url: str = ""
    attachment_url: str = ""
    duration_min: int = 0
    position: int = 0


class CourseIn(BaseModel):
    title: str
    subtitle: str = ""
    description: str = ""
    subject: str = ""
    grade: str = ""
    thumbnail: str = ""
    price_etb: float = 0.0
    difficulty: str = "intermediate"
    status: str = "draft"
    is_featured: bool = False
    modules: list[ModuleIn] = []


class LessonOut(ORMModel):
    id: int
    title: str
    summary: str
    content: str
    video_url: str
    attachment_url: str
    duration_min: int
    position: int
    module_id: int


class ModuleOut(ORMModel):
    id: int
    title: str
    description: str
    position: int
    lessons: list[LessonOut] = []


class CourseOut(ORMModel):
    id: int
    title: str
    subtitle: str
    description: str
    subject: str
    grade: str
    thumbnail: str
    price_etb: float
    status: str
    difficulty: str
    is_featured: bool
    instructor_id: int
    created_at: datetime
    updated_at: datetime


class CourseDetail(CourseOut):
    instructor: UserOut | None = None
    modules: list[ModuleOut] = []
    enrollment_count: int = 0


class CourseUpdate(BaseModel):
    title: str | None = None
    subtitle: str | None = None
    description: str | None = None
    subject: str | None = None
    grade: str | None = None
    thumbnail: str | None = None
    price_etb: float | None = None
    status: str | None = None
    difficulty: str | None = None
    is_featured: bool | None = None


# ---------- Enrollment ----------
class EnrollmentOut(ORMModel):
    id: int
    progress_percent: float
    status: str
    course: CourseOut
    created_at: datetime


class LessonCompleteIn(BaseModel):
    lesson_id: int


# ---------- Quiz ----------
class QuestionIn(BaseModel):
    prompt: str
    question_type: str = "multiple_choice"
    options: list[str] = []
    correct_answer: str
    explanation: str = ""
    points: float = 1.0
    position: int = 0


class QuizIn(BaseModel):
    title: str
    description: str = ""
    time_limit_min: int = 15
    pass_percent: float = 50.0
    attempt_limit: int = 3
    is_published: bool = True
    questions: list[QuestionIn] = []


class QuestionOut(ORMModel):
    id: int
    prompt: str
    question_type: str
    options: list[str]
    correct_answer: str
    explanation: str
    points: float
    position: int


class QuizOut(ORMModel):
    id: int
    title: str
    description: str
    time_limit_min: int
    pass_percent: float
    attempt_limit: int
    is_published: bool
    course_id: int
    created_at: datetime


class QuizDetail(QuizOut):
    questions: list[QuestionOut] = []


class QuizDetailForLearner(ORMModel):
    id: int
    title: str
    description: str
    time_limit_min: int
    pass_percent: float
    attempt_limit: int
    questions: list[QuestionOut]
    attempts_taken: int = 0


class AnswerIn(BaseModel):
    question_id: int
    answer: str
    options: list[str] = []


class QuizSubmitIn(BaseModel):
    answers: list[AnswerIn] = []


class QuizAttemptOut(ORMModel):
    id: int
    score: float
    max_score: float
    percent: float
    passed: bool
    answers: list[Any]
    created_at: datetime


# ---------- Forum ----------
class ForumOut(ORMModel):
    id: int
    title: str
    description: str
    course_id: int


class ForumPostIn(BaseModel):
    title: str = ""
    body: str
    is_pinned: bool = False
    is_announcement: bool = False


class ForumCommentIn(BaseModel):
    body: str


class ForumCommentOut(ORMModel):
    id: int
    body: str
    created_at: datetime
    author: UserOut


class ForumPostOut(ORMModel):
    id: int
    title: str
    body: str
    is_pinned: bool
    is_announcement: bool
    created_at: datetime
    author: UserOut
    comments: list[ForumCommentOut]


# ---------- Notifications ----------
class NotificationOut(ORMModel):
    id: int
    kind: str
    title: str
    body: str
    channel: str
    is_read: bool
    created_at: datetime


class NotificationCreate(BaseModel):
    user_id: int
    kind: str = "info"
    title: str
    body: str = ""
    channel: str = "in_app"


# ---------- Live classes ----------
class LiveClassIn(BaseModel):
    title: str
    description: str = ""
    scheduled_at: datetime
    duration_min: int = 60
    course_id: int
    provider: str = "jitsi"


class LiveClassOut(ORMModel):
    id: int
    title: str
    description: str
    provider: str
    meeting_url: str
    scheduled_at: datetime
    duration_min: int
    status: str
    recording_url: str
    course_id: int
    instructor_id: int


# ---------- Analytics ----------
class OverviewStats(BaseModel):
    total_users: int
    total_learners: int
    total_instructors: int
    total_courses: int
    published_courses: int
    total_enrollments: int
    active_enrollments: int
    total_quizzes: int
    quiz_attempts: int
    avg_quiz_percent: float
    forum_posts: int
    revenue_etb: float


class CourseEnrollmentStats(BaseModel):
    course_id: int
    course_title: str
    enrollments: int
    active: int
    avg_progress: float
    avg_quiz_score: float


class UserActivitySeries(BaseModel):
    label: str
    events: int


class RevenueSeries(BaseModel):
    label: str
    amount_etb: float


class QuizAnalyticsItem(BaseModel):
    quiz_id: int
    quiz_title: str
    attempts: int
    avg_percent: float
    pass_rate: float


# ---------- System ----------
class SchoolProfileOut(ORMModel):
    id: int
    name: str
    tagline: str
    mission: str
    about: str
    address: str
    phone: str
    email: str
    cover_image: str
    primary_color: str
    accent_color: str


class SchoolProfileIn(BaseModel):
    name: str | None = None
    tagline: str | None = None
    mission: str | None = None
    about: str | None = None
    address: str | None = None
    phone: str | None = None
    email: str | None = None
    cover_image: str | None = None
    primary_color: str | None = None
    accent_color: str | None = None


class Message(BaseModel):
    message: str


class HealthOut(BaseModel):
    status: str
    app: str
    version: str
    environment: str


TokenResponse.model_rebuild()
ModuleIn.model_rebuild()