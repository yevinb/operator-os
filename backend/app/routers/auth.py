import uuid
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, field_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import settings
from app.database import get_db
from app.db_models import User
from app.deps import get_current_user
from app.services.business_context import ensure_profile
from app.services.security import (
    create_access_token,
    create_google_login_state,
    hash_password,
    verify_google_login_state,
    verify_password,
)

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])
# Login only — basic profile scopes (no Gmail). Anyone can sign in once app is In production.
# Gmail is connected separately via Integrations → Connect Gmail (requires Google verification for public use).
GOOGLE_LOGIN_SCOPES = "openid email profile"


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


@router.get("/google/start")
async def google_auth_start():
    if not settings.google_client_id or not settings.google_client_secret:
        raise HTTPException(
            status_code=503,
            detail="Google OAuth not configured on server. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.",
        )
    state = create_google_login_state()
    params = {
        "client_id": settings.google_client_id,
        "redirect_uri": settings.google_auth_redirect_uri,
        "response_type": "code",
        "scope": GOOGLE_LOGIN_SCOPES,
        "access_type": "online",
        "prompt": "select_account",
        "state": state,
    }
    return {"url": f"https://accounts.google.com/o/oauth2/v2/auth?{urlencode(params)}"}


@router.get("/google/callback")
async def google_auth_callback(
    code: str = Query(""),
    state: str = Query(""),
    db: AsyncSession = Depends(get_db),
):
    if not verify_google_login_state(state) or not code:
        return RedirectResponse(f"{settings.frontend_url}/login?error=google_oauth_failed")

    redirect_uri = settings.google_auth_redirect_uri
    async with httpx.AsyncClient(timeout=20) as client:
        token_resp = await client.post(
            "https://oauth2.googleapis.com/token",
            data={
                "code": code,
                "client_id": settings.google_client_id,
                "client_secret": settings.google_client_secret,
                "redirect_uri": redirect_uri,
                "grant_type": "authorization_code",
            },
        )
        if token_resp.status_code != 200:
            return RedirectResponse(f"{settings.frontend_url}/login?error=google_token_exchange_failed")
        tokens = token_resp.json()
        access_token = tokens.get("access_token", "")
        user_resp = await client.get(
            "https://www.googleapis.com/oauth2/v3/userinfo",
            headers={"Authorization": f"Bearer {access_token}"},
        )

    if user_resp.status_code != 200:
        return RedirectResponse(f"{settings.frontend_url}/login?error=google_userinfo_failed")

    info = user_resp.json()
    email = (info.get("email") or "").lower().strip()
    name = (info.get("name") or "Google User").strip()
    google_id = (info.get("sub") or "").strip()
    if not email:
        return RedirectResponse(f"{settings.frontend_url}/login?error=google_email_missing")

    user = None
    if google_id:
        result = await db.execute(
            select(User)
            .where(User.google_id == google_id)
            .options(selectinload(User.profile))
        )
        user = result.scalar_one_or_none()
    if not user:
        result = await db.execute(
            select(User).where(User.email == email).options(selectinload(User.profile))
        )
        user = result.scalar_one_or_none()

    is_new = user is None
    if is_new:
        company_guess = ((email.split("@")[0] or "My")[:30] + " Company").strip()
        user = User(
            id=f"user_{uuid.uuid4().hex[:12]}",
            email=email,
            google_id=google_id or None,
            name=name,
            company=company_guess,
            password_hash="",
            plan="starter",
            onboarded=True,
        )
        db.add(user)
        await db.flush()
        profile = await ensure_profile(db, user.id)
        if not profile.goal:
            profile.goal = "Grow revenue"
        if not profile.market:
            profile.market = "Global"
        if not profile.niche_mode:
            profile.niche_mode = "general"
    else:
        if name and user.name != name:
            user.name = name
        if google_id and not user.google_id:
            user.google_id = google_id
        # Google sign-in = skip onboarding wizard on every return
        user.onboarded = True
        await ensure_profile(db, user.id)

    await db.commit()
    await db.refresh(user, ["profile"])

    token = create_access_token(user.id)
    return RedirectResponse(f"{settings.frontend_url}/login?google_token={token}")


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
