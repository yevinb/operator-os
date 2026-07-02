"""User Brain configuration — competitors, keywords, 24/7 autopilot."""

from __future__ import annotations

import json

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db_models import UserBrainConfig


async def get_brain_config(db: AsyncSession, user_id: str) -> UserBrainConfig:
    result = await db.execute(select(UserBrainConfig).where(UserBrainConfig.user_id == user_id))
    row = result.scalar_one_or_none()
    if row:
        return row
    row = UserBrainConfig(user_id=user_id)
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return row


def config_to_dict(row: UserBrainConfig) -> dict:
    try:
        competitors = json.loads(row.competitors_json or "[]")
    except json.JSONDecodeError:
        competitors = []
    try:
        keywords = json.loads(row.brand_keywords_json or "[]")
    except json.JSONDecodeError:
        keywords = []
    try:
        enabled = json.loads(row.enabled_agents_json or "[]")
    except json.JSONDecodeError:
        enabled = []
    return {
        "competitors": competitors,
        "brand_keywords": keywords,
        "auto_run_daily": row.auto_run_daily,
        "last_auto_run_key": row.last_auto_run_key,
        "enabled_agents": enabled,
    }


async def update_brain_config(db: AsyncSession, user_id: str, patch: dict) -> dict:
    row = await get_brain_config(db, user_id)
    if "competitors" in patch:
        row.competitors_json = json.dumps(patch["competitors"][:20])
    if "brand_keywords" in patch:
        row.brand_keywords_json = json.dumps(patch["brand_keywords"][:30])
    if "auto_run_daily" in patch:
        row.auto_run_daily = bool(patch["auto_run_daily"])
    if "enabled_agents" in patch:
        row.enabled_agents_json = json.dumps(patch["enabled_agents"])
    await db.commit()
    await db.refresh(row)
    return config_to_dict(row)
