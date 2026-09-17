# EXAM FOCUS — Online Teaching & Learning Platform

A production-oriented, full-stack online teaching and learning ecosystem for **Grade 9–12** students, built from the two planning documents:

- *EXAM FOCUS — Business Plan & Roadmap*
- *Online Teaching & Learning Platform — Development Plan*

It implements the three core portals from the development plan — **Learner Portal**, **Instructor Portal** and **Admin Panel** — on one shared, secure backend.

---

## Feature overview

| Area | Implemented |
|---|---|
| **Security** | bcrypt password hashing, JWT access + refresh sessions, role-based access control (admin / instructor / learner / parent) enforced per endpoint, mandatory administrator approval of every new account |
| **Public site** | Beautiful pre-login welcome page: hero, mission, platform stats, featured courses, subject coverage, CTA |
| **Learner Portal** | Dashboard (progress, streaks of activity, upcoming live classes), course catalog, course player (modules → lessons), mark-complete progress tracking, quizzes with instant grading and answer review, discussion forums, notifications, live classes |
| **Instructor Portal** | Analytics dashboard (enrollments, revenue, avg. progress, 14-day activity chart), course builder (course + modules + lessons), quiz authoring, live-class scheduling with automatic student notifications |
| **Admin Panel** | Platform-wide analytics (users, enrollments, revenue, quiz performance), activity & revenue trend charts, user management (roles, activate/deactivate, delete), broadcast announcements |
| **Course content** | Rich lesson content (HTML), video URLs, file attachments, video/image/document uploads with type + size validation |
| **Assessment** | MCQ / true-false / short-answer, timed attempts, attempt limits, pass marks, auto-grading, per-question explanations |
| **Live classes** | Jitsi Meet integration (configurable), meeting links, status tracking, recordings, student SMS/notification on scheduling |
| **Notifications** | In-app, email (SMTP) and SMS (provider stub) with a per-user inbox and read tracking |
| **Analytics** | Event tracking (logins, enrollments, lesson completions, quiz submissions) + aggregated reporting endpoints |

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite + React Router + Tailwind CSS |
| Backend | FastAPI + SQLAlchemy 2.0 + Pydantic v2 |
| Database | PostgreSQL (production) / SQLite (zero-config local dev) |
| Auth | JWT (PyJWT) + bcrypt |
| Live video | Jitsi Meet (swappable for Zoom/Meet) |

The architecture is layered and API-first (`/api/v1`), so the same backend can later serve native mobile clients exactly as described in the development plan.

---

## Repository layout

```
.
├── backend/
│   ├── app/
│   │   ├── main.py            # FastAPI app, CORS, router registration, startup seed
│   │   ├── config.py          # Pydantic settings (.env driven)
│   │   ├── database.py        # Engine + session (SQLite/Postgres)
│   │   ├── models.py          # SQLAlchemy models (users, courses, quizzes, forums, …)
│   │   ├── schemas.py         # Pydantic request/response models
│   │   ├── security.py        # Password hashing + JWT
│   │   ├── deps.py            # get_current_user + role guards (RBAC)
│   │   ├── seed.py            # Rich demo dataset (idempotent)
│   │   ├── routers/           # auth, users, courses, enrollments, quizzes,
│   │   │                      # forum, notifications, live, analytics, uploads, system
│   │   └── services/          # email.py, sms.py, notifications.py
│   ├── requirements.txt
│   └── .env.example
└── frontend/
    ├── src/
    │   ├── api.js             # fetch wrapper (JWT, error handling)
    │   ├── store.jsx          # Auth context/provider
    │   ├── App.jsx            # Routes + protected routes
    │   ├── components/        # Layout, ui kit, Forum
    │   └── pages/             # Landing, Login, Register, dashboards, learn, courses,
    │                          # instructor, admin, Notifications
    ├── package.json
    ├── vite.config.js         # dev proxy /api -> :8000
    └── tailwind.config.js
```

---

## Quick start (local, zero external services)

### 1. Backend

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env          # defaults already work with SQLite
python -m uvicorn app.main:app --reload --port 8000
```

The first startup automatically creates the schema and bootstraps a single
administrator account (no demo users or demo content are created).
API docs: http://localhost:8000/docs

### 2. Frontend

```powershell
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173**.

### Administrator account (seeded on a fresh database)

| Role | Email | Password |
|---|---|---|
| Admin | `esuman82@gmail.com` | `Bro@1005` |

There is exactly one admin account. All other accounts are self-registered
(`student` / `teacher` / `parent`) and **cannot log in until the admin approves
them** from *Admin → Users*, where the admin can also edit any user's details,
change roles, activate/disable, or reset passwords.

---

## Registration & approval flow

1. A user registers as a learner, instructor or parent — their account is stored
   with `is_approved=False` and they receive a *"pending approval"* confirmation.
2. The admin sees the pending registration under **Admin → Users → Pending approval**
   and can **Approve** (account becomes active and log in is allowed) or **Reject**
   (registration is removed).
3. Until approved, any login attempt returns *"Your account is pending approval
   by an administrator."*

---

## Using PostgreSQL (recommended for production/enterprise)

1. Create a database and user:
   ```sql
   CREATE DATABASE examfocus;
   CREATE USER examfocus WITH PASSWORD 'secret';
   GRANT ALL PRIVILEGES ON DATABASE examfocus TO examfocus;
   ```
2. In `backend/.env`:
   ```
   DATABASE_URL=postgresql+psycopg://examfocus:secret@localhost:5432/examfocus
   ```
3. Start the backend — tables and seed data are created automatically.

The same SQLAlchemy models work unchanged on Postgres; no code changes are required.

---

## Free deployment (Vercel + Render + Neon)

The recommended fully-free setup:

| Piece | Service | What it hosts |
|---|---|---|
| Frontend | **Vercel** | Static React build (`frontend/dist`) |
| Backend | **Render** | FastAPI on `uvicorn` (free plan sleeps when idle) |
| Database | **Neon** | Managed PostgreSQL (free tier) |

### 1. Database — Neon (console.neon.tech)

1. Create a free project and a database named `examfocus`.
2. Copy the **connection string** (use the pooled/psycopg one), e.g.
   `postgresql+psycopg://user:password@ep-xxx.pooler.aws.neon.tech/examfocus?sslmode=require`.
3. Keep it handy — it becomes `DATABASE_URL`.

### 2. Backend — Render

1. Push the repo to GitHub.
2. In the Render dashboard → **New → Blueprint**, connect the repo. The included
   [`render.yaml`](render.yaml) creates the `exam-focus-api` web service (it reads
   the app from `backend/`).
3. In the service's **Environment** tab set the values flagged `sync: false`:
   - `DATABASE_URL` → the Neon connection string.
   - `SECRET_KEY` → a long random string (`python -c "import secrets; print(secrets.token_urlsafe(64))"`).
   - `PUBLIC_BASE_URL` → `https://<your-service-name>.onrender.com`.
   - `CORS_ORIGINS` → JSON array of your frontend URLs, e.g. `["https://exam-focus.vercel.app"]`.
4. Render runs `uvicorn app.main:app --host 0.0.0.0 --port $PORT`. On first boot the
   schema is created and the single admin (`esuman82@gmail.com` / `Bro@1005`) is seeded.
   Change this password immediately.

### 3. Frontend — Vercel

1. In the Vercel dashboard → **Add New → Project**, import the repo and set the
   **Root Directory** to `frontend`.
2. Framework: **Vite**. Build command: `npm run build`. Output directory: `dist`
   (defaults). The [`vercel.json`](frontend/vercel.json) rewrites all routes to
   `index.html` for SPA routing.
3. Add the environment variable **`VITE_API_URL`** = `https://<your-service-name>.onrender.com`
   (no trailing slash) and redeploy.
4. Open your `*.vercel.app` URL — the site is now public.

### 4. After deploying

- Log in with the admin account at `https://<your-app>.vercel.app/login`.
- Approve/test new users under **Admin → Users**.
- On the free Render plan the backend **sleeps after ~15 minutes of inactivity**
  and wakes on the next request (first load after idle takes a few seconds).

### Production caveats

- **Uploads**: files are written to the instance disk (`backend/uploads`), which is
  ephemeral on Render — they survive restarts of the same instance but are lost on
  redeploy. For durable file storage, switch `uploads.py` to object storage (S3/R2).
- **Email/SMS**: leave `SMTP_HOST` empty to log instead of send, or configure a free
  transactional provider (Resend has a generous free tier) for real emails.
- **Jitsi**: live classes work out of the box via `meet.jit.si`.

---

## Configuration reference

All settings live in `backend/app/config.py` and are read from `backend/.env` (see `.env.example`). Key options:

- `SECRET_KEY` — **must** be changed in production.
- `DATABASE_URL` — SQLite or PostgreSQL DSN.
- `CORS_ORIGINS` — allowed frontend origins.
- `SMTP_*` — real email delivery for graded-quiz and announcement emails.
- `SMS_PROVIDER` / `SMS_API_KEY` — swap `console` (logs only) for a real gateway (Africa's Talking, Twilio, …).
- `LIVE_PROVIDER` / `LIVE_JITSI_DOMAIN` — live classroom provider.

---

## API surface (`/api/v1`)

```
POST   /auth/register            POST /auth/login      POST /auth/refresh
GET    /auth/me                  POST /auth/logout
GET    /users                    GET  /users/instructors
POST   /users/{id}/approve       POST /users/{id}/reject
GET    /users/{id}               PATCH /users/{id}     DELETE /users/{id}
GET    /courses                  GET  /courses/subjects
GET    /courses/{id}             POST /courses          PATCH /courses/{id}
DELETE /courses/{id}             POST /courses/{id}/modules
GET    /enrollments/my           POST /enrollments/{course_id}
POST   /enrollments/{id}/lessons/complete              DELETE /enrollments/{id}
GET    /quizzes                  GET  /quizzes/{id}      GET /quizzes/{id}/take
POST   /quizzes                  PATCH /quizzes/{id}     DELETE /quizzes/{id}
POST   /quizzes/{id}/submit      GET  /quizzes/{id}/attempts/my
GET    /forums                   GET  /forums/{id}       POST /forums/{id}/posts
POST   /forums/posts/{id}/comments                     DELETE /forums/posts/{id}
GET    /notifications            GET  /notifications/unread-count
POST   /notifications/{id}/read  POST /notifications/read-all   POST /notifications/broadcast
GET    /live                     POST /live              PATCH /live/{id}/status
GET    /analytics/overview       GET  /analytics/learner GET /analytics/instructor
GET    /analytics/activity       GET  /analytics/revenue GET /analytics/quiz-performance
POST   /uploads                  GET  /uploads/{filename}
GET    /public                   GET  /school            PUT  /school
GET    /health                   POST /reset
```

---

## Production deployment notes

1. **Secrets** — set a long random `SECRET_KEY`; never commit `.env`.
2. **Database** — use managed PostgreSQL; run migrations with Alembic if the schema evolves (the current app uses `create_all` for simplicity).
3. **Backend** — run behind a process manager / container:
   ```bash
   gunicorn app.main:app -k uvicorn.workers.UvicornWorker -w 4 -b 0.0.0.0:8000
   ```
4. **Frontend** — `npm run build`, then serve `frontend/dist` via Nginx/CDN. Point the `/api` location at the backend (the dev proxy is for local use only).
5. **File uploads** — for multi-instance deployments, switch `uploads.py` to object storage (S3/GCS) instead of the local disk.
6. **Reverse proxy** — terminate TLS at Nginx; forward `/api` to the backend and `/` to the static frontend build.
7. **Email/SMS** — configure SMTP and a real SMS provider to enable outbound notifications.
8. **Live classes** — Jitsi works out of the box (`meet.jit.si`); for branded rooms, self-host Jitsi or plug in the Zoom SDK.

---

## Roadmap alignment (from the development plan)

Implemented now (Phases 1–5 core): discovery data model, learner/instructor/admin portals, quizzes with instant grading, forums, live classrooms, payments-ready enrollment model, analytics, notifications, uploads.

Natural next steps: native mobile apps (React Native against this same API), offline-first caching, payment gateway integration (Stripe/telebirr/WeBirr), gamification, AI tutor/essay feedback, proctoring, and certificates.
