import json
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import init_db
from app.deps import get_current_user, get_optional_user
from app.db_models import User
from app.models import (
    BusinessMetrics,
    CommandRequest,
    CommandResponse,
    HealthResponse,
)
from app.routers import auth, integrations, profile
from app.services.business_context import build_business_context
from app.services.executor import execute_tasks
from app.services.orchestrator import orchestrate_command
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.db_models import CommandLog


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield


app = FastAPI(
    title=settings.app_name,
    description="AI Chief Operating Officer API — autonomous business execution",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins + ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(profile.router)
app.include_router(integrations.router)


def _active_ai_provider() -> str:
    if settings.ai_provider == "rules":
        return "rules"
    if settings.openai_api_key:
        return "openai"
    if settings.anthropic_api_key:
        return "anthropic"
    if settings.gemini_api_key:
        return "gemini"
    return "rules"


@app.get("/api/v1/health", response_model=HealthResponse)
async def health():
    return HealthResponse(status="ok", ai_provider=_active_ai_provider(), version="2.0.0")


@app.post("/api/v1/command", response_model=CommandResponse)
async def execute_command(
    req: CommandRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    context = await build_business_context(user, db)

    response = await orchestrate_command(
        command=req.command.strip(),
        ai_provider=settings.ai_provider,
        openai_key=settings.openai_api_key,
        anthropic_key=settings.anthropic_api_key,
        context=context,
    )

    integration_keys = {
        i.integration_id: i.api_key
        for i in user.integrations
        if i.connected and i.api_key
    }

    executed = await execute_tasks(response, context, integration_keys)

    log = CommandLog(
        user_id=user.id,
        command=executed.command,
        intent=executed.intent,
        summary=executed.summary,
        tasks_json=json.dumps([t.model_dump() for t in executed.tasks]),
    )
    db.add(log)
    await db.commit()

    return executed


@app.get("/api/v1/metrics", response_model=BusinessMetrics)
async def get_metrics(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    context = await build_business_context(user, db)
    live = context.live_metrics

    revenue = float(live.get("stripe_balance_usd", 124500)) if live else 124500
    customers = int(live.get("stripe_customers", 847)) if live and str(live.get("stripe_customers", "")).isdigit() else 847

    return BusinessMetrics(
        revenue=revenue,
        revenue_change=12.4,
        customers=customers,
        customers_change=8.2,
        conversion_rate=3.8,
        conversion_change=0.6,
        active_campaigns=6,
        pending_tasks=14,
        ai_actions_today=127,
    )


@app.get("/")
async def root():
    return {
        "app": "OperatorOS",
        "version": "2.0.0",
        "tagline": "Your AI Chief Operating Officer",
        "docs": "/docs",
    }
