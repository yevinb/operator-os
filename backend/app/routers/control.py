"""Cursor / MCP / agent control API — full Nexa business operations."""

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.control_deps import get_control_user
from app.database import get_db
from app.db_models import IntegrationConnection, User
from app.services.ai_clients import active_provider_name
from app.services.autopilot import run_autopilot, run_raw_command
from app.services.business_context import build_business_context
from app.services.chat import handle_chat
from app.services.email_dispatch import try_direct_gmail_send
from app.services.integration_verify import verify_integration
from app.services.integrations.providers import parse_config

router = APIRouter(prefix="/api/v1/control", tags=["control"])


class RunRequest(BaseModel):
    command: str


class EmailRequest(BaseModel):
    message: str = Field(..., description="Natural language email command, e.g. email client@co.com about our offer")


class ChatRequest(BaseModel):
    message: str
    history: list[dict] = []


class AutopilotRequest(BaseModel):
    mode: str = "growth"  # full | growth | sales | ops
    steps: list[str] | None = None


class BatchRequest(BaseModel):
    commands: list[str]


@router.get("/status")
async def control_status(
    user: User = Depends(get_control_user),
    db: AsyncSession = Depends(get_db),
):
    """Full business snapshot for Cursor agents."""
    context = await build_business_context(user, db)
    return {
        "nexa": "online",
        "ai_provider": active_provider_name(),
        "control_api": bool(settings.nexa_control_key),
        "user": {
            "id": user.id,
            "email": user.email,
            "name": user.name,
            "company": user.company,
            "plan": user.plan,
        },
        "business": {
            "company": context.company,
            "industry": context.industry,
            "goal": context.goal,
            "market": context.market,
            "niche_mode": context.niche_mode,
        },
        "connected_integrations": context.connected_integrations,
        "live_metrics": context.live_metrics,
        "integration_snapshots": context.integration_snapshots,
        "business_narrative": context.business_narrative,
        "powered_by": "cursor",
        "engine": "cursor_agent",
    }


@router.post("/run")
async def control_run(
    body: RunRequest,
    user: User = Depends(get_control_user),
    db: AsyncSession = Depends(get_db),
):
    """Execute any business command across all connected integrations."""
    result = await run_raw_command(body.command, user, db)
    return {"ok": True, "result": result}


@router.post("/email")
async def control_email(
    body: EmailRequest,
    user: User = Depends(get_control_user),
    db: AsyncSession = Depends(get_db),
):
    """Send an intelligent Gmail email immediately."""
    context = await build_business_context(user, db)
    result = await try_direct_gmail_send(
        body.message,
        user.id,
        context.company,
        db,
        context=context,
        history=[],
        sender_name=user.name,
    )
    if result:
        await db.commit()
        return {"ok": result.get("executed", False), **result}
    return {"ok": False, "reply": "Not recognized as an email command", "executed": False}


@router.post("/chat")
async def control_chat(
    body: ChatRequest,
    user: User = Depends(get_control_user),
    db: AsyncSession = Depends(get_db),
):
    """Nexa chat with autonomous execution (same as dashboard)."""
    result = await handle_chat(body.message, body.history, user, db)
    return {"ok": True, **result}


@router.post("/autopilot")
async def control_autopilot(
    body: AutopilotRequest,
    user: User = Depends(get_control_user),
    db: AsyncSession = Depends(get_db),
):
    """Run a full business cycle — growth, sales, ops, or everything."""
    result = await run_autopilot(body.mode, user, db, custom_steps=body.steps)
    return {"ok": True, **result}


@router.post("/batch")
async def control_batch(
    body: BatchRequest,
    user: User = Depends(get_control_user),
    db: AsyncSession = Depends(get_db),
):
    """Run multiple commands in sequence from Cursor."""
    outputs = []
    for cmd in body.commands[:20]:
        try:
            chat = await handle_chat(cmd, [], user, db)
            outputs.append({"command": cmd, **chat})
        except Exception as e:
            outputs.append({"command": cmd, "ok": False, "error": str(e)})
    return {"ok": True, "count": len(outputs), "results": outputs}


@router.get("/integrations")
async def control_integrations(
    user: User = Depends(get_control_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(IntegrationConnection).where(IntegrationConnection.user_id == user.id)
    )
    conns = result.scalars().all()
    return {
        "connected": [
            {
                "id": c.integration_id,
                "connected": c.connected,
                "connected_at": c.connected_at.isoformat() if c.connected_at else None,
            }
            for c in conns
            if c.connected
        ]
    }


@router.post("/integrations/test-all")
async def control_test_integrations(
    user: User = Depends(get_control_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(IntegrationConnection).where(
            IntegrationConnection.user_id == user.id,
            IntegrationConnection.connected == True,  # noqa: E712
        )
    )
    rows = []
    for conn in result.scalars().all():
        ok, msg = await verify_integration(
            conn.integration_id, conn.api_key or "", conn.config_json or "{}"
        )
        rows.append({"id": conn.integration_id, "ok": ok, "message": msg})
    return {"ok": True, "tests": rows}
