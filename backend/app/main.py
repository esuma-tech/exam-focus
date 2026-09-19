from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from .config import get_settings
from .database import Base, engine, run_migrations
from .routers import (
    analytics,
    auth,
    courses,
    enrollments,
    forum,
    live,
    notifications,
    parents,
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
run_migrations()

for r in (auth.router, users.router, courses.router, enrollments.router, quizzes.router,
          forum.router, notifications.router, live.router, analytics.router, uploads.router,
          parents.router, system.router):
    app.include_router(r, prefix=settings.API_PREFIX)


@app.on_event("startup")
def on_startup():
    # Ensure seed data exists on a fresh database.
    from .seed import seed_all
    seed_all()


# Serve the built React app (frontend/dist) from the same origin so visiting
# the base URL opens the real web application. Falls back to a JSON info root
# when the frontend build is not present (e.g. API-only deploys).
FRONTEND_DIST = Path(__file__).resolve().parents[2] / "frontend" / "dist"
if FRONTEND_DIST.is_dir():
    app.mount("/assets", StaticFiles(directory=FRONTEND_DIST / "assets"), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def spa(full_path: str):
        if full_path.startswith("api/"):
            raise HTTPException(status_code=404, detail="Not found")
        dist_root = FRONTEND_DIST.resolve()
        candidate = (dist_root / full_path).resolve()
        if full_path and candidate.is_file() and dist_root in candidate.parents:
            return FileResponse(candidate)
        return FileResponse(dist_root / "index.html")
else:
    @app.get("/", include_in_schema=False)
    def root():
        return {"app": settings.APP_NAME, "docs": "/docs", "health": f"{settings.API_PREFIX}/health"}