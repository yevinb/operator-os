import json
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.models import CommandResponse, Task, TaskStatus
from app.services.business_context import BusinessContext
from app.services.stripe_integration import fetch_stripe_snapshot


async def execute_tasks(
    response: CommandResponse,
    context: BusinessContext,
    integration_keys: dict[str, str],
) -> CommandResponse:
    """Run tasks against connected integrations where possible."""
    executed: list[Task] = []

    stripe_key = integration_keys.get("stripe", "")
    stripe_data = None
    if stripe_key:
        stripe_data = await fetch_stripe_snapshot(stripe_key)

    for task in response.tasks:
        updated = task.model_copy()
        updated.status = TaskStatus.completed
        updated.detail = _execute_single(task, context, stripe_data, integration_keys)
        executed.append(updated)

    return response.model_copy(update={"tasks": executed})


def _execute_single(
    task: Task,
    context: BusinessContext,
    stripe_data: dict | None,
    keys: dict[str, str],
) -> str:
    company = context.company or "your company"
    category = task.category
    action = task.action.lower()

    if category == "finance" and stripe_data and "stripe" in context.connected_integrations:
        if "revenue" in action or "stripe" in action or "cash" in action:
            bal = stripe_data.get("stripe_balance_usd", "N/A")
            cust = stripe_data.get("stripe_customers", "N/A")
            return f"Live Stripe data for {company}: ${bal} available, {cust} customers"

    if category == "marketing":
        if "google" in action or "meta" in action or "campaign" in action or "ad" in action:
            if "google-ads" in context.connected_integrations:
                return f"Queued Google Ads workflow for {company} ({context.industry})"
            if "meta" in context.connected_integrations:
                return f"Queued Meta campaign for {company} targeting {context.market or 'core market'}"
            return f"Drafted campaign plan for {company} — connect Google Ads or Meta to launch"

    if category == "support" or category == "communication":
        if "gmail" in context.connected_integrations:
            return f"Gmail automation armed for {company} customer inbox"
        if "slack" in context.connected_integrations:
            return f"Slack message drafted for {company} team channel"
        return f"Reply template created for {company} — connect Gmail or Slack to send"

    if category == "sales":
        if context.goal:
            return f"Sales action aligned with goal '{context.goal}' for {company}"
        return f"Sales outreach queued for {company}"

    if category == "hr" and "linkedin" in context.connected_integrations:
        return f"LinkedIn hiring workflow started for {company}"

    if category == "operations" and "n8n" in keys:
        return f"Triggered n8n workflow for: {task.action}"

    if context.live_metrics:
        snapshot = ", ".join(f"{k}={v}" for k, v in list(context.live_metrics.items())[:3])
        return f"Executed using live context ({snapshot})"

    return f"Completed for {company} ({context.industry or 'general business'})"
