"""Nexa Autopilot — run full business cycles without manual steps."""

from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db_models import User
from app.services.business_context import build_business_context
from app.services.business_snapshot import build_business_snapshot
from app.services.chat import handle_chat
from app.services.execution_bundle import ExecutionBundle
from app.services.executor import execute_tasks
from app.services.integrations.providers import parse_config
from app.services.nexa_engine import build_marketing_plan, parse_outcome, save_active_plan
from app.services.orchestrator import orchestrate_command

AUTOPILOT_PLANS: dict[str, list[str]] = {
    "full": [
        "Check Stripe balance and post summary to Slack",
        "Pull HubSpot CRM contacts and log update in Notion",
        "Send follow-up email to default Gmail recipient about growing revenue",
        "Check Meta and Google Ads campaign performance",
        "Trigger n8n automation for daily ops review",
    ],
    "growth": [
        "Get me 50 leads this month",
        "Post growth metrics update to Slack",
        "Send outreach email via Gmail about our agency services",
    ],
    "sales": [
        "Pull live revenue from Stripe",
        "Sync warm leads from HubSpot",
        "Send win-back email via Gmail",
    ],
    "ops": [
        "Run company operations review",
        "Schedule priority meetings on Calendar",
        "Log executive summary in Notion",
    ],
}


async def run_autopilot(
    mode: str,
    user: User,
    db: AsyncSession,
    *,
    custom_steps: list[str] | None = None,
) -> dict:
    steps = custom_steps or AUTOPILOT_PLANS.get(mode, AUTOPILOT_PLANS["growth"])
    context = await build_business_context(user, db)
    integration_data = {
        i.integration_id: {
            "api_key": i.api_key or "",
            "config": parse_config(i.config_json),
        }
        for i in user.integrations
        if i.connected
    }
    snap = await build_business_snapshot(
        context.company,
        context.connected_integrations,
        integration_data,
        cache_key=user.id,
    )
    bundle = ExecutionBundle.from_snapshot(f"autopilot:{mode}", context.company, snap)

    results: list[dict] = []

    for step in steps:
        chat_result = await handle_chat(step, [], user, db)
        results.append(
            {
                "command": step,
                "reply": chat_result.get("reply", ""),
                "executed": chat_result.get("executed", False),
                "tasks": (chat_result.get("command_response") or {}).get("tasks", []),
            }
        )
        cr = chat_result.get("command_response") or {}
        for t in cr.get("tasks", []):
            if t.get("verified"):
                bundle.absorb(
                    t.get("integration"),
                    t.get("detail", ""),
                    t.get("proof"),
                    True,
                )

    executed = sum(1 for r in results if r.get("executed"))
    verified = sum(
        1
        for r in results
        for t in r.get("tasks", [])
        if t.get("status") == "completed" and t.get("verified")
    )

    bundle_line = bundle.summary_line()
    summary = (
        f"Autopilot ({mode}): {verified} verified action(s) across {len(steps)} steps "
        f"for {context.company}"
    )
    if bundle_line:
        summary += f". {bundle_line}"

    return {
        "mode": mode,
        "company": context.company,
        "connected_integrations": context.connected_integrations,
        "business_narrative": context.business_narrative,
        "metrics": dict(bundle.metrics),
        "steps_run": len(steps),
        "executed_steps": executed,
        "verified_actions": verified,
        "results": results,
        "summary": summary,
    }


async def run_raw_command(command: str, user: User, db: AsyncSession) -> dict:
    """Full orchestrate + execute pipeline for agent control."""
    context = await build_business_context(user, db)
    response = await orchestrate_command(
        command=command.strip(),
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
    executed = await execute_tasks(
        response, context, integration_data, db=db, user_id=user.id
    )
    outcome = parse_outcome(command)
    marketing_plan = build_marketing_plan(command, context, outcome)
    await save_active_plan(db, user.id, executed.command, executed, outcome, marketing_plan)
    await db.commit()
    return executed.model_dump()
