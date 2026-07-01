"""Business snapshot and graph API."""

import json

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.db_models import ExecutionRun, User
from app.deps import get_current_user
from app.services.business_context import build_business_context
from app.services.business_graph import integration_relationships
from app.services.business_snapshot import build_business_snapshot
from app.services.integrations.providers import parse_config

router = APIRouter(prefix="/api/v1/business", tags=["business"])


@router.get("/snapshot")
async def get_business_snapshot(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    from sqlalchemy.orm import selectinload
    from sqlalchemy import select

    result = await db.execute(
        select(User)
        .where(User.id == user.id)
        .options(selectinload(User.integrations), selectinload(User.profile))
    )
    full_user = result.scalar_one()
    context = await build_business_context(full_user, db)
    integration_data = {
        i.integration_id: {
            "api_key": i.api_key or "",
            "config": parse_config(i.config_json),
        }
        for i in full_user.integrations
        if i.connected
    }
    snap = await build_business_snapshot(
        context.company,
        context.connected_integrations,
        integration_data,
        cache_key=user.id,
    )
    return {
        "company": context.company,
        "goal": context.goal,
        "industry": context.industry,
        "connected_integrations": context.connected_integrations,
        "metrics": snap.metrics,
        "sources": snap.sources,
        "narrative": snap.narrative,
        "business_narrative": context.business_narrative or snap.narrative,
        "updated_at": snap.updated_at,
    }


@router.get("/graph")
async def get_business_graph(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    context = await build_business_context(user, db)
    return integration_relationships(context.connected_integrations, context.goal)


@router.get("/entities")
async def list_business_entities(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    limit: int = 50,
):
    from app.db_models import BusinessEntity

    result = await db.execute(
        select(BusinessEntity)
        .where(BusinessEntity.user_id == user.id)
        .order_by(BusinessEntity.updated_at.desc())
        .limit(limit)
    )
    entities = []
    for e in result.scalars().all():
        try:
            external_ids = json.loads(e.external_ids_json or "{}")
        except json.JSONDecodeError:
            external_ids = {}
        entities.append(
            {
                "id": e.id,
                "type": e.entity_type,
                "name": e.name,
                "email": e.email,
                "external_ids": external_ids,
                "updated_at": e.updated_at.isoformat() if e.updated_at else None,
            }
        )
    return {"entities": entities, "count": len(entities)}


@router.get("/executions/latest")
async def get_latest_execution(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ExecutionRun)
        .where(ExecutionRun.user_id == user.id)
        .order_by(ExecutionRun.created_at.desc())
        .limit(1)
    )
    run = result.scalar_one_or_none()
    if not run:
        return {"active": False}
    try:
        bundle = json.loads(run.bundle_json or "{}")
    except json.JSONDecodeError:
        bundle = {}
    return {
        "active": True,
        "id": run.id,
        "command": run.command,
        "verified_count": run.verified_count,
        "bundle": bundle,
        "created_at": run.created_at.isoformat() if run.created_at else None,
    }
