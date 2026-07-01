from dataclasses import dataclass
from datetime import datetime, timezone
import re
from typing import TYPE_CHECKING

from app.models import CommandResponse, Task, TaskStatus
from app.services.business_context import BusinessContext
from app.services.business_snapshot import build_business_snapshot
from app.services.execution_bundle import ExecutionBundle
from app.services.integration_map import INTEGRATION_LABELS, missing_integration_hint
from app.services.integrations.google import (
    create_calendar_event,
    google_ads_campaign_stats,
    resolve_google_access,
    send_gmail,
)
from app.services.integrations.providers import (
    hubspot_log_note,
    hubspot_snapshot,
    linkedin_profile_snapshot,
    linkedin_share_update,
    meta_account_insights,
    meta_ad_account_name,
    meta_first_ad_account,
    notion_create_note,
    notion_find_database,
    quickbooks_company_name,
    quickbooks_finance_snapshot,
)
from app.services.stripe_integration import fetch_stripe_snapshot
from app.services.webhooks import post_json_webhook, send_slack_message, trigger_n8n

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

IntegrationData = dict[str, dict]

WRITE_KEYWORDS = ("launch", "create", "post job", "campaign", "hire", "fire", "terminate")
EMAIL_RE = re.compile(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}")


def _recipient_from_command(command: str, default_to: str) -> str:
    found = EMAIL_RE.findall(command or "")
    if found:
        return found[-1]
    return default_to


def _compose_business_email(
    company: str,
    command: str,
    action: str,
    email_context: str = "",
) -> tuple[str, str]:
    subject = f"[{company}] Business update"
    if "business email" in command.lower() or "business" in command.lower():
        subject = f"[{company}] Introduction — let's connect"
    context_block = f"\n\n{email_context}" if email_context else ""
    body = f"""Hello,

I'm reaching out from {company}.

{action}{context_block}

We would welcome the opportunity to connect and explore working together.

Best regards,
{company}

— Sent via Nexa on your behalf"""
    return subject, body


@dataclass
class ExecResult:
    status: TaskStatus
    detail: str
    integration: str | None = None
    verified: bool = False
    external_id: str | None = None
    proof: dict | None = None


async def _integration_access(data: IntegrationData, integration_id: str, *, gmail: bool = False) -> tuple[str, str]:
    cfg = data.get(integration_id, {}).get("config", {})
    if not cfg:
        return "", ""
    access, updated = await resolve_google_access(cfg, gmail=gmail)
    return access, updated.get("email", "")


async def _google_ads_creds(data: IntegrationData) -> tuple[str, str, str]:
    """Returns developer_token, customer_id, access_token."""
    ads = data.get("google-ads", {})
    cfg = ads.get("config", {})
    dev = cfg.get("developer_token") or ads.get("api_key", "")
    customer = cfg.get("customer_id", "")
    oauth = cfg.get("google_oauth", {})
    if oauth:
        access, _ = await resolve_google_access(oauth, gmail=False)
        if access:
            return dev, customer, access
    access, _ = await _integration_access(data, "gmail", gmail=False)
    return dev, customer, access


async def execute_tasks(
    response: CommandResponse,
    context: BusinessContext,
    integration_data: IntegrationData,
    *,
    db: "AsyncSession | None" = None,
    user_id: str | None = None,
    bundle: ExecutionBundle | None = None,
) -> CommandResponse:
    company = context.company or "your company"
    if bundle is None:
        snap = await build_business_snapshot(
            company,
            context.connected_integrations,
            integration_data,
            cache_key=user_id or company,
        )
        bundle = ExecutionBundle.from_snapshot(response.command, company, snap)

    stripe_key = integration_data.get("stripe", {}).get("api_key", "")
    stripe_data = None
    if stripe_key and "stripe" in context.connected_integrations:
        stripe_data = await fetch_stripe_snapshot(stripe_key)
        if stripe_data:
            bundle.metrics.update(stripe_data)

    executed: list[Task] = []
    counts = {"completed": 0, "planned": 0, "failed": 0}

    for task in response.tasks:
        result = await _execute_single(
            task, context, stripe_data, integration_data, response, bundle
        )
        bundle.absorb(result.integration, result.detail, result.proof, result.verified)
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
    bundle_summary = bundle.summary_line()
    if counts["completed"]:
        summary = (
            f"{counts['completed']} action(s) executed live"
            + (f", {counts['planned']} planned (connect more tools)" if counts["planned"] else "")
            + (f" — {bundle_summary}" if bundle_summary else "")
            + f" — {response.summary}"
        )
    elif counts["planned"]:
        summary = f"No integrations ran yet — connect tools in Integrations. Plan: {response.summary}"

    if db and user_id and counts["completed"]:
        from app.services.business_graph import absorb_execution_entities, save_execution_run

        await save_execution_run(db, user_id, response.command, bundle, counts["completed"])
        await absorb_execution_entities(db, user_id, bundle)

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
    bundle: ExecutionBundle,
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
                bundle.enrich_message(task.action),
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
        ok, msg = await trigger_n8n(n8n_url, bundle.n8n_payload(task.action, category))
        if ok:
            return ExecResult(
                TaskStatus.completed,
                msg,
                "n8n",
                verified=True,
                proof={"source": "n8n_webhook", "message": msg},
            )
        return ExecResult(TaskStatus.failed, msg, "n8n")

    # Gmail — priority when command mentions email
    gmail = data.get("gmail", {})
    cmd_lower = response.command.lower()
    email_cmd = any(k in cmd_lower for k in ("email", "gmail", "send"))
    if "gmail" in connected and email_cmd:
        access, sender = await _integration_access(data, "gmail", gmail=True)
        default_to = gmail.get("config", {}).get("default_to", "")
        recipient = _recipient_from_command(response.command, default_to)
        email_intent = any(
            k in action.lower() for k in ("email", "reply", "send", "onboarding", "report", "stakeholder", "customer", "write", "gmail")
        ) or email_cmd
        if access and recipient and email_intent:
            subject, body = _compose_business_email(
                company, response.command, task.action, bundle.email_context()
            )
            ok, msg = await send_gmail(access, to=recipient, subject=subject, body=body, from_email=sender)
            if ok:
                return ExecResult(
                    TaskStatus.completed,
                    msg,
                    "gmail",
                    verified=True,
                    proof={"source": "gmail_send", "message": msg, "recipient": recipient},
                )
            return ExecResult(TaskStatus.failed, msg, "gmail")
        if "gmail" in connected and not recipient and email_intent:
            return ExecResult(
                TaskStatus.planned,
                "Gmail connected — include recipient email in your message (e.g. to name@company.com)",
                "gmail",
            )
        if "gmail" in connected and not access and email_intent:
            return ExecResult(
                TaskStatus.planned,
                "Gmail token expired — reconnect Gmail in Integrations",
                "gmail",
            )

    # Calendar
    if "calendar" in connected:
        access, _ = await _integration_access(data, "calendar", gmail=False)
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
        if any(k in action for k in ("log", "note", "crm", "sync", "contact", "pull")):
            ok, msg = await hubspot_log_note(
                hs_key, bundle.hubspot_body(task.action), company
            )
            if ok:
                return ExecResult(
                    TaskStatus.completed,
                    msg,
                    "hubspot",
                    verified=True,
                    proof={"source": "hubspot_note", "message": msg},
                )
            snap = await hubspot_snapshot(hs_key)
            if snap:
                return ExecResult(
                    TaskStatus.completed,
                    f"HubSpot: {snap.get('hubspot_contacts', 0)} contacts in CRM",
                    "hubspot",
                    verified=True,
                    proof={"source": "hubspot_snapshot", "contacts": snap.get("hubspot_contacts", 0)},
                )
            return ExecResult(TaskStatus.failed, msg, "hubspot")
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
            db_id = await notion_find_database(notion["api_key"]) or ""
        if not db_id:
            return ExecResult(
                TaskStatus.failed,
                "Notion: no database found — share a database with your integration",
                "notion",
            )
        ok, msg = await notion_create_note(
            notion["api_key"],
            db_id,
            f"{company}: {response.command[:40]}",
            bundle.notion_body(task.action),
        )
        if ok:
            return ExecResult(
                TaskStatus.completed,
                msg,
                "notion",
                verified=True,
                proof={"source": "notion_create_note", "message": msg, "database_id": db_id},
            )
        return ExecResult(TaskStatus.failed, msg, "notion")

    # Meta Ads — live insights + account status
    meta = data.get("meta", {})
    if meta.get("api_key") and "meta" in connected and category == "marketing":
        cfg = meta.get("config", {})
        acct_id = cfg.get("ad_account_id", "") or await meta_first_ad_account(meta["api_key"]) or ""
        if acct_id:
            ok, msg, proof = await meta_account_insights(meta["api_key"], acct_id)
            if ok:
                return ExecResult(
                    TaskStatus.completed,
                    msg,
                    "meta",
                    verified=True,
                    proof={"source": "meta_insights", **proof},
                )
            return ExecResult(TaskStatus.failed, msg, "meta")
        name = await meta_ad_account_name(meta["api_key"], cfg.get("ad_account_id", ""))
        if name:
            return ExecResult(
                TaskStatus.completed,
                f"Meta Ads account: {name}",
                "meta",
                verified=True,
                proof={"source": "meta_account_lookup", "account_name": name},
            )
        return ExecResult(TaskStatus.failed, "Add Meta ad account ID or grant ads_read permission", "meta")

    # LinkedIn — profile + optional post for hiring/outreach
    li_key = data.get("linkedin", {}).get("api_key", "")
    if li_key and "linkedin" in connected and category == "hr":
        if is_write or any(k in action for k in ("post", "share", "outreach", "hire", "recruit")):
            post_text = f"{company}: {task.action}"[:500]
            ok, msg = await linkedin_share_update(li_key, post_text)
            if ok:
                return ExecResult(
                    TaskStatus.completed,
                    msg,
                    "linkedin",
                    verified=True,
                    proof={"source": "linkedin_ugc_post"},
                )
            ok2, msg2, proof = await linkedin_profile_snapshot(li_key)
            if ok2:
                return ExecResult(
                    TaskStatus.completed,
                    f"{msg2} (post skipped: {msg[:80]})",
                    "linkedin",
                    verified=True,
                    proof={"source": "linkedin_profile", **proof},
                )
            return ExecResult(TaskStatus.failed, msg, "linkedin")
        ok, msg, proof = await linkedin_profile_snapshot(li_key)
        if ok:
            return ExecResult(
                TaskStatus.completed,
                msg,
                "linkedin",
                verified=True,
                proof={"source": "linkedin_profile", **proof},
            )
        return ExecResult(TaskStatus.failed, msg, "linkedin")

    # QuickBooks
    qb = data.get("quickbooks", {})
    if qb.get("api_key") and "quickbooks" in connected and category == "finance":
        cfg = qb.get("config", {})
        realm = cfg.get("realm_id", "")
        if not realm:
            return ExecResult(TaskStatus.failed, "QuickBooks connected — add Realm ID in Integrations", "quickbooks")
        ok, msg, proof = await quickbooks_finance_snapshot(qb["api_key"], realm)
        if ok:
            return ExecResult(
                TaskStatus.completed,
                msg,
                "quickbooks",
                verified=True,
                proof={"source": "quickbooks_pnl", **proof},
            )
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

    # Google Ads — live campaign metrics
    if "google-ads" in connected and (
        category == "marketing" or any(k in action for k in ("google ads", "google-ads", "ad campaign", "ppc"))
    ):
        dev, customer, access = await _google_ads_creds(data)
        if dev and customer and access:
            ok, msg, proof = await google_ads_campaign_stats(dev, customer, access)
            if ok:
                return ExecResult(
                    TaskStatus.completed,
                    msg,
                    "google-ads",
                    verified=True,
                    proof={"source": "google_ads_search", **proof},
                )
            return ExecResult(TaskStatus.failed, msg, "google-ads")
        return ExecResult(
            TaskStatus.failed,
            "Google Ads: connect Gmail + add developer token and customer ID",
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
