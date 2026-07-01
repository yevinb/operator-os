"""Direct Gmail send — intelligent composition and autonomous delivery."""

import json
import re

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db_models import IntegrationConnection
from app.services.business_context import BusinessContext
from app.services.integrations.google import resolve_google_access, send_gmail
from app.services.integrations.providers import parse_config
from app.services.nexa_intelligence import (
    EMAIL_RE,
    compose_email,
    wants_email_action,
)

EMAIL_COMMAND_HINTS = (
    "send email",
    "send an email",
    "send a email",
    "email to",
    "write email",
    "write a email",
    "write an email",
    "business email",
    "via gmail",
    "through gmail",
    "reach out",
    "follow up",
    "follow-up",
    "cold email",
    "message them",
    "notify",
    "introduce",
    "gmail",
)


def is_email_command(message: str, analysis: dict | None = None) -> bool:
    if analysis and analysis.get("action") == "send_email":
        return True
    if wants_email_action(message, analysis):
        return True
    lower = message.lower()
    return any(h in lower for h in EMAIL_COMMAND_HINTS) or (
        "send" in lower and "email" in lower
    )


def _resolve_recipient(
    message: str,
    config: dict,
    history: list[dict],
    analysis: dict | None,
) -> str:
    emails = EMAIL_RE.findall(message)
    if emails:
        return emails[-1]
    if analysis and analysis.get("recipient_email"):
        return str(analysis["recipient_email"]).strip()
    if config.get("default_to"):
        return config["default_to"]
    for item in reversed(history[-12:]):
        found = EMAIL_RE.findall(item.get("content", ""))
        if found:
            return found[-1]
    recent = config.get("recent_recipients") or []
    if recent:
        return recent[-1]
    return ""


async def try_direct_gmail_send(
    message: str,
    user_id: str,
    company: str,
    db: AsyncSession,
    *,
    context: BusinessContext | None = None,
    history: list[dict] | None = None,
    analysis: dict | None = None,
    sender_name: str = "",
) -> dict | None:
    """Send one Gmail immediately — returns None if not an email command."""
    history = history or []
    if not is_email_command(message, analysis):
        return None

    result = await db.execute(
        select(IntegrationConnection).where(
            IntegrationConnection.user_id == user_id,
            IntegrationConnection.integration_id == "gmail",
            IntegrationConnection.connected == True,  # noqa: E712
        )
    )
    gmail_conn = result.scalar_one_or_none()
    if not gmail_conn:
        return {
            "reply": (
                "Gmail isn't connected yet. Sign in with Google again to grant Gmail permission, "
                "or open Integrations → Gmail → Connect."
            ),
            "executed": False,
        }

    old_config = parse_config(gmail_conn.config_json)
    access, config = await resolve_google_access(old_config, gmail=True)
    if access:
        gmail_conn.config_json = json.dumps(config)
        gmail_conn.api_key = access
        await db.flush()

    if not access:
        return {
            "reply": "Gmail token expired — sign in with Google again or reconnect in Integrations.",
            "executed": False,
        }

    recipient = _resolve_recipient(message, config, history, analysis)
    if not recipient:
        return {
            "reply": (
                "I'll send that via Gmail — who should receive it? "
                "You can say a name + email, or just: email yenara.bollegala@gmail.com about our services"
            ),
            "executed": False,
        }

    purpose = (analysis or {}).get("email_purpose", "")
    subject, body = await compose_email(
        message,
        company or "your company",
        context,
        history,
        sender_name=sender_name or config.get("email", ""),
        purpose=purpose,
    )

    config["default_to"] = recipient
    recent = list(config.get("recent_recipients") or [])
    if recipient not in recent:
        recent.append(recipient)
    config["recent_recipients"] = recent[-10:]
    gmail_conn.config_json = json.dumps(config)
    await db.flush()

    sender = config.get("email", "")
    ok, detail = await send_gmail(
        access, to=recipient, subject=subject, body=body, from_email=sender
    )
    if ok:
        preview = body[:120].replace("\n", " ") + ("…" if len(body) > 120 else "")
        return {
            "reply": (
                f"✅ Email sent to {recipient}\n"
                f"Subject: {subject}\n"
                f"Preview: {preview}"
            ),
            "executed": True,
            "command_response": {
                "command": message,
                "intent": "send_email",
                "summary": f"Intelligent email sent to {recipient}",
                "tasks": [
                    {
                        "id": "gmail-direct",
                        "action": f"Send email to {recipient}",
                        "category": "communication",
                        "status": "completed",
                        "detail": detail,
                        "integration": "gmail",
                        "verified": True,
                        "proof": {
                            "source": "gmail_send",
                            "recipient": recipient,
                            "subject": subject,
                        },
                    }
                ],
                "executed_count": 1,
                "planned_count": 0,
                "failed_count": 0,
                "mode": "live",
            },
        }

    return {
        "reply": f"Gmail send failed: {detail}\n\nTry signing in with Google again.",
        "executed": False,
    }
