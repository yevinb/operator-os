from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.db_models import User
from app.deps import get_current_user
from app.services.business_context import ensure_profile

router = APIRouter(prefix="/api/v1/profile", tags=["profile"])


class ProfileUpdate(BaseModel):
    company: str | None = None
    industry: str | None = None
    goal: str | None = None
    market: str | None = None
    description: str | None = None
    website: str | None = None
    onboarded: bool | None = None
    plan: str | None = None
    niche_mode: str | None = None


class ProfileOut(BaseModel):
    company: str
    industry: str
    goal: str
    market: str
    description: str
    website: str
    onboarded: bool
    plan: str
    niche_mode: str


@router.get("", response_model=ProfileOut)
async def get_profile(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    profile = await ensure_profile(db, user.id)
    return ProfileOut(
        company=user.company,
        industry=profile.industry,
        goal=profile.goal,
        market=profile.market,
        description=profile.description,
        website=profile.website,
        onboarded=user.onboarded,
        plan=user.plan,
        niche_mode=profile.niche_mode or "general",
    )


@router.patch("", response_model=ProfileOut)
async def update_profile(
    body: ProfileUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    profile = await ensure_profile(db, user.id)

    if body.company is not None:
        user.company = body.company
    if body.onboarded is not None:
        user.onboarded = body.onboarded
    if body.plan is not None:
        user.plan = body.plan
    if body.industry is not None:
        profile.industry = body.industry
    if body.goal is not None:
        profile.goal = body.goal
    if body.market is not None:
        profile.market = body.market
    if body.description is not None:
        profile.description = body.description
    if body.website is not None:
        profile.website = body.website
    if body.niche_mode is not None:
        profile.niche_mode = body.niche_mode

    await db.commit()
    await db.refresh(user)
    await db.refresh(profile)

    return ProfileOut(
        company=user.company,
        industry=profile.industry,
        goal=profile.goal,
        market=profile.market,
        description=profile.description,
        website=profile.website,
        onboarded=user.onboarded,
        plan=user.plan,
        niche_mode=profile.niche_mode or "general",
    )
