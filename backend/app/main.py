from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.models import (
    CommandRequest,
    CommandResponse,
    BusinessMetrics,
    HealthResponse,
)
from app.services.orchestrator import orchestrate_command
from app.routers import auth, integrations

app = FastAPI(
    title=settings.app_name,
    description="AI Chief Operating Officer API — autonomous business execution",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
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
    return HealthResponse(status="ok", ai_provider=_active_ai_provider())


@app.post("/api/v1/command", response_model=CommandResponse)
async def execute_command(req: CommandRequest):
    return await orchestrate_command(
        command=req.command.strip(),
        ai_provider=settings.ai_provider,
        openai_key=settings.openai_api_key,
        anthropic_key=settings.anthropic_api_key,
    )


@app.get("/api/v1/metrics", response_model=BusinessMetrics)
async def get_metrics():
    return BusinessMetrics(
        revenue=124500,
        revenue_change=12.4,
        customers=847,
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
        "tagline": "Your AI Chief Operating Officer",
        "docs": "/docs",
        "stack": ["FastAPI", "PostgreSQL", "Redis", "GPT", "Claude", "Gemini", "n8n", "MCP"],
    }
