from pydantic import BaseModel
from enum import Enum


class TaskStatus(str, Enum):
    pending = "pending"
    running = "running"
    completed = "completed"
    failed = "failed"
    planned = "planned"


class Task(BaseModel):
    id: str
    action: str
    category: str
    status: TaskStatus = TaskStatus.pending
    detail: str | None = None
    integration: str | None = None


class CommandRequest(BaseModel):
    command: str


class CommandResponse(BaseModel):
    command: str
    intent: str
    summary: str
    tasks: list[Task]
    executed_count: int = 0
    planned_count: int = 0
    failed_count: int = 0
    mode: str = "live"
    marketing_plan: str | None = None
    plan_id: int | None = None
    outcome: dict | None = None


class BusinessMetrics(BaseModel):
    revenue: float
    revenue_change: float
    customers: int
    customers_change: float
    conversion_rate: float
    conversion_change: float
    active_campaigns: int
    pending_tasks: int
    ai_actions_today: int
    stripe_connected: bool = False
    data_source: str = "none"  # stripe | commands | none


class HealthResponse(BaseModel):
    status: str
    ai_provider: str
    version: str = "2.0.0"
