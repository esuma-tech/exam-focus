from datetime import datetime, date

from sqlalchemy import (
    Boolean,
    DateTime,
    Date,
    Float,
    ForeignKey,
    Integer,
    JSON,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class User(Base, TimestampMixin):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    phone: Mapped[str] = mapped_column(String(32), default="", nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(16), default="learner", nullable=False)  # admin | instructor | learner | parent
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_approved: Mapped[bool] = mapped_column(Boolean, default=False)  # must be approved by an admin before login
    avatar: Mapped[str] = mapped_column(String(512), default="", nullable=False)
    bio: Mapped[str] = mapped_column(Text, default="", nullable=False)
    grade: Mapped[str] = mapped_column(String(32), default="", nullable=False)
    student_id: Mapped[str | None] = mapped_column(String(6), unique=True, index=True, nullable=True)
    receipt_url: Mapped[str] = mapped_column(String(512), default="", nullable=False)

    courses_taught = relationship("Course", back_populates="instructor")
    enrollments = relationship("Enrollment", back_populates="user", cascade="all, delete-orphan")
    quiz_attempts = relationship("QuizAttempt", back_populates="user", cascade="all, delete-orphan")
    forum_posts = relationship("ForumPost", back_populates="author")
    notifications = relationship("Notification", back_populates="user", cascade="all, delete-orphan")
    parent_links = relationship(
        "ParentStudent", foreign_keys="ParentStudent.parent_id", back_populates="parent", cascade="all, delete-orphan"
    )
    student_links = relationship(
        "ParentStudent", foreign_keys="ParentStudent.student_id", back_populates="student", cascade="all, delete-orphan"
    )
    certificates = relationship(
        "Certificate", foreign_keys="Certificate.student_id", back_populates="student", cascade="all, delete-orphan"
    )


class Course(Base, TimestampMixin):
    __tablename__ = "courses"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    subtitle: Mapped[str] = mapped_column(String(512), default="", nullable=False)
    description: Mapped[str] = mapped_column(Text, default="", nullable=False)
    subject: Mapped[str] = mapped_column(String(64), default="", nullable=False)
    grade: Mapped[str] = mapped_column(String(16), default="", nullable=False)
    thumbnail: Mapped[str] = mapped_column(String(512), default="", nullable=False)
    price_etb: Mapped[float] = mapped_column(Float, default=0.0)
    status: Mapped[str] = mapped_column(String(16), default="draft")  # draft | published | archived
    difficulty: Mapped[str] = mapped_column(String(16), default="intermediate")
    is_featured: Mapped[bool] = mapped_column(Boolean, default=False)

    instructor_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    instructor = relationship("User", back_populates="courses_taught")

    modules = relationship("Module", back_populates="course", cascade="all, delete-orphan", order_by="Module.position")
    enrollments = relationship("Enrollment", back_populates="course", cascade="all, delete-orphan")
    quizzes = relationship("Quiz", back_populates="course", cascade="all, delete-orphan")
    forums = relationship("Forum", back_populates="course", cascade="all, delete-orphan")


class Module(Base, TimestampMixin):
    __tablename__ = "modules"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, default="", nullable=False)
    position: Mapped[int] = mapped_column(Integer, default=0)

    course_id: Mapped[int] = mapped_column(ForeignKey("courses.id"), nullable=False)
    course = relationship("Course", back_populates="modules")

    lessons = relationship("Lesson", back_populates="module", cascade="all, delete-orphan", order_by="Lesson.position")


class Lesson(Base, TimestampMixin):
    __tablename__ = "lessons"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    summary: Mapped[str] = mapped_column(Text, default="", nullable=False)
    content: Mapped[str] = mapped_column(Text, default="", nullable=False)
    video_url: Mapped[str] = mapped_column(String(1024), default="", nullable=False)
    attachment_url: Mapped[str] = mapped_column(String(512), default="", nullable=False)
    position: Mapped[int] = mapped_column(Integer, default=0)
    duration_min: Mapped[int] = mapped_column(Integer, default=0)

    module_id: Mapped[int] = mapped_column(ForeignKey("modules.id"), nullable=False)
    module = relationship("Module", back_populates="lessons")


class Enrollment(Base, TimestampMixin):
    __tablename__ = "enrollments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    progress_percent: Mapped[float] = mapped_column(Float, default=0.0)
    completed_lesson_ids: Mapped[list] = mapped_column(JSON, default=list)
    status: Mapped[str] = mapped_column(String(16), default="active")  # active | completed | dropped

    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    user = relationship("User", back_populates="enrollments")
    course_id: Mapped[int] = mapped_column(ForeignKey("courses.id"), nullable=False)
    course = relationship("Course", back_populates="enrollments")


class Quiz(Base, TimestampMixin):
    __tablename__ = "quizzes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, default="", nullable=False)
    time_limit_min: Mapped[int] = mapped_column(Integer, default=15)
    pass_percent: Mapped[float] = mapped_column(Float, default=50.0)
    attempt_limit: Mapped[int] = mapped_column(Integer, default=3)
    is_published: Mapped[bool] = mapped_column(Boolean, default=True)

    course_id: Mapped[int] = mapped_column(ForeignKey("courses.id"), nullable=False)
    course = relationship("Course", back_populates="quizzes")

    questions = relationship("Question", back_populates="quiz", cascade="all, delete-orphan")
    attempts = relationship("QuizAttempt", back_populates="quiz", cascade="all, delete-orphan")


class Question(Base, TimestampMixin):
    __tablename__ = "questions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    prompt: Mapped[str] = mapped_column(Text, nullable=False)
    question_type: Mapped[str] = mapped_column(String(16), default="multiple_choice")  # multiple_choice | true_false | short_answer
    options: Mapped[list] = mapped_column(JSON, default=list)  # for MCQ
    correct_answer: Mapped[str] = mapped_column(Text, default="", nullable=False)
    explanation: Mapped[str] = mapped_column(Text, default="", nullable=False)
    points: Mapped[float] = mapped_column(Float, default=1.0)
    position: Mapped[int] = mapped_column(Integer, default=0)

    quiz_id: Mapped[int] = mapped_column(ForeignKey("quizzes.id"), nullable=False)
    quiz = relationship("Quiz", back_populates="questions")


class QuizAttempt(Base, TimestampMixin):
    __tablename__ = "quiz_attempts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    score: Mapped[float] = mapped_column(Float, default=0.0)
    max_score: Mapped[float] = mapped_column(Float, default=0.0)
    percent: Mapped[float] = mapped_column(Float, default=0.0)
    passed: Mapped[bool] = mapped_column(Boolean, default=False)
    answers: Mapped[list] = mapped_column(JSON, default=list)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    user = relationship("User", back_populates="quiz_attempts")
    quiz_id: Mapped[int] = mapped_column(ForeignKey("quizzes.id"), nullable=False)
    quiz = relationship("Quiz", back_populates="attempts")


class Forum(Base, TimestampMixin):
    __tablename__ = "forums"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, default="", nullable=False)

    course_id: Mapped[int] = mapped_column(ForeignKey("courses.id"), nullable=False)
    course = relationship("Course", back_populates="forums")

    posts = relationship("ForumPost", back_populates="forum", cascade="all, delete-orphan")


class ForumPost(Base, TimestampMixin):
    __tablename__ = "forum_posts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    title: Mapped[str] = mapped_column(String(255), default="", nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    is_pinned: Mapped[bool] = mapped_column(Boolean, default=False)
    is_announcement: Mapped[bool] = mapped_column(Boolean, default=False)

    forum_id: Mapped[int] = mapped_column(ForeignKey("forums.id"), nullable=False)
    forum = relationship("Forum", back_populates="posts")
    author_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    author = relationship("User", back_populates="forum_posts")

    comments = relationship("ForumComment", back_populates="post", cascade="all, delete-orphan")


class ForumComment(Base, TimestampMixin):
    __tablename__ = "forum_comments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    body: Mapped[str] = mapped_column(Text, nullable=False)

    post_id: Mapped[int] = mapped_column(ForeignKey("forum_posts.id"), nullable=False)
    post = relationship("ForumPost", back_populates="comments")
    author_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    author = relationship("User")


class Notification(Base, TimestampMixin):
    __tablename__ = "notifications"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    kind: Mapped[str] = mapped_column(String(32), default="info", nullable=False)  # info | course | quiz | forum | billing | system
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    body: Mapped[str] = mapped_column(Text, default="", nullable=False)
    channel: Mapped[str] = mapped_column(String(16), default="in_app", nullable=False)  # in_app | email | sms
    is_read: Mapped[bool] = mapped_column(Boolean, default=False)

    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    user = relationship("User", back_populates="notifications")


class LiveClass(Base, TimestampMixin):
    __tablename__ = "live_classes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, default="", nullable=False)
    provider: Mapped[str] = mapped_column(String(16), default="jitsi", nullable=False)
    meeting_url: Mapped[str] = mapped_column(String(1024), default="", nullable=False)
    invite_key: Mapped[str] = mapped_column(String(16), index=True, default="", nullable=False)
    scheduled_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    duration_min: Mapped[int] = mapped_column(Integer, default=60)
    status: Mapped[str] = mapped_column(String(16), default="scheduled")  # scheduled | live | ended | cancelled
    recording_url: Mapped[str] = mapped_column(String(1024), default="", nullable=False)

    course_id: Mapped[int] = mapped_column(ForeignKey("courses.id"), nullable=False)
    course = relationship("Course")

    instructor_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    instructor = relationship("User")


class ParentStudent(Base, TimestampMixin):
    __tablename__ = "parent_students"
    __table_args__ = (UniqueConstraint("parent_id", "student_id", name="uq_parent_student"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    parent_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    student_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    parent = relationship("User", foreign_keys=[parent_id], back_populates="parent_links")
    student = relationship("User", foreign_keys=[student_id], back_populates="student_links")


class Certificate(Base, TimestampMixin):
    __tablename__ = "certificates"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    kind: Mapped[str] = mapped_column(String(16), nullable=False)  # certificate | id_card
    course_title: Mapped[str] = mapped_column(String(255), default="", nullable=False)

    student_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    student = relationship("User", foreign_keys=[student_id], back_populates="certificates")
    issued_by: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    issuer = relationship("User", foreign_keys=[issued_by])


class AnalyticsEvent(Base):
    __tablename__ = "analytics_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    event_name: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    entity: Mapped[str] = mapped_column(String(64), default="", nullable=False)
    entity_id: Mapped[int] = mapped_column(Integer, default=0)
    meta: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)

    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)

    @property
    def day(self) -> date:
        return self.created_at.date()


class SchoolProfile(Base):
    __tablename__ = "school_profile"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(255), default="EXAM FOCUS", nullable=False)
    tagline: Mapped[str] = mapped_column(String(512), default="Focused Preparation. Real Results.", nullable=False)
    mission: Mapped[str] = mapped_column(Text, default="", nullable=False)
    about: Mapped[str] = mapped_column(Text, default="", nullable=False)
    address: Mapped[str] = mapped_column(String(255), default="", nullable=False)
    phone: Mapped[str] = mapped_column(String(64), default="", nullable=False)
    email: Mapped[str] = mapped_column(String(255), default="", nullable=False)
    cover_image: Mapped[str] = mapped_column(String(512), default="", nullable=False)
    primary_color: Mapped[str] = mapped_column(String(16), default="#1e3a8a", nullable=False)
    accent_color: Mapped[str] = mapped_column(String(16), default="#f59e0b", nullable=False)