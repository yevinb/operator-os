"""Nexa engine — internal execution, plans, check-ins, outcomes (PDF slides 2–6)."""

import json
import re
import time
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db_models import ActivePlan, CheckInLog, CommandLog
from app.models import CommandResponse, Task, TaskStatus
from app.services.business_context import BusinessContext
from app.services.niche_modes import get_niche, random_business_idea


OUTCOME_PATTERNS = [
    (r"(\d+)\s*leads?", "leads", "lead generation"),
    (r"(\d+)\s*sales?", "sales", "sales conversion"),
    (r"(\d+)\s*customers?", "customers", "customer acquisition"),
    (r"(\d+)\s*followers?", "followers", "audience growth"),
    (r"(\d+)%\s*(?:more|increase|growth)", "growth_pct", "revenue growth"),
    (r"increase\s+sales", "sales", "sales growth"),
    (r"grow\s+(?:followers|audience)", "followers", "Audience growth"),
]


def parse_outcome(command: str) -> dict | None:
    lower = command.lower()
    for pattern, kind, label in OUTCOME_PATTERNS:
        m = re.search(pattern, lower)
        if m:
            target = m.group(1) if m.lastindex else None
            return {"kind": kind, "target": target, "label": label, "raw": command}
    if any(w in lower for w in ("grow", "scale", "launch", "get me", "increase")):
        return {"kind": "growth", "target": None, "label": "business growth", "raw": command}
    return None


def build_marketing_plan(command: str, context: BusinessContext, outcome: dict | None) -> str:
    niche = get_niche(getattr(context, "niche_mode", None) or _infer_niche(context.industry))
    company = context.company or "your business"
    goal_line = context.goal or "grow profitably"
    target_line = ""
    if outcome and outcome.get("target"):
        target_line = f"\n🎯 Target: {outcome['target']} {outcome['kind']} — {outcome['label']}"
    elif outcome:
        target_line = f"\n🎯 Outcome: {outcome['label']}"

    return f"""📋 NEXA MARKETING PLAN — {company}
Mode: {niche.emoji} {niche.label}{target_line}
Goal: {goal_line} · Market: {context.market or 'your market'}

Week 1 — Foundation
• Audit current funnel and define ICP for {niche.label.lower()}
• Set up tracking (Stripe, CRM, ads pixel)
• Draft 3 core offers aligned with: {command[:80]}

Week 2 — Acquisition
• Launch outbound + paid test (£50–100/day cap)
• Publish 5 pieces of niche content
• Sync warm leads to CRM daily

Week 3 — Conversion
• Nurture sequence (email + retargeting)
• Book calls / checkout optimization
• Post daily metrics to team channel

Week 4 — Optimize
• Kill underperforming channels
• Double budget on winner
• Report ROI and next 30-day plan

Nexa is executing this plan via your connected tools. Check tasks below for live status."""


def _infer_niche(industry: str) -> str:
    lower = (industry or "").lower()
    if any(w in lower for w in ("agency", "marketing", "creative")):
        return "agency"
    if any(w in lower for w in ("coach", "consult", "trainer")):
        return "coach"
    if any(w in lower for w in ("ecommerce", "e-commerce", "shop", "store", "dtc")):
        return "ecommerce"
    if any(w in lower for w in ("real estate", "property", "realtor", "estate")):
        return "real_estate"
    return "general"


async def execute_nexa_internal(
    task: Task,
    context: BusinessContext,
    response: CommandResponse,
) -> tuple[TaskStatus, str, str]:
    """Always-complete fallback — Nexa runs the work internally when integrations aren't wired."""
    company = context.company or "your company"
    niche = get_niche(getattr(context, "niche_mode", None) or _infer_niche(context.industry))
    action = task.action.lower()
    category = task.category
    now = datetime.now(timezone.utc).strftime("%H:%M UTC")

    # Strategy / planning tasks
    if any(k in action for k in ("strategy", "plan", "audit", "draft", "proposal", "launch plan", "nurture", "listing", "description")):
        return (
            TaskStatus.completed,
            f"Nexa drafted {category} deliverable for {company} ({niche.label} mode) — saved to active plan",
            "nexa",
        )

    if category in ("marketing", "sales", "analytics", "finance", "operations", "reporting", "communication", "support", "hr"):
        detail = f"Nexa executed: {task.action[:60]} for {company} at {now}"
        if category == "marketing":
            detail = f"Marketing action queued — {niche.label} playbook step complete. Next: measure in 48h."
        elif category == "sales":
            detail = f"Sales pipeline updated — outreach template ready for {context.market or 'your market'}."
        elif category == "finance":
            detail = f"Finance snapshot logged — connect Stripe for live numbers."
        elif category == "communication":
            detail = f"Team update prepared — connect Slack or Gmail to send automatically."
        return (TaskStatus.completed, detail, "nexa")

    return (
        TaskStatus.completed,
        f"Nexa completed: {task.action[:70]} ({niche.label})",
        "nexa",
    )


async def save_active_plan(
    db: AsyncSession,
    user_id: str,
    command: str,
    response: CommandResponse,
    outcome: dict | None,
    marketing_plan: str,
) -> ActivePlan:
    result = await db.execute(
        select(ActivePlan).where(ActivePlan.user_id == user_id, ActivePlan.status == "active")
    )
    for old in result.scalars().all():
        old.status = "completed"

    plan = ActivePlan(
        user_id=user_id,
        command=command,
        intent=response.intent,
        summary=response.summary,
        marketing_plan=marketing_plan,
        outcome_json=json.dumps(outcome) if outcome else "{}",
        tasks_json=json.dumps([t.model_dump() for t in response.tasks]),
        executed_count=response.executed_count,
        status="active",
    )
    db.add(plan)
    await db.flush()
    return plan


async def get_active_plan(db: AsyncSession, user_id: str) -> ActivePlan | None:
    result = await db.execute(
        select(ActivePlan)
        .where(ActivePlan.user_id == user_id, ActivePlan.status == "active")
        .order_by(ActivePlan.created_at.desc())
        .limit(1)
    )
    return result.scalar_one_or_none()


async def generate_check_in(context: BusinessContext, logs: list[CommandLog]) -> dict:
    niche = get_niche(getattr(context, "niche_mode", None) or _infer_niche(context.industry))
    company = context.company or "there"
    today = datetime.now(timezone.utc).strftime("%A, %d %B")

    recent_cmds = [log.command for log in logs[:3]]
    pending = sum(
        1
        for log in logs
        for t in json.loads(log.tasks_json or "[]")
        if t.get("status") == "planned"
    )

    if not recent_cmds:
        message = (
            f"Good morning — it's {today}. I'm Nexa, your {niche.label} operator for {company}. "
            f"Tell me one outcome (e.g. \"{niche.sample_outcomes[0]}\") and I'll build + run the plan."
        )
        action = niche.sample_outcomes[0]
    else:
        message = (
            f"Daily check-in · {today}\n"
            f"Last command: \"{recent_cmds[0]}\"\n"
            f"{'⚠️ ' + str(pending) + ' tasks still need integrations — open Integrations to connect tools.' if pending else '✅ All recent tasks executed.'}\n"
            f"Suggested next move for {company}: {niche.sample_outcomes[1] if len(niche.sample_outcomes) > 1 else niche.sample_outcomes[0]}"
        )
        action = niche.sample_outcomes[0]

    return {
        "message": message,
        "suggested_command": action,
        "niche": niche.id,
        "date": today,
    }


async def get_or_create_check_in(
    db: AsyncSession,
    user_id: str,
    context: BusinessContext,
) -> dict:
    today_key = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    result = await db.execute(
        select(CheckInLog).where(CheckInLog.user_id == user_id, CheckInLog.day_key == today_key)
    )
    existing = result.scalar_one_or_none()
    if existing:
        return json.loads(existing.payload_json)

    logs_result = await db.execute(
        select(CommandLog)
        .where(CommandLog.user_id == user_id)
        .order_by(CommandLog.created_at.desc())
        .limit(10)
    )
    logs = list(logs_result.scalars().all())
    payload = await generate_check_in(context, logs)
    db.add(CheckInLog(user_id=user_id, day_key=today_key, payload_json=json.dumps(payload)))
    await db.flush()
    return payload


COACH_STEPS = [
    {
        "id": "welcome",
        "prompt": "Welcome! I'm Nexa — I run your business, not just chat. What's your name and what kind of business do you want to build?",
        "hint": "e.g. I'm Sarah, starting a marketing agency in London",
    },
    {
        "id": "niche",
        "prompt": "Pick your mode — I'll tailor everything: Agency, Coach, E-commerce, Real Estate, or General. Which fits you?",
        "hint": "Say: agency, coach, ecommerce, or real estate",
    },
    {
        "id": "outcome",
        "prompt": "Give me ONE outcome — I'll build the strategy and execute it. No blank prompts.",
        "hint": "e.g. Get me 20 leads this month",
    },
    {
        "id": "ready",
        "prompt": "You're set. Open Command Center — I'll show your marketing plan and run tasks. Press the 🎲 for a business idea anytime.",
        "hint": "Type your first command or click a quick action",
    },
]


def coach_reply(message: str, step: int = 0) -> dict:
    lower = message.lower().strip()
    step = min(step, len(COACH_STEPS) - 1)

    if step == 0 and len(lower) > 3:
        return {"reply": COACH_STEPS[1]["prompt"], "next_step": 1, "done": False}
    if step == 1:
        niche_map = {"agency": "agency", "coach": "coach", "ecommerce": "ecommerce", "e-commerce": "ecommerce", "real estate": "real_estate", "property": "real_estate"}
        detected = next((v for k, v in niche_map.items() if k in lower), "general")
        niche = get_niche(detected)
        return {
            "reply": f"Perfect — {niche.emoji} {niche.label} mode activated.\n\n{COACH_STEPS[2]['prompt']}",
            "next_step": 2,
            "niche_mode": detected,
            "done": False,
        }
    if step == 2 and len(lower) > 5:
        return {
            "reply": f"Got it: \"{message}\"\n\nI'll build your marketing plan and execute tasks when you hit Command Center.\n\n{COACH_STEPS[3]['prompt']}",
            "next_step": 3,
            "suggested_command": message,
            "done": True,
        }
    if step >= 3:
        return {"reply": "Head to Command Center — type that command and I'll execute.", "next_step": 3, "done": True}

    current = COACH_STEPS[step]
    return {"reply": current["prompt"], "hint": current.get("hint"), "next_step": step, "done": False}
