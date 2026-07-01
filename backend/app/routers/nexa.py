import json

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.db_models import User
from app.deps import get_current_user
from app.services.business_context import build_business_context, ensure_profile
from app.services.chat import handle_chat
from app.services.nexa_engine import (
    coach_reply,
    get_active_plan,
    get_or_create_check_in,
)
from app.services.niche_modes import NICHES, get_niche, random_business_idea

router = APIRouter(prefix="/api/v1/nexa", tags=["nexa"])


class CoachRequest(BaseModel):
    message: str
    step: int = 0


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    message: str
    history: list[ChatMessage] = []


class ChatResponse(BaseModel):
    reply: str
    executed: bool = False
    command_response: dict | None = None


class NicheOut(BaseModel):
    id: str
    label: str
    emoji: str
    tagline: str
    sample_outcomes: list[str]


@router.get("/niches")
async def list_niches():
    return [
        NicheOut(
            id=n.id,
            label=n.label,
            emoji=n.emoji,
            tagline=n.tagline,
            sample_outcomes=list(n.sample_outcomes),
        )
        for n in NICHES.values()
    ]


@router.get("/business-idea")
async def roll_business_idea(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    context = await build_business_context(user, db)
    return random_business_idea(context.niche_mode, context.market)


@router.get("/check-in")
async def daily_check_in(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    context = await build_business_context(user, db)
    return await get_or_create_check_in(db, user.id, context)


@router.get("/plan")
async def active_plan(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    plan = await get_active_plan(db, user.id)
    if not plan:
        return {"active": False}
    return {
        "active": True,
        "id": plan.id,
        "command": plan.command,
        "summary": plan.summary,
        "marketing_plan": plan.marketing_plan,
        "outcome": json.loads(plan.outcome_json or "{}"),
        "tasks": json.loads(plan.tasks_json or "[]"),
        "executed_count": plan.executed_count,
        "created_at": plan.created_at.isoformat() if plan.created_at else None,
    }


@router.post("/coach")
async def coach_chat(body: CoachRequest):
    return coach_reply(body.message, body.step)


@router.post("/chat", response_model=ChatResponse)
async def nexa_chat(
    body: ChatRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    history = [{"role": m.role, "content": m.content} for m in body.history]
    result = await handle_chat(body.message, history, user, db)
    return ChatResponse(**result)


@router.patch("/niche/{niche_id}")
async def set_niche(
    niche_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    niche = get_niche(niche_id)
    profile = await ensure_profile(db, user.id)
    profile.niche_mode = niche.id
    await db.commit()
    return {"niche_mode": niche.id, "label": niche.label}
