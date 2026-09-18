from functools import lru_cache
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    APP_NAME: str = "EXAM FOCUS Platform"
    APP_DESCRIPTION: str = "online teaching & learning platform Developed by Mr Haile and Esayas"
    VERSION: str = "1.0.0"
    ENVIRONMENT: str = "development"

    API_PREFIX: str = "/api/v1"

    # Database: default to SQLite for zero-config local dev.
    # Set DATABASE_URL=postgresql+psycopg://user:pass@host:5432/examfocus for production Postgres.
    DATABASE_URL: str = "sqlite:///./examfocusedu.db"

    SECRET_KEY: str = "change-me-in-production-to-a-long-random-string"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30

    # Uploads are served by the backend (absolute URL base the frontend uses).
    PUBLIC_BASE_URL: str = "http://localhost:8000"
    UPLOAD_DIR: str = "uploads"

    # Neon Object Storage (S3-compatible). When AWS_* are blank, uploads fall
    # back to the local UPLOAD_DIR (files are not persisted across redeploys).
    AWS_ACCESS_KEY_ID: str = ""
    AWS_SECRET_ACCESS_KEY: str = ""
    AWS_ENDPOINT_URL_S3: str = ""
    AWS_REGION: str = "us-east-2"
    STORAGE_BUCKET: str = "exam-focus-media"

    # SMTP (email notifications). Leave empty to disable email sending.
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM: str = "no-reply@examfocus.edu"
    SMTP_TLS: bool = True

    # SMS gateway placeholder (e.g., Africa's Talking / Twilio / local provider).
    SMS_PROVIDER: str = "console"  # "console" logs SMS to the server log (stub)
    SMS_API_KEY: str = ""

    # Live classroom provider settings
    LIVE_PROVIDER: str = "jitsi"  # jitsi | zoom | meet
    LIVE_JITSI_DOMAIN: str = "meet.jit.si"

    # CORS
    CORS_ORIGINS: list[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
    ]

    class Config:
        env_file = ".env"


@lru_cache
def get_settings() -> Settings:
    return Settings()