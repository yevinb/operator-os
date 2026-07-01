"""Nexa conversational chat — autonomous intelligence + live execution."""

import re

from sqlalchemy.ext.asyncio import AsyncSession

from app.db_models import User
from app.models import CommandResponse
from app.services.business_context import BusinessContext, build_business_context
from app.services.ai_clients import complete_text
from app.services.email_dispatch import try_direct_gmail_send
from app.services.nexa_intelligence import analyze_message
from app.services.niche_modes import get_niche

EXECUTE_PATTERNS = [
    r"\bget me\b",
    r"\bincrease\b",
    r"\blaunch\b",
    r"\bcheck\b",
    r"\bgrow\b",
    r"\bsend\b",
    r"\bbook\b",
    r"\bhire\b",
    r"\bemail\b",
    r"\bwrite\b",
    r"\bpost\b",
    r"\brun\b",
    r"\bcreate\b",
    r"\bscale\b",
    r"\bfind me\b",
    r"\bpull\b",
    r"\bsync\b",
    r"\bschedule\b",
    r"\bexecute\b",
    r"\bautomate\b",
]

QUESTION_STARTERS = ("what ", "how ", "why ", "can you ", "do you ", "who ", "when ", "where ", "is ", "are ", "should ")


def should_execute(message: str, analysis: dict | None = None) -> bool:
    if analysis and analysis.get("action") == "execute":
        return True
    lower = message.lower().strip()
    if not lower or len(lower) < 6:
        return False
    if any(re.search(p, lower) for p in EXECUTE_PATTERNS):
        return True
    if lower.endswith("?") and lower.startswith(QUESTION_STARTERS):
        return False
    if len(lower.split()) >= 5 and not lower.startswith(QUESTION_STARTERS):
        return True
    return False


def rule_chat_reply(message: str, context: BusinessContext) -> str:
    lower = message.lower().strip()
    company = context.company or "your business"
    niche = get_niche(getattr(context, "niche_mode", None) or "general")
    sample = niche.sample_outcomes[0] if niche.sample_outcomes else "Get me 30 leads this month"
    connected = context.connected_integrations or []

    if any(g in lower for g in ("hi", "hello", "hey", "morning", "evening")):
        tools = f" ({len(connected)} tools connected)" if connected else ""
        return (
            f"Hey — I'm Nexa, running {company}{tools}. "
            f"Tell me what you want in plain English — email a client, check revenue, grow leads — I'll handle it."
        )

    if "help" in lower or "what can you" in lower:
        return (
            f"I'm your autonomous COO for {company}. I execute live against your integrations.\n\n"
            f"• Email: \"Follow up with yenara.bollegala@gmail.com about our agency services\"\n"
            f"• Ops: \"{sample}\"\n"
            f"• Connected: {', '.join(connected) if connected else 'Sign in with Google for Gmail'}"
        )

    if "integration" in lower or "connect" in lower:
        return (
            "Gmail connects automatically when you sign in with Google. "
            "Add Stripe, Slack, HubSpot, and more in Integrations — then I run everything autonomously."
        )

    if "thank" in lower:
        return "Anytime. What should I run next?"

    return (
        f"Understood. Say what you want done — e.g. \"email a client about {context.goal or 'our offer'}\" "
        f"or \"{sample}\" — and I'll execute it."
    )


async def ai_chat_reply(message: str, context: BusinessContext, history: list[dict]) -> str | None:
    connected = ", ".join(context.connected_integrations) if context.connected_integrations else "Gmail (via Google sign-in)"
    system = f"""You are Nexa — an elite autonomous AI Chief Operating Officer.

Business:
{context.to_prompt_block()}

Connected tools: {connected}

You think like a world-class operator: strategic, proactive, concise. You:
- Answer business questions with specific, actionable advice for THIS company
- Suggest the exact command you'll run when they want action ("Say: email X about Y")
- Never claim you executed something unless the system already did
- Keep replies under 5 sentences unless they ask for detail
- Sound human and confident, not generic"""

    messages = []
    for item in history[-10:]:
        role = "assistant" if item.get("role") == "nexa" else "user"
        messages.append({"role": role, "content": item.get("content", "")})
    messages.append({"role": "user", "content": message})

    return await complete_text(system, messages, max_tokens=450, temperature=0.7)


def format_execution_reply(response: CommandResponse) -> str:
    executed = response.executed_count or sum(1 for t in response.tasks if t.status == "completed")
    planned = response.planned_count or sum(1 for t in response.tasks if t.status == "planned")
    failed = response.failed_count or sum(1 for t in response.tasks if t.status == "failed")

    lines = [response.summary]
    if executed:
        lines.append(f"✅ {executed} action(s) verified live.")
    if planned:
        lines.append(f"📋 {planned} planned — connect more tools in Integrations to run them.")
    if failed:
        lines.append(f"⚠️ {failed} failed — check Integrations and retry.")

    for t in [x for x in response.tasks if x.status == "completed"][:3]:
        if t.detail:
            lines.append(f"• {t.action}: {t.detail}")

    return "\n".join(lines)


async def _run_execution(
    text: str,
    user: User,
    db: AsyncSession,
    context: BusinessContext,
) -> dict:
    from app.services.command_pipeline import run_command_pipeline
    from app.services.nexa_intelligence import EMAIL_RE
    from app.services.integrations.providers import parse_config
    import json

    emails = EMAIL_RE.findall(text)
    if emails:
        for conn in user.integrations:
            if conn.integration_id == "gmail" and conn.connected:
                cfg = parse_config(conn.config_json)
                cfg["default_to"] = emails[-1]
                conn.config_json = json.dumps(cfg)
                await db.flush()
                break

    executed, _bundle = await run_command_pipeline(text, user, db, context=context, log=True)
    await db.commit()

    return {
        "reply": format_execution_reply(executed),
        "executed": True,
        "command_response": executed.model_dump(),
    }


async def handle_chat(
    message: str,
    history: list[dict],
    user: User,
    db: AsyncSession,
) -> dict:
    from app.services.cursor_engine import handle_cursor_turn

    return await handle_cursor_turn(message, history, user, db)
