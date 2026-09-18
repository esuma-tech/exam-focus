import mimetypes
import uuid
from io import BytesIO
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import FileResponse

from ..config import get_settings
from ..deps import get_current_user
from ..models import User
from ..services import storage

router = APIRouter(prefix="/uploads", tags=["uploads"])
settings = get_settings()

ALLOWED_EXTENSIONS = {
    "image": {".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg"},
    "document": {".pdf", ".doc", ".docx", ".ppt", ".pptx", ".xls", ".xlsx", ".txt", ".md"},
    "video": {".mp4", ".webm", ".mov", ".mkv"},
    "audio": {".mp3", ".ogg", ".wav", ".m4a"},
}
MAX_SIZE = 250 * 1024 * 1024  # 250 MB


def _upload_dir() -> Path:
    path = Path(settings.UPLOAD_DIR).resolve()
    path.mkdir(parents=True, exist_ok=True)
    return path


@router.post("")
def upload_file(file: UploadFile = File(...), _: User = Depends(get_current_user)):
    ext = Path(file.filename or "").suffix.lower()
    kind = None
    for cat, exts in ALLOWED_EXTENSIONS.items():
        if ext in exts:
            kind = cat
            break
    if kind is None:
        raise HTTPException(status_code=400, detail="File type not allowed")

    # Read the stream into memory (capped) so we can hand it to S3 or disk.
    buf = BytesIO()
    size = 0
    while chunk := file.file.read(1024 * 1024):
        size += len(chunk)
        if size > MAX_SIZE:
            raise HTTPException(status_code=413, detail="File too large")
        buf.write(chunk)
    buf.seek(0)

    if storage.storage_enabled():
        key = f"media/{uuid.uuid4().hex[:20]}{ext}"
        content_type = mimetypes.guess_type(file.filename or "")[0] or "application/octet-stream"
        url = storage.put_object(key, buf, content_type)
        return {
            "filename": key,
            "original_name": file.filename,
            "kind": kind,
            "size": size,
            "url": url,
            "absolute_url": url,
        }

    # Local fallback (dev machines / storage not configured).
    filename = f"{uuid.uuid4().hex[:16]}{ext}"
    dest = _upload_dir() / filename
    with dest.open("wb") as out:
        buf.seek(0)
        while chunk := buf.read(1024 * 1024):
            out.write(chunk)
    return {
        "filename": filename,
        "original_name": file.filename,
        "kind": kind,
        "size": size,
        "url": f"{settings.API_PREFIX}/uploads/{filename}",
        "absolute_url": f"{settings.PUBLIC_BASE_URL}{settings.API_PREFIX}/uploads/{filename}",
    }


@router.get("/{filename}")
def serve_file(filename: str):
    safe = Path(filename).name
    path = _upload_dir() / safe
    if not path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(path)