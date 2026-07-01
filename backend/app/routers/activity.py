"""Server-backed activity log from command executions."""

import json

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.db_models import CommandLog, ExecutionRun, User
from app.deps import get_current_user

router = APIRouter(prefix="/api/v1/activity", tags=["activity"])


@router.get("")
async def list_activity(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    limit: int = Query(default=50, le=100),
):
    logs_result = await db.execute(
        select(CommandLog)
        .where(CommandLog.user_id == user.id)
        .order_by(CommandLog.created_at.desc())
        .limit(limit)
    )
    runs_result = await db.execute(
        select(ExecutionRun)
        .where(ExecutionRun.user_id == user.id)
        .order_by(ExecutionRun.created_at.desc())
        .limit(limit)
    )

    items: list[dict] = []

    for log in logs_result.scalars().all():
        try:
            tasks = json.loads(log.tasks_json or "[]")
        except json.JSONDecodeError:
            tasks = []
        completed = sum(1 for t in tasks if t.get("status") == "completed")
        failed = sum(1 for t in tasks if t.get("status") == "failed")
        planned = sum(1 for t in tasks if t.get("status") == "planned")
        item_type = "success" if completed else ("alert" if failed else "command")
        items.append(
            {
                "id": f"log-{log.id}",
                "type": item_type,
                "message": log.summary or log.command[:200],
                "command": log.command,
                "intent": log.intent,
                "category": "execution",
                "completed": completed,
                "planned": planned,
                "failed": failed,
                "tasks": tasks,
                "timestamp": log.created_at.isoformat() if log.created_at else None,
            }
        )

    for run in runs_result.scalars().all():
        try:
            bundle = json.loads(run.bundle_json or "{}")
        except json.JSONDecodeError:
            bundle = {}
        items.append(
            {
                "id": f"run-{run.id}",
                "type": "action",
                "message": f"Execution chain: {run.command[:120]}",
                "command": run.command,
                "intent": "execution_chain",
                "category": "bundle",
                "completed": run.verified_count,
                "bundle": bundle,
                "timestamp": run.created_at.isoformat() if run.created_at else None,
            }
        )

    items.sort(key=lambda x: x.get("timestamp") or "", reverse=True)
    return {"items": items[:limit]}
