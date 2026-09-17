from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .database import Base, engine
from .routers import (
    analytics,
    auth,
    courses,
    enrollments,
    forum,
    live,
    notifications,
    quizzes,
    system,
    uploads,
    users,
)

settings = get_settings()

app = FastAPI(
    title=settings.APP_NAME,
    description=settings.APP_DESCRIPTION,
    version=settings.VERSION,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"],
)

Base.metadata.create_all(bind=engine)

for r in (auth.router, users.router, courses.router, enrollments.router, quizzes.router,
          forum.router, notifications.router, live.router, analytics.router, uploads.router, system.router):
    app.include_router(r, prefix=settings.API_PREFIX)


@app.on_event("startup")
def on_startup():
    # Ensure seed data exists on a fresh database.
    from .seed import seed_all
    seed_all()


@app.get("/", include_in_schema=False)
def root():
    return {"app": settings.APP_NAME, "docs": "/docs", "health": f"{settings.API_PREFIX}/health"}