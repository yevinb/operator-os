"""Nexa conversational chat — talk naturally, execute outcomes when ready."""

import json
import re

from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db_models import User
from app.models import CommandResponse
from app.services.business_context import BusinessContext, build_business_context
from app.services.executor import execute_tasks
from app.services.integrations.providers import parse_config
from app.services.nexa_engine import build_marketing_plan, parse_outcome, save_active_plan
from app.services.niche_modes import get_niche
from app.services.orchestrator import orchestrate_command

EMAIL_RE = re.compile(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}")

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
    r"\bgmail\b",
    r"\bpost\b",
    r"\brun\b",
    r"\bcreate\b",
    r"\bscale\b",
    r"\bfind me\b",
    r"\bpull\b",
    r"\bsync\b",
    r"\bschedule\b",
    r"\bexecute\b",
    r"\bcontrol\b",
]

QUESTION_STARTERS = ("what ", "how ", "why ", "can you ", "do you ", "who ", "when ", "where ", "is ", "are ", "should ")


def should_execute(message: str) -> bool:
    lower = message.lower().strip()
    if not lower or len(lower) < 8:
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

    if any(g in lower for g in ("hi", "hello", "hey", "morning", "evening")):
        return (
            f"Hey — I'm Nexa, your operator for {company}. "
            f"Tell me an outcome and I'll build the plan and run it against your connected tools."
        )

    if "help" in lower or "what can you" in lower or "what do you" in lower:
        connected = len(context.connected_integrations or [])
        return (
            f"I run marketing, sales, finance, and ops for {company}.\n\n"
            f"• Connected integrations: {connected}\n"
            f"• Try: \"{sample}\"\n"
            f"• Or ask how something works — I'll guide you."
        )

    if "integration" in lower or "connect" in lower:
        return (
            "Open Integrations in the sidebar to connect Gmail, Stripe, Slack, Calendar, and more. "
            "Once connected, I execute tasks live with verified proof."
        )

    if "thank" in lower:
        return "Anytime. What's the next outcome I should run for you?"

    if "plan" in lower and "marketing" in lower:
        return "Open Marketing Plan in the sidebar to see your active 4-week plan, or tell me a new outcome to generate one."

    if lower.endswith("?"):
        return (
            f"Good question. For {company}, the fastest path is to give me one clear outcome — "
            f"like \"{sample}\" — and I'll execute it step by step."
        )

    return (
        f"Got it. If you want me to take action, phrase it as an outcome — e.g. \"{sample}\". "
        f"I'll build your plan and run it live."
    )


async def ai_chat_reply(message: str, context: BusinessContext, history: list[dict]) -> str | None:
    system = (
        f"You are Nexa, a premium AI Chief Operating Officer for {context.company or 'the user'}. "
        f"Industry: {context.industry or 'general'}. Goal: {context.goal or 'growth'}. "
        "Be warm, concise, and action-oriented. Under 4 sentences. "
        "Encourage clear outcomes. Never pretend you executed something unless the user gave a command."
    )
    messages = [{"role": "system", "content": system}]
    for item in history[-8:]:
        role = "assistant" if item.get("role") == "nexa" else "user"
        messages.append({"role": role, "content": item.get("content", "")})
    messages.append({"role": "user", "content": message})

    if settings.openai_api_key:
        try:
            from openai import AsyncOpenAI

            client = AsyncOpenAI(api_key=settings.openai_api_key)
            r = await client.chat.completions.create(
                model="gpt-4o-mini",
                messages=messages,
                max_tokens=280,
            )
            text = (r.choices[0].message.content or "").strip()
            return text or None
        except Exception:
            pass

    if settings.anthropic_api_key:
        try:
            from anthropic import AsyncAnthropic

            client = AsyncAnthropic(api_key=settings.anthropic_api_key)
            r = await client.messages.create(
                model="claude-3-5-haiku-latest",
                max_tokens=280,
                system=system,
                messages=[m for m in messages if m["role"] != "system"],
            )
            return (r.content[0].text or "").strip() or None
        except Exception:
            pass

    return None


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

    completed_tasks = [t for t in response.tasks if t.status == "completed"][:3]
    for t in completed_tasks:
        if t.detail:
            lines.append(f"• {t.action}: {t.detail}")

    return "\n".join(lines)


async def handle_chat(
    message: str,
    history: list[dict],
    user: User,
    db: AsyncSession,
) -> dict:
    context = await build_business_context(user, db)
    text = message.strip()
    if not text:
        return {"reply": "Tell me what you want to achieve — I'm ready to run it.", "executed": False}

    if should_execute(text):
        # If user names a recipient in chat, persist for Gmail execution this session
        emails = EMAIL_RE.findall(text)
        if emails and "gmail" in [i.integration_id for i in user.integrations if i.connected]:
            for conn in user.integrations:
                if conn.integration_id == "gmail" and conn.connected:
                    cfg = parse_config(conn.config_json)
                    cfg["default_to"] = emails[-1]
                    conn.config_json = json.dumps(cfg)
                    await db.flush()
                    break

        response = await orchestrate_command(
            command=text,
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
        executed = await execute_tasks(response, context, integration_data)
        outcome = parse_outcome(text)
        marketing_plan = build_marketing_plan(text, context, outcome)
        plan = await save_active_plan(db, user.id, executed.command, executed, outcome, marketing_plan)
        executed = executed.model_copy(
            update={
                "marketing_plan": marketing_plan,
                "plan_id": plan.id,
                "outcome": outcome,
                "summary": f"Here's your plan — I'm executing it. {executed.summary}",
            }
        )

        from app.db_models import CommandLog

        log = CommandLog(
            user_id=user.id,
            command=executed.command,
            intent=executed.intent,
            summary=executed.summary,
            tasks_json=json.dumps([t.model_dump() for t in executed.tasks]),
        )
        db.add(log)
        await db.commit()

        return {
            "reply": format_execution_reply(executed),
            "executed": True,
            "command_response": executed.model_dump(),
        }

    ai_reply = await ai_chat_reply(text, context, history)
    reply = ai_reply or rule_chat_reply(text, context)
    return {"reply": reply, "executed": False}
