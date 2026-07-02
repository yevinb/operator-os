"""24/7 Brain scheduler — auto morning cycle for users with autopilot enabled."""

from __future__ import annotations

import asyncio
import logging

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.config import settings
from app.database import SessionLocal
from app.db_models import User, UserBrainConfig
from app.services.brain_config import config_to_dict
from app.services.brain_service import morning_cycle

logger = logging.getLogger("nexa.brain.scheduler")

_scheduler_task: asyncio.Task | None = None


async def _run_auto_cycles() -> None:
    from datetime import datetime, timezone

    day = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    async with SessionLocal() as db:
        result = await db.execute(
            select(UserBrainConfig).where(UserBrainConfig.auto_run_daily == True)  # noqa: E712
        )
        configs = result.scalars().all()
        for cfg in configs:
            if cfg.last_auto_run_key == day:
                continue
            user_result = await db.execute(
                select(User)
                .where(User.id == cfg.user_id)
                .options(selectinload(User.integrations), selectinload(User.profile))
            )
            user = user_result.scalar_one_or_none()
            if not user:
                continue
            try:
                await morning_cycle(db, user)
                cfg.last_auto_run_key = day
                await db.commit()
                logger.info("Brain auto cycle completed for user %s", user.id)
            except Exception as e:
                logger.warning("Brain auto cycle failed for %s: %s", cfg.user_id, e)


async def _scheduler_loop() -> None:
    while True:
        try:
            await _run_auto_cycles()
        except Exception as e:
            logger.warning("Brain scheduler tick error: %s", e)
        await asyncio.sleep(3600)  # check hourly


def start_brain_scheduler() -> None:
    global _scheduler_task
    if _scheduler_task is not None:
        return
    _scheduler_task = asyncio.create_task(_scheduler_loop())


async def run_cron_for_all_users(secret: str) -> dict:
    if not settings.brain_cron_secret or secret != settings.brain_cron_secret:
        return {"ok": False, "error": "Invalid cron secret"}
    await _run_auto_cycles()
    return {"ok": True}
