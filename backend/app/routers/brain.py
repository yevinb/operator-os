from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.db_models import User
from app.deps import get_current_user
from app.services.brain_service import (
    get_brain_feed,
    get_brain_status,
    get_daily_brief,
    get_weekly_report,
    ingest_url,
    learn_today,
    list_agents,
    morning_cycle,
    run_agent,
    run_all_active_agents,
)
from app.services.brain_config import config_to_dict, get_brain_config, update_brain_config
from app.services.brain_scheduler import run_cron_for_all_users
from app.services.business_context import build_business_context

router = APIRouter(prefix="/api/v1/brain", tags=["brain"])


class IngestUrlRequest(BaseModel):
    url: str


class BrainConfigPatch(BaseModel):
    competitors: list[str] | None = None
    brand_keywords: list[str] | None = None
    auto_run_daily: bool | None = None
    enabled_agents: list[str] | None = None


@router.get("/status")
async def brain_status(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await get_brain_status(db, user)


@router.get("/agents")
async def brain_agents(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    context = await build_business_context(user, db)
    return {"agents": list_agents(context)}


@router.get("/daily-brief")
async def daily_brief(
    refresh: bool = Query(False),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await get_daily_brief(db, user, refresh=refresh)


@router.get("/weekly-report")
async def weekly_report(
    refresh: bool = Query(False),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await get_weekly_report(db, user, refresh=refresh)


@router.get("/feed")
async def brain_feed(
    limit: int = Query(30, ge=1, le=100),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return {"items": await get_brain_feed(db, user, limit=limit)}


@router.post("/learn")
async def brain_learn(
    force: bool = Query(False),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    learned = await learn_today(db, user, force=force)
    return {"ok": True, "learned": learned}


@router.post("/ingest-url")
async def brain_ingest_url(
    body: IngestUrlRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await ingest_url(db, user, body.url)


@router.post("/agents/{agent_id}/run")
async def brain_run_agent(
    agent_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await run_agent(db, user, agent_id)


@router.post("/run-all")
async def brain_run_all(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await run_all_active_agents(db, user)


@router.post("/morning-cycle")
async def brain_morning_cycle(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await morning_cycle(db, user)


@router.get("/config")
async def brain_get_config(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    row = await get_brain_config(db, user.id)
    return config_to_dict(row)


@router.patch("/config")
async def brain_patch_config(
    body: BrainConfigPatch,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    patch = body.model_dump(exclude_none=True)
    return await update_brain_config(db, user.id, patch)


@router.post("/cron")
async def brain_cron(secret: str = Query("")):
    return await run_cron_for_all_users(secret)
