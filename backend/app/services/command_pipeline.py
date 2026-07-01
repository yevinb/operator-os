"""Unified command execution — one path for chat, command center, autopilot, and control."""

import json

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db_models import CommandLog, IntegrationConnection, User
from app.models import CommandResponse
from app.services.business_context import BusinessContext, build_business_context
from app.services.business_snapshot import build_business_snapshot
from app.services.execution_bundle import ExecutionBundle
from app.services.executor import execute_tasks
from app.services.integrations.providers import parse_config
from app.services.nexa_engine import build_marketing_plan, parse_outcome, save_active_plan
from app.services.orchestrator import orchestrate_command


async def run_command_pipeline(
    command: str,
    user: User,
    db: AsyncSession,
    *,
    context: BusinessContext | None = None,
    bundle: ExecutionBundle | None = None,
    log: bool = True,
) -> tuple[CommandResponse, ExecutionBundle]:
    """Orchestrate → execute with shared bundle → save plan → optional log."""
    text = command.strip()
    if context is None:
        context = await build_business_context(user, db)

    response = await orchestrate_command(
        command=text,
        ai_provider=settings.ai_provider,
        openai_key=settings.openai_api_key,
        anthropic_key=settings.anthropic_api_key,
        context=context,
    )

    fresh = await db.execute(
        select(IntegrationConnection).where(
            IntegrationConnection.user_id == user.id,
            IntegrationConnection.connected == True,  # noqa: E712
        )
    )
    integration_data = {
        c.integration_id: {
            "api_key": c.api_key or "",
            "config": parse_config(c.config_json),
        }
        for c in fresh.scalars().all()
    }
    context = await build_business_context(user, db)

    if bundle is None:
        snap = await build_business_snapshot(
            context.company,
            context.connected_integrations,
            integration_data,
            cache_key=user.id,
        )
        bundle = ExecutionBundle.from_snapshot(text, context.company, snap)

    executed = await execute_tasks(
        response,
        context,
        integration_data,
        db=db,
        user_id=user.id,
        bundle=bundle,
    )

    outcome = parse_outcome(text)
    marketing_plan = build_marketing_plan(text, context, outcome)
    plan = await save_active_plan(db, user.id, executed.command, executed, outcome, marketing_plan)
    executed = executed.model_copy(
        update={
            "marketing_plan": marketing_plan,
            "plan_id": plan.id,
            "outcome": outcome,
        }
    )

    if log:
        db.add(
            CommandLog(
                user_id=user.id,
                command=executed.command,
                intent=executed.intent,
                summary=executed.summary,
                tasks_json=json.dumps([t.model_dump() for t in executed.tasks]),
            )
        )

    return executed, bundle
