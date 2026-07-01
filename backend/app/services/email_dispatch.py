"""Direct Gmail send — bypass multi-task plans for simple email commands."""

import json
import re

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db_models import IntegrationConnection
from app.services.integrations.google import resolve_google_access, send_gmail
from app.services.integrations.providers import parse_config

EMAIL_RE = re.compile(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}")

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
    "gmail",
)


def is_email_command(message: str) -> bool:
    lower = message.lower()
    return any(h in lower for h in EMAIL_COMMAND_HINTS) or (
        "send" in lower and "email" in lower
    )


def _compose_body(company: str, command: str) -> tuple[str, str]:
    subject = f"[{company}] Message from Nexa"
    if "business" in command.lower():
        subject = f"[{company}] Introduction — let's connect"
    body = f"""Hello,

I'm reaching out from {company}.

{command}

Best regards,
{company}

— Sent via Nexa on your behalf"""
    return subject, body


async def try_direct_gmail_send(
    message: str,
    user_id: str,
    company: str,
    db: AsyncSession,
) -> dict | None:
    """Send one Gmail immediately when user asks — returns None if not an email command."""
    if not is_email_command(message):
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
                "Gmail is not connected on the server yet.\n\n"
                "1. Open Integrations in the sidebar\n"
                "2. Click Gmail → Connect with Google\n"
                "3. Then say: Send email to someone@example.com"
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
            "reply": "Gmail token expired — go to Integrations → Gmail → Connect with Google again, then retry.",
            "executed": False,
        }

    emails = EMAIL_RE.findall(message)
    recipient = emails[-1] if emails else config.get("default_to", "")
    if not recipient:
        # Vague "send an email" with no address — use last known default or prompt
        return {
            "reply": (
                "I can send that via Gmail — who should receive it?\n\n"
                "Say: Send email to yenara.bollegala@gmail.com"
            ),
            "executed": False,
        }

    if emails:
        config["default_to"] = recipient
        gmail_conn.config_json = json.dumps(config)
        await db.flush()

    subject, body = _compose_body(company or "your company", message)
    sender = config.get("email", "")
    ok, detail = await send_gmail(access, to=recipient, subject=subject, body=body, from_email=sender)
    if ok:
        return {
            "reply": f"✅ Email sent live to {recipient}.\n{detail}",
            "executed": True,
            "command_response": {
                "command": message,
                "intent": "send_email",
                "summary": f"Email sent to {recipient}",
                "tasks": [
                    {
                        "id": "gmail-direct",
                        "action": f"Send email to {recipient}",
                        "category": "communication",
                        "status": "completed",
                        "detail": detail,
                        "integration": "gmail",
                        "verified": True,
                        "proof": {"source": "gmail_send", "recipient": recipient},
                    }
                ],
                "executed_count": 1,
                "planned_count": 0,
                "failed_count": 0,
                "mode": "live",
            },
        }

    return {
        "reply": f"Gmail send failed: {detail}\n\nTry reconnecting Gmail in Integrations.",
        "executed": False,
    }
