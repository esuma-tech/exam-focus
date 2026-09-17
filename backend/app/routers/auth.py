from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user
from ..models import AnalyticsEvent, User
from ..schemas import LoginRequest, Message, RegisterRequest, TokenResponse
from ..security import create_access_token, create_refresh_token, decode_token, hash_password, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])


def _issue_tokens(user: User) -> TokenResponse:
    return TokenResponse(
        access_token=create_access_token(user.id, user.role),
        refresh_token=create_refresh_token(user.id),
        user=user,
    )


@router.post("/register", response_model=Message, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == payload.email.lower()).first()
    if existing:
        raise HTTPException(status_code=409, detail="An account with this email already exists")
    user = User(
        email=payload.email.lower(),
        full_name=payload.full_name.strip(),
        phone=payload.phone,
        grade=payload.grade,
        role=payload.role,
        password_hash=hash_password(payload.password),
        is_active=True,
        is_approved=False,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    db.add(AnalyticsEvent(event_name="user.registered", entity="user", entity_id=user.id, user_id=user.id))
    db.commit()
    return Message(message="Your account was created. An administrator must approve it before you can log in.")


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email.lower()).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is disabled")
    if not user.is_approved:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account is pending approval by an administrator.",
        )
    db.add(AnalyticsEvent(event_name="user.login", entity="user", entity_id=user.id, user_id=user.id))
    db.commit()
    return _issue_tokens(user)


@router.post("/refresh", response_model=TokenResponse)
def refresh(payload: dict, db: Session = Depends(get_db)):
    data = decode_token(payload.get("refresh_token", ""))
    if not data or data.get("type") != "refresh":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")
    user = db.get(User, int(data["sub"]))
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return _issue_tokens(user)


@router.get("/me", response_model=TokenResponse)
def me(user: User = Depends(get_current_user)):
    return _issue_tokens(user)


@router.post("/logout", response_model=Message)
def logout(user: User = Depends(get_current_user)):
    return Message(message="Logged out")