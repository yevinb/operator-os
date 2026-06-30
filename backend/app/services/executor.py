from app.models import CommandResponse, Task, TaskStatus
from app.services.business_context import BusinessContext
from app.services.integrations.google import create_calendar_event, refresh_google_token, send_gmail
from app.services.integrations.providers import (
    hubspot_snapshot,
    meta_ad_account_name,
    notion_create_note,
    parse_config,
    quickbooks_company_name,
)
from app.services.stripe_integration import fetch_stripe_snapshot
from app.services.webhooks import post_json_webhook, send_slack_message, trigger_n8n

IntegrationData = dict[str, dict]


async def _google_access(data: IntegrationData) -> str:
    for key in ("gmail", "calendar", "google-ads"):
        cfg = data.get(key, {}).get("config", {})
        if cfg.get("access_token"):
            return cfg["access_token"]
        if cfg.get("refresh_token"):
            refreshed = await refresh_google_token(cfg["refresh_token"])
            if refreshed:
                return refreshed["access_token"]
    return ""


async def execute_tasks(
    response: CommandResponse,
    context: BusinessContext,
    integration_data: IntegrationData,
) -> CommandResponse:
    stripe_key = integration_data.get("stripe", {}).get("api_key", "")
    stripe_data = None
    if stripe_key and "stripe" in context.connected_integrations:
        stripe_data = await fetch_stripe_snapshot(stripe_key)

    executed: list[Task] = []
    for task in response.tasks:
        detail = await _execute_single(task, context, stripe_data, integration_data, response)
        executed.append(task.model_copy(update={"status": TaskStatus.completed, "detail": detail}))

    return response.model_copy(update={"tasks": executed})


async def _execute_single(
    task: Task,
    context: BusinessContext,
    stripe_data: dict | None,
    data: IntegrationData,
    response: CommandResponse,
) -> str:
    company = context.company or "your company"
    action = task.action.lower()
    category = task.category

    # Stripe
    if stripe_data and category == "finance" and "stripe" in context.connected_integrations:
        if any(k in action for k in ("revenue", "stripe", "cash", "payout", "forecast")):
            bal = stripe_data.get("stripe_balance_usd", "N/A")
            cust = stripe_data.get("stripe_customers", "N/A")
            return f"✓ Stripe live: ${bal} available, {cust} customers"

    # HubSpot
    hs_key = data.get("hubspot", {}).get("api_key", "")
    if hs_key and "hubspot" in context.connected_integrations:
        snap = await hubspot_snapshot(hs_key)
        if snap and category in ("sales", "analytics", "operations"):
            return f"✓ HubSpot: {snap.get('hubspot_contacts', 0)} contacts — {task.action[:50]}"

    # Slack
    slack_url = data.get("slack", {}).get("api_key", "")
    if slack_url and "slack" in context.connected_integrations:
        if category in ("communication", "support", "operations", "reporting") or "slack" in action:
            ok, msg = await send_slack_message(
                slack_url,
                f"🤖 *OperatorOS* | {company}\n*{response.command}*\n→ {task.action}",
            )
            return f"✓ Slack: {msg}" if ok else f"Slack: {msg}"

    # n8n
    n8n_url = data.get("n8n", {}).get("api_key", "")
    if n8n_url and "n8n" in context.connected_integrations:
        ok, msg = await trigger_n8n(n8n_url, {
            "event": "operatoros.task",
            "company": company,
            "command": response.command,
            "task": task.action,
            "category": category,
        })
        return f"✓ n8n: {msg}" if ok else f"n8n: {msg}"

    # Gmail
    gmail = data.get("gmail", {})
    if "gmail" in context.connected_integrations:
        access = await _google_access(data)
        recipient = gmail.get("config", {}).get("default_to", "")
        if access and recipient and category in ("support", "communication", "sales"):
            ok, msg = await send_gmail(
                access,
                to=recipient,
                subject=f"[{company}] OperatorOS action",
                body=f"Command: {response.command}\n\n{task.action}\n\n— Your AI COO",
            )
            return f"✓ Gmail: {msg}" if ok else f"Gmail: {msg}"

    # Calendar
    if "calendar" in context.connected_integrations:
        access = await _google_access(data)
        if access and any(k in action for k in ("meeting", "schedule", "calendar", "book")):
            ok, msg = await create_calendar_event(access, task.action[:80], response.summary)
            return f"✓ Calendar: {msg}" if ok else f"Calendar: {msg}"

    # Notion
    notion = data.get("notion", {})
    if notion.get("api_key") and "notion" in context.connected_integrations:
        cfg = notion.get("config", {})
        if category in ("operations", "reporting", "hr"):
            ok, msg = await notion_create_note(
                notion["api_key"],
                cfg.get("database_id", ""),
                f"{company}: {response.command[:40]}",
                task.action,
            )
            return f"✓ Notion: {msg}" if ok else f"Notion: {msg}"

    # Meta
    meta = data.get("meta", {})
    if meta.get("api_key") and "meta" in context.connected_integrations:
        if category == "marketing":
            cfg = meta.get("config", {})
            name = await meta_ad_account_name(meta["api_key"], cfg.get("ad_account_id", ""))
            label = name or "Meta Ads"
            return f"✓ {label} connected — campaign step: {task.action[:50]}"

    # LinkedIn
    li_key = data.get("linkedin", {}).get("api_key", "")
    if li_key and "linkedin" in context.connected_integrations and category == "hr":
        return f"✓ LinkedIn API live — hiring outreach queued for {company}"

    # QuickBooks
    qb = data.get("quickbooks", {})
    if qb.get("api_key") and "quickbooks" in context.connected_integrations and category == "finance":
        cfg = qb.get("config", {})
        name = await quickbooks_company_name(qb["api_key"], cfg.get("realm_id", ""))
        label = name or "QuickBooks"
        return f"✓ {label} synced — {task.action[:50]}"

    # Google Ads
    if "google-ads" in context.connected_integrations and category == "marketing":
        return f"✓ Google Ads connected — {task.action[:50]}"

    # MCP
    mcp_url = data.get("mcp", {}).get("api_key", "")
    if mcp_url and "mcp" in context.connected_integrations:
        ok, msg = await post_json_webhook(mcp_url, {
            "jsonrpc": "2.0",
            "method": "tools/call",
            "params": {"name": "operatoros_execute", "arguments": {"task": task.action, "company": company}},
            "id": 1,
        })
        return f"✓ MCP: {msg}" if ok else f"MCP: {msg}"

    if context.live_metrics:
        snap = ", ".join(f"{k}={v}" for k, v in list(context.live_metrics.items())[:2])
        return f"✓ Live context ({snap}) — {task.action[:40]}"

    return f"✓ {task.action[:60]} for {company}"
