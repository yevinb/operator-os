"""Nexa Autopilot — run full business cycles without manual steps."""

from sqlalchemy.ext.asyncio import AsyncSession

from app.db_models import User
from app.services.business_context import build_business_context
from app.services.business_snapshot import build_business_snapshot
from app.services.chat import format_execution_reply
from app.services.command_pipeline import run_command_pipeline
from app.services.execution_bundle import ExecutionBundle
from app.services.integrations.providers import parse_config

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
    from app.services.plan_limits import can_run_autopilot_mode

    if not can_run_autopilot_mode(user.plan, mode):
        return {
            "mode": mode,
            "error": f"Autopilot mode '{mode}' requires a Pro plan. Upgrade in Billing.",
            "summary": f"Autopilot ({mode}) blocked — upgrade to Pro for full autonomous cycles.",
            "results": [],
            "steps_run": 0,
            "executed_steps": 0,
            "verified_actions": 0,
        }

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
        executed, bundle = await run_command_pipeline(
            step,
            user,
            db,
            context=context,
            bundle=bundle,
            log=True,
        )
        results.append(
            {
                "command": step,
                "reply": format_execution_reply(executed),
                "executed": (executed.executed_count or 0) > 0,
                "tasks": [t.model_dump() for t in executed.tasks],
            }
        )

    executed_steps = sum(1 for r in results if r.get("executed"))
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

    await db.commit()

    return {
        "mode": mode,
        "company": context.company,
        "connected_integrations": context.connected_integrations,
        "business_narrative": context.business_narrative,
        "metrics": dict(bundle.metrics),
        "steps_run": len(steps),
        "executed_steps": executed_steps,
        "verified_actions": verified,
        "results": results,
        "summary": summary,
    }


async def run_raw_command(command: str, user: User, db: AsyncSession) -> dict:
    """Full orchestrate + execute pipeline for agent control."""
    executed, _bundle = await run_command_pipeline(command.strip(), user, db, log=True)
    await db.commit()
    return executed.model_dump()
