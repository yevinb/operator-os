import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, field_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.db_models import User
from app.deps import get_current_user
from app.services.business_context import ensure_profile
from app.services.security import create_access_token, hash_password, verify_password

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


class SignupRequest(BaseModel):
    email: str
    name: str
    company: str
    password: str

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        v = (v or "").strip()
        if len(v) < 6:
            raise ValueError("Password must be at least 6 characters")
        return v


class LoginRequest(BaseModel):
    email: str
    password: str


class AuthResponse(BaseModel):
    token: str
    user: "UserOut"


class UserOut(BaseModel):
    id: str
    email: str
    name: str
    company: str
    plan: str = "starter"
    onboarded: bool = False
    industry: str = ""
    goal: str = ""
    market: str = ""


def _user_out(user: User) -> UserOut:
    profile = user.profile
    return UserOut(
        id=user.id,
        email=user.email,
        name=user.name,
        company=user.company,
        plan=user.plan,
        onboarded=user.onboarded,
        industry=profile.industry if profile else "",
        goal=profile.goal if profile else "",
        market=profile.market if profile else "",
    )


@router.post("/signup", response_model=AuthResponse)
async def signup(req: SignupRequest, db: AsyncSession = Depends(get_db)):
    existing = await db.execute(select(User).where(User.email == req.email.lower()))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")

    user = User(
        id=f"user_{uuid.uuid4().hex[:12]}",
        email=req.email.lower().strip(),
        name=req.name.strip(),
        company=req.company.strip(),
        password_hash=hash_password(req.password),
        plan="starter",
        onboarded=False,
    )
    db.add(user)
    await db.flush()
    await ensure_profile(db, user.id)
    await db.commit()
    await db.refresh(user, ["profile"])

    token = create_access_token(user.id)
    return AuthResponse(token=token, user=_user_out(user))


@router.post("/login", response_model=AuthResponse)
async def login(req: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(User)
        .where(User.email == req.email.lower().strip())
        .options(selectinload(User.profile))
    )
    user = result.scalar_one_or_none()
    if not user or not verify_password(req.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = create_access_token(user.id)
    return AuthResponse(token=token, user=_user_out(user))


@router.get("/me", response_model=UserOut)
async def me(user: User = Depends(get_current_user)):
    return _user_out(user)
