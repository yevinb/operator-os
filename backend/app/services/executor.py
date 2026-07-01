from dataclasses import dataclass
from datetime import datetime, timezone

from app.models import CommandResponse, Task, TaskStatus
from app.services.business_context import BusinessContext
from app.services.integration_map import INTEGRATION_LABELS, missing_integration_hint
from app.services.integrations.google import create_calendar_event, refresh_google_token, send_gmail
from app.services.integrations.providers import (
    hubspot_snapshot,
    meta_ad_account_name,
    notion_create_note,
    quickbooks_company_name,
)
from app.services.stripe_integration import fetch_stripe_snapshot
from app.services.webhooks import post_json_webhook, send_slack_message, trigger_n8n

IntegrationData = dict[str, dict]

WRITE_KEYWORDS = ("launch", "create", "post job", "campaign", "hire", "fire", "terminate")


@dataclass
class ExecResult:
    status: TaskStatus
    detail: str
    integration: str | None = None
    verified: bool = False
    external_id: str | None = None
    proof: dict | None = None


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
    counts = {"completed": 0, "planned": 0, "failed": 0}

    for task in response.tasks:
        result = await _execute_single(task, context, stripe_data, integration_data, response)
        executed.append(
            task.model_copy(
                update={
                    "status": result.status,
                    "detail": result.detail,
                    "integration": result.integration,
                    "verified": result.verified,
                    "external_id": result.external_id,
                    "proof": result.proof,
                    "executed_at": datetime.now(timezone.utc).isoformat() if result.status == TaskStatus.completed else None,
                }
            )
        )
        if result.status == TaskStatus.completed:
            counts["completed"] += 1
        elif result.status == TaskStatus.failed:
            counts["failed"] += 1
        else:
            counts["planned"] += 1

    summary = response.summary
    if counts["completed"]:
        summary = (
            f"{counts['completed']} action(s) executed live"
            + (f", {counts['planned']} planned (connect more tools)" if counts["planned"] else "")
            + f" — {response.summary}"
        )
    elif counts["planned"]:
        summary = f"No integrations ran yet — connect tools in Integrations. Plan: {response.summary}"

    return response.model_copy(
        update={
            "tasks": executed,
            "summary": summary,
            "executed_count": counts["completed"],
            "planned_count": counts["planned"],
            "failed_count": counts["failed"],
            "mode": "live",
        }
    )


async def _execute_single(
    task: Task,
    context: BusinessContext,
    stripe_data: dict | None,
    data: IntegrationData,
    response: CommandResponse,
) -> ExecResult:
    company = context.company or "your company"
    action = task.action.lower()
    category = task.category
    connected = context.connected_integrations
    is_write = any(k in action for k in WRITE_KEYWORDS)

    # Stripe — finance / analytics
    if stripe_data and "stripe" in connected and category in ("finance", "analytics", "reporting"):
        if any(k in action for k in ("revenue", "stripe", "cash", "payout", "forecast", "pull", "bank", "balance")):
            bal = stripe_data.get("stripe_balance_usd", "N/A")
            cust = stripe_data.get("stripe_customers", "N/A")
            return ExecResult(
                TaskStatus.completed,
                f"Stripe live: ${bal} available, {cust} customers",
                "stripe",
                verified=True,
                proof={"source": "stripe_snapshot", "balance_usd": bal, "customers": cust},
            )

    # Slack
    slack_url = data.get("slack", {}).get("api_key", "")
    if slack_url and "slack" in connected:
        if category in ("communication", "support", "operations", "reporting", "marketing") or "slack" in action:
            ok, msg = await send_slack_message(
                slack_url,
                f"Nexa | {company}\nCommand: {response.command}\nAction: {task.action}",
            )
            if ok:
                return ExecResult(
                    TaskStatus.completed,
                    msg,
                    "slack",
                    verified=True,
                    proof={"source": "slack_webhook", "message": msg},
                )
            return ExecResult(TaskStatus.failed, msg, "slack")

    # n8n — universal automation
    n8n_url = data.get("n8n", {}).get("api_key", "")
    if n8n_url and "n8n" in connected:
        ok, msg = await trigger_n8n(n8n_url, {
            "event": "nexa.task",
            "company": company,
            "command": response.command,
            "task": task.action,
            "category": category,
        })
        if ok:
            return ExecResult(
                TaskStatus.completed,
                msg,
                "n8n",
                verified=True,
                proof={"source": "n8n_webhook", "message": msg},
            )
        return ExecResult(TaskStatus.failed, msg, "n8n")

    # Gmail
    gmail = data.get("gmail", {})
    if "gmail" in connected:
        access = await _google_access(data)
        recipient = gmail.get("config", {}).get("default_to", "")
        if access and recipient and category in ("support", "communication", "sales", "reporting"):
            if any(k in action for k in ("email", "reply", "send", "onboarding", "report", "stakeholder", "customer")):
                ok, msg = await send_gmail(
                    access,
                    to=recipient,
                    subject=f"[{company}] {response.command[:60]}",
                    body=f"Command: {response.command}\n\n{task.action}\n\n— Nexa",
                )
                if ok:
                    return ExecResult(
                        TaskStatus.completed,
                        msg,
                        "gmail",
                        verified=True,
                        proof={"source": "gmail_send", "message": msg, "recipient": recipient},
                    )
                return ExecResult(TaskStatus.failed, msg, "gmail")
        if "gmail" in connected and not recipient and category in ("support", "communication", "sales"):
            return ExecResult(
                TaskStatus.planned,
                "Gmail connected — set recipient email on Integrations page",
                "gmail",
            )

    # Calendar
    if "calendar" in connected:
        access = await _google_access(data)
        if access and category in ("operations", "sales", "hr") and any(
            k in action for k in ("meeting", "schedule", "calendar", "book", "interview", "standup")
        ):
            ok, msg = await create_calendar_event(access, task.action[:80], response.summary)
            if ok:
                return ExecResult(
                    TaskStatus.completed,
                    msg,
                    "calendar",
                    verified=True,
                    proof={"source": "calendar_event", "message": msg},
                )
            return ExecResult(TaskStatus.failed, msg, "calendar")

    # HubSpot
    hs_key = data.get("hubspot", {}).get("api_key", "")
    if hs_key and "hubspot" in connected and category in ("sales", "analytics", "support"):
        snap = await hubspot_snapshot(hs_key)
        if snap:
            return ExecResult(
                TaskStatus.completed,
                f"HubSpot: {snap.get('hubspot_contacts', 0)} contacts in CRM",
                "hubspot",
                verified=True,
                proof={"source": "hubspot_snapshot", "contacts": snap.get("hubspot_contacts", 0)},
            )
        return ExecResult(TaskStatus.failed, "HubSpot API error", "hubspot")

    # Notion
    notion = data.get("notion", {})
    if notion.get("api_key") and "notion" in connected and category in ("operations", "reporting", "hr"):
        cfg = notion.get("config", {})
        db_id = cfg.get("database_id", "")
        if not db_id:
            return ExecResult(TaskStatus.planned, "Notion connected — add database ID in Integrations", "notion")
        ok, msg = await notion_create_note(
            notion["api_key"],
            db_id,
            f"{company}: {response.command[:40]}",
            task.action,
        )
        if ok:
            return ExecResult(
                TaskStatus.completed,
                msg,
                "notion",
                verified=True,
                proof={"source": "notion_create_note", "message": msg},
            )
        return ExecResult(TaskStatus.failed, msg, "notion")

    # Meta — read-only verify unless write keywords
    meta = data.get("meta", {})
    if meta.get("api_key") and "meta" in connected and category == "marketing":
        if is_write:
            return ExecResult(
                TaskStatus.planned,
                "Meta connected — campaign creation runs in Ads Manager; use n8n for automation",
                "meta",
            )
        cfg = meta.get("config", {})
        name = await meta_ad_account_name(meta["api_key"], cfg.get("ad_account_id", ""))
        if name:
            return ExecResult(
                TaskStatus.completed,
                f"Meta Ads account: {name}",
                "meta",
                verified=True,
                proof={"source": "meta_account_lookup", "account_name": name},
            )
        return ExecResult(TaskStatus.planned, "Add Meta ad account ID in Integrations", "meta")

    # LinkedIn
    li_key = data.get("linkedin", {}).get("api_key", "")
    if li_key and "linkedin" in connected and category == "hr":
        return ExecResult(
            TaskStatus.planned,
            "LinkedIn integration is connected, but live HR actions are not implemented yet",
            "linkedin",
        )

    # QuickBooks
    qb = data.get("quickbooks", {})
    if qb.get("api_key") and "quickbooks" in connected and category == "finance":
        cfg = qb.get("config", {})
        realm = cfg.get("realm_id", "")
        if not realm:
            return ExecResult(TaskStatus.planned, "QuickBooks connected — add Realm ID", "quickbooks")
        name = await quickbooks_company_name(qb["api_key"], realm)
        if name:
            return ExecResult(
                TaskStatus.completed,
                f"QuickBooks: {name}",
                "quickbooks",
                verified=True,
                proof={"source": "quickbooks_company_lookup", "company_name": name},
            )
        return ExecResult(TaskStatus.failed, "QuickBooks API error", "quickbooks")

    # Google Ads
    if "google-ads" in connected and category == "marketing":
        return ExecResult(
            TaskStatus.planned,
            "Google Ads integration is connected, but live campaign actions need developer token + customer ID setup",
            "google-ads",
        )

    # MCP
    mcp_url = data.get("mcp", {}).get("api_key", "")
    if mcp_url and "mcp" in connected:
        ok, msg = await post_json_webhook(mcp_url, {
            "jsonrpc": "2.0",
            "method": "tools/call",
            "params": {"name": "nexa_execute", "arguments": {"task": task.action, "company": company}},
            "id": 1,
        })
        if ok:
            return ExecResult(
                TaskStatus.completed,
                msg,
                "mcp",
                verified=True,
                proof={"source": "mcp_tools_call", "message": msg},
            )
        return ExecResult(TaskStatus.failed, msg, "mcp")

    hint = missing_integration_hint(category, connected)
    return ExecResult(TaskStatus.planned, hint)
