"""
Cursor Engine — Nexa's brain.

Every Nexa user message flows through here. Cursor-style agent loop:
plan → call real business tools → respond. Users talk to Nexa; Cursor logic runs everything.
"""

import json
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db_models import CommandLog, User
from app.services.autopilot import run_autopilot
from app.services.business_context import BusinessContext, build_business_context
from app.services.chat import format_execution_reply
from app.services.email_dispatch import try_direct_gmail_send
from app.services.nexa_intelligence import analyze_message

NEXA_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "get_business_snapshot",
            "description": "Read live business metrics from all connected integrations (Stripe, HubSpot, ads, etc.) before multi-tool actions.",
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "send_email",
            "description": "Send a real Gmail email immediately. Use for any outreach, follow-up, or customer email.",
            "parameters": {
                "type": "object",
                "properties": {
                    "instruction": {
                        "type": "string",
                        "description": "Full email intent including recipient email if known",
                    }
                },
                "required": ["instruction"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "execute_command",
            "description": "Run a business command across Stripe, Shopify, Slack, HubSpot, ads, Calendar, Notion, n8n, etc.",
            "parameters": {
                "type": "object",
                "properties": {
                    "command": {"type": "string", "description": "What to execute"},
                },
                "required": ["command"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "run_autopilot",
            "description": "Run a full autonomous business cycle across all connected tools.",
            "parameters": {
                "type": "object",
                "properties": {
                    "mode": {
                        "type": "string",
                        "enum": ["growth", "sales", "full", "ops"],
                        "description": "Autopilot mode",
                    }
                },
                "required": ["mode"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "reply_only",
            "description": "Answer the user conversationally without executing tools.",
            "parameters": {
                "type": "object",
                "properties": {
                    "message": {"type": "string", "description": "Your reply to the user"},
                },
                "required": ["message"],
            },
        },
    },
]


def _system_prompt(context: BusinessContext) -> str:
    connected = ", ".join(context.connected_integrations) if context.connected_integrations else "Gmail (via Google sign-in)"
    narrative = context.business_narrative or "Connect integrations for live business pulse."
    return f"""You are Nexa — an autonomous AI business operator powered by Cursor.

You control the user's real company through live integrations. You MUST use tools to take action — never pretend you sent email or ran commands without calling a tool.

Business:
{context.to_prompt_block()}

Connected tools: {connected}
Business pulse: {narrative}

Rules:
- Before multi-tool ops, call get_business_snapshot to read live metrics
- User wants email → call send_email
- User wants revenue, leads, marketing, ops, checks → call execute_command or run_autopilot
- Questions only → call reply_only
- Be decisive. One tool call per turn when possible.
- After tools run, summarize what happened with verified results."""


async def _groq_complete(messages: list[dict[str, Any]]) -> dict | None:
    """One Groq completion — returns reply text or a single tool call."""
    if not settings.groq_api_key:
        return None
    try:
        from openai import AsyncOpenAI

        client = AsyncOpenAI(
            api_key=settings.groq_api_key,
            base_url="https://api.groq.com/openai/v1",
        )
        model = settings.groq_model or "llama-3.3-70b-versatile"
        r = await client.chat.completions.create(
            model=model,
            messages=messages,
            tools=NEXA_TOOLS,
            tool_choice="auto",
            max_tokens=800,
            temperature=0.4,
        )
        choice = r.choices[0]
        if not choice.message.tool_calls:
            text = (choice.message.content or "").strip()
            return {"action": "reply", "reply": text, "message": choice.message} if text else None

        tc = choice.message.tool_calls[0]
        try:
            args = json.loads(tc.function.arguments or "{}")
        except json.JSONDecodeError:
            args = {}
        return {
            "action": tc.function.name,
            "args": args,
            "tool_call_id": tc.id,
            "message": choice.message,
        }
    except Exception:
        return None


def _build_agent_messages(message: str, history: list[dict], context: BusinessContext) -> list[dict[str, Any]]:
    messages: list[dict[str, Any]] = [{"role": "system", "content": _system_prompt(context)}]
    for item in history[-8:]:
        role = "assistant" if item.get("role") == "nexa" else "user"
        messages.append({"role": role, "content": item.get("content", "")})
    messages.append({"role": "user", "content": message})
    return messages


async def _execute_tool(
    action: str,
    args: dict,
    message: str,
    history: list[dict],
    user: User,
    db: AsyncSession,
    context: BusinessContext,
) -> dict:
    from app.services.chat import _run_execution

    if action == "get_business_snapshot":
        from app.services.business_snapshot import build_business_snapshot
        from app.services.integrations.providers import parse_config

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
        return {
            "reply": snap.narrative or "No live metrics yet — connect Stripe, HubSpot, or ads.",
            "executed": False,
            "snapshot": snap.to_dict(),
        }

    if action == "send_email":
        instruction = args.get("instruction") or message
        analysis = await analyze_message(instruction, history, context)
        result = await try_direct_gmail_send(
            instruction,
            user.id,
            context.company,
            db,
            context=context,
            history=history,
            analysis=analysis,
            sender_name=user.name,
        )
        if result:
            return result
        return {"reply": "Could not send email — check Gmail is connected.", "executed": False}

    if action == "execute_command":
        cmd = args.get("command") or message
        payload = await _run_execution(cmd, user, db, context)
        return payload

    if action == "run_autopilot":
        mode = args.get("mode", "growth")
        ap = await run_autopilot(mode, user, db)
        lines = [ap["summary"]]
        for r in ap.get("results", [])[:4]:
            if r.get("executed"):
                lines.append(f"✓ {r['command'][:60]}")
        return {
            "reply": "\n".join(lines),
            "executed": ap.get("verified_actions", 0) > 0,
            "command_response": {
                "command": f"autopilot:{mode}",
                "intent": "autopilot",
                "summary": ap["summary"],
                "tasks": [],
                "executed_count": ap.get("verified_actions", 0),
                "mode": "live",
            },
        }

    if action == "reply_only":
        return {"reply": args.get("message", ""), "executed": False}

    return {"reply": "I'm ready — tell me what to run.", "executed": False}


async def _fallback_turn(
    message: str,
    history: list[dict],
    user: User,
    db: AsyncSession,
    context: BusinessContext,
) -> dict:
    """Rule + intelligence path when agent loop unavailable."""
    from app.services.chat import _run_execution, ai_chat_reply, rule_chat_reply, should_execute

    analysis = await analyze_message(message, history, context)
    if analysis.get("action") == "send_email":
        result = await try_direct_gmail_send(
            message,
            user.id,
            context.company,
            db,
            context=context,
            history=history,
            analysis=analysis,
            sender_name=user.name,
        )
        if result:
            return result
    if should_execute(message, analysis):
        return await _run_execution(message, user, db, context)
    reply = await ai_chat_reply(message, context, history) or rule_chat_reply(message, context)
    return {"reply": reply, "executed": False}


async def _log_email_send(result: dict, user: User, db: AsyncSession) -> None:
    """Log direct Gmail sends — pipeline handles execute_command logging."""
    if not result.get("executed") or not result.get("command_response"):
        return
    cr = result["command_response"]
    if cr.get("intent") != "send_email":
        return
    db.add(
        CommandLog(
            user_id=user.id,
            command=cr.get("command", ""),
            intent=cr.get("intent", "send_email"),
            summary=cr.get("summary", ""),
            tasks_json=json.dumps(cr.get("tasks", [])),
        )
    )


async def handle_cursor_turn(
    message: str,
    history: list[dict],
    user: User,
    db: AsyncSession,
) -> dict:
    """Single entry point for all Nexa user interactions — Cursor controls everything."""
    text = message.strip()
    if not text:
        return {"reply": "Tell me what you want — I'll run it.", "executed": False, "powered_by": "cursor"}

    context = await build_business_context(user, db)
    messages = _build_agent_messages(text, history, context)

    for _ in range(5):
        agent = await _groq_complete(messages)
        if not agent:
            break

        if agent.get("action") == "reply":
            return {"reply": agent["reply"], "executed": False, "powered_by": "cursor"}

        action = agent.get("action")
        if action not in (
            "get_business_snapshot",
            "send_email",
            "execute_command",
            "run_autopilot",
            "reply_only",
        ):
            break

        # Snapshot is a read step — feed result back to the model, then continue loop
        if action == "get_business_snapshot":
            snap_result = await _execute_tool(
                action, agent.get("args", {}), text, history, user, db, context
            )
            assistant_msg = agent.get("message")
            if assistant_msg:
                messages.append(assistant_msg.model_dump())
            messages.append(
                {
                    "role": "tool",
                    "tool_call_id": agent.get("tool_call_id", ""),
                    "content": json.dumps(
                        snap_result.get("snapshot") or {"narrative": snap_result.get("reply", "")}
                    ),
                }
            )
            continue

        result = await _execute_tool(
            action,
            agent.get("args", {}),
            text,
            history,
            user,
            db,
            context,
        )
        result["powered_by"] = "cursor"
        if action == "send_email":
            await _log_email_send(result, user, db)
        await db.commit()
        return result

    result = await _fallback_turn(text, history, user, db, context)
    result["powered_by"] = "cursor"
    if result.get("command_response", {}).get("intent") == "send_email":
        await _log_email_send(result, user, db)
    await db.commit()
    return result
