import json
from contextlib import asynccontextmanager
from datetime import datetime, timezone

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
from app.routers import auth, business, control, integrations, nexa, oauth_google, profile
from app.services.business_context import build_business_context
from app.services.executor import execute_tasks
from app.services.nexa_engine import build_marketing_plan, parse_outcome, save_active_plan
from app.services.orchestrator import orchestrate_command
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.db_models import CommandLog
from app.services.integrations.providers import parse_config


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield


app = FastAPI(
    title=settings.app_name,
    description="AI Chief Operating Officer API — autonomous business execution",
    version="3.0.0",
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
app.include_router(oauth_google.router)
app.include_router(nexa.router)
app.include_router(control.router)
app.include_router(business.router)


from app.services.ai_clients import active_provider_name


@app.get("/api/v1/health", response_model=HealthResponse)
async def health():
    return HealthResponse(status="ok", ai_provider=active_provider_name(), version="2.0.0")


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

    integration_data = {
        i.integration_id: {
            "api_key": i.api_key or "",
            "config": parse_config(i.config_json),
        }
        for i in user.integrations
        if i.connected
    }

    executed = await execute_tasks(response, context, integration_data, db=db, user_id=user.id)

    outcome = parse_outcome(req.command.strip())
    marketing_plan = build_marketing_plan(req.command.strip(), context, outcome)
    plan = await save_active_plan(db, user.id, executed.command, executed, outcome, marketing_plan)

    executed = executed.model_copy(
        update={
            "marketing_plan": marketing_plan,
            "plan_id": plan.id,
            "outcome": outcome,
            "summary": f"Here's your plan — I'm executing it. {executed.summary}",
        }
    )

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
    connected = context.connected_integrations

    stripe_connected = "stripe" in connected and bool(live)
    revenue = float(live.get("stripe_balance_usd", 0)) if stripe_connected else 0.0
    customers_raw = live.get("stripe_customers", 0) if stripe_connected else 0
    customers = int(customers_raw) if str(customers_raw).isdigit() else 0

    marketing = [i for i in ("google-ads", "meta") if i in connected]

    # Count real executed tasks from today's command logs
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    logs_result = await db.execute(
        select(CommandLog).where(
            CommandLog.user_id == user.id,
            CommandLog.created_at >= today_start,
        )
    )
    logs = logs_result.scalars().all()
    ai_actions_today = 0
    pending_tasks = 0
    for log in logs:
        try:
            tasks = json.loads(log.tasks_json or "[]")
            for t in tasks:
                if t.get("status") == "completed":
                    ai_actions_today += 1
                elif t.get("status") == "planned":
                    pending_tasks += 1
        except json.JSONDecodeError:
            pass

    data_source = "stripe" if stripe_connected else ("commands" if ai_actions_today else "none")

    return BusinessMetrics(
        revenue=revenue,
        revenue_change=0.0,
        customers=customers,
        customers_change=0.0,
        conversion_rate=0.0,
        conversion_change=0.0,
        active_campaigns=len(marketing),
        pending_tasks=pending_tasks,
        ai_actions_today=ai_actions_today,
        stripe_connected=stripe_connected,
        data_source=data_source,
    )


@app.get("/")
async def root():
    return {
        "app": "Nexa",
        "version": "2.0.0",
        "tagline": "Your AI Chief Operating Officer",
        "docs": "/docs",
    }
