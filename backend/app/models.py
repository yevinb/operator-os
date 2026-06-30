from pydantic import BaseModel
from enum import Enum


class TaskStatus(str, Enum):
    pending = "pending"
    running = "running"
    completed = "completed"
    failed = "failed"


class Task(BaseModel):
    id: str
    action: str
    category: str
    status: TaskStatus = TaskStatus.pending
    detail: str | None = None


class CommandRequest(BaseModel):
    command: str


class CommandResponse(BaseModel):
    command: str
    intent: str
    summary: str
    tasks: list[Task]


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


class HealthResponse(BaseModel):
    status: str
    ai_provider: str
    version: str = "0.1.0"
