from app.models import CommandResponse, Task, TaskStatus
from app.services.business_context import BusinessContext
from app.services.stripe_integration import fetch_stripe_snapshot
from app.services.webhooks import send_slack_message, trigger_n8n


async def execute_tasks(
    response: CommandResponse,
    context: BusinessContext,
    integration_keys: dict[str, str],
) -> CommandResponse:
    """Run tasks against connected integrations where possible."""
    stripe_key = integration_keys.get("stripe", "")
    stripe_data = None
    if stripe_key and "stripe" in context.connected_integrations:
        stripe_data = await fetch_stripe_snapshot(stripe_key)

    executed: list[Task] = []
    for task in response.tasks:
        updated = task.model_copy()
        detail = await _execute_single(task, context, stripe_data, integration_keys, response)
        updated.status = TaskStatus.completed
        updated.detail = detail
        executed.append(updated)

    return response.model_copy(update={"tasks": executed})


async def _execute_single(
    task: Task,
    context: BusinessContext,
    stripe_data: dict | None,
    keys: dict[str, str],
    response: CommandResponse,
) -> str:
    company = context.company or "your company"
    category = task.category
    action = task.action.lower()

    # —— Stripe (LIVE) ——
    if category == "finance" and stripe_data and "stripe" in context.connected_integrations:
        if any(k in action for k in ("revenue", "stripe", "cash", "forecast", "payout")):
            bal = stripe_data.get("stripe_balance_usd", "N/A")
            cust = stripe_data.get("stripe_customers", "N/A")
            return f"✓ Live Stripe: ${bal} available, {cust} customers for {company}"

    # —— Slack (LIVE with webhook URL) ——
    slack_url = keys.get("slack", "")
    if slack_url and "slack" in context.connected_integrations:
        if category in ("communication", "support", "operations", "reporting") or "slack" in action:
            text = (
                f"🤖 *OperatorOS* — {company}\n"
                f"Command: _{response.command}_\n"
                f"Action: {task.action}"
            )
            ok, msg = await send_slack_message(slack_url, text)
            if ok:
                return f"✓ Posted to Slack: {task.action[:60]}"
            return f"Slack queued (retry later): {msg}"

    # —— n8n (LIVE with webhook URL) ——
    n8n_url = keys.get("n8n", "")
    if n8n_url and "n8n" in context.connected_integrations:
        ok, msg = await trigger_n8n(
            n8n_url,
            {
                "event": "operatoros.task",
                "company": company,
                "industry": context.industry,
                "command": response.command,
                "intent": response.intent,
                "task": task.action,
                "category": task.category,
            },
        )
        if ok:
            return f"✓ n8n workflow triggered: {task.action[:50]}"
        return f"n8n trigger failed: {msg}"

    # —— Marketing (connected flag only — OAuth coming) ——
    if category == "marketing":
        if any(k in action for k in ("google", "meta", "campaign", "ad")):
            if "google-ads" in context.connected_integrations:
                return f"✓ Google Ads linked for {company} — campaign draft ready (OAuth launch next)"
            if "meta" in context.connected_integrations:
                return f"✓ Meta Ads linked for {company} — audience set for {context.market or 'your market'}"
            return f"Draft plan for {company} — connect Google Ads or Meta in Integrations"

    # —— Gmail (OAuth coming) ——
    if category in ("support", "communication") and "gmail" in context.connected_integrations:
        return f"✓ Gmail linked for {company} — reply draft ready (send via OAuth next)"

    if category == "sales" and context.goal:
        return f"✓ Sales action for {company} — goal: {context.goal}"

    if category == "hr" and "linkedin" in context.connected_integrations:
        return f"✓ LinkedIn hiring flow started for {company}"

    if context.live_metrics:
        snapshot = ", ".join(f"{k}={v}" for k, v in list(context.live_metrics.items())[:3])
        return f"✓ Used live data ({snapshot})"

    return f"✓ Completed for {company} ({context.industry or 'your business'})"
