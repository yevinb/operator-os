"""Nexa intelligence — understand intent, compose emails, act autonomously."""

import json
import re

from app.config import settings
from app.services.business_context import BusinessContext

EMAIL_RE = re.compile(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}")

EMAIL_ACTION_WORDS = (
    "send",
    "email",
    "mail",
    "write",
    "draft",
    "compose",
    "reach out",
    "follow up",
    "follow-up",
    "message",
    "notify",
    "tell",
    "introduce",
    "reply",
    "respond",
    "gmail",
    "outreach",
    "cold email",
    "business email",
)

EXECUTE_WORDS = (
    "get me",
    "increase",
    "launch",
    "check",
    "grow",
    "book",
    "hire",
    "post",
    "run",
    "create",
    "scale",
    "pull",
    "sync",
    "schedule",
    "execute",
    "control",
    "find me",
    "automate",
)


async def _call_json_ai(system: str, user: str, max_tokens: int = 600) -> dict | None:
    provider = settings.ai_provider

    if provider in ("openai", "auto") and settings.openai_api_key:
        try:
            from openai import AsyncOpenAI

            client = AsyncOpenAI(api_key=settings.openai_api_key)
            r = await client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": system},
                    {"role": "user", "content": user},
                ],
                response_format={"type": "json_object"},
                max_tokens=max_tokens,
            )
            return json.loads(r.choices[0].message.content or "{}")
        except Exception:
            pass

    if provider in ("anthropic", "auto") and settings.anthropic_api_key:
        try:
            from anthropic import AsyncAnthropic

            client = AsyncAnthropic(api_key=settings.anthropic_api_key)
            r = await client.messages.create(
                model="claude-3-5-haiku-latest",
                max_tokens=max_tokens,
                system=system + "\nReturn ONLY valid JSON.",
                messages=[{"role": "user", "content": user}],
            )
            text = r.content[0].text.strip()
            if text.startswith("```"):
                text = re.sub(r"^```(?:json)?\s*|\s*```$", "", text, flags=re.MULTILINE)
            return json.loads(text)
        except Exception:
            pass

    if provider in ("gemini", "auto") and settings.gemini_api_key:
        try:
            import httpx

            url = (
                "https://generativelanguage.googleapis.com/v1beta/models/"
                f"gemini-1.5-flash:generateContent?key={settings.gemini_api_key}"
            )
            payload = {
                "contents": [{"parts": [{"text": f"{system}\n\n{user}"}]}],
                "generationConfig": {"responseMimeType": "application/json"},
            }
            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(url, json=payload)
                data = resp.json()
                text = data["candidates"][0]["content"]["parts"][0]["text"]
                return json.loads(text)
        except Exception:
            pass

    return None


def _emails_from_history(history: list[dict]) -> list[str]:
    found: list[str] = []
    for item in history[-12:]:
        found.extend(EMAIL_RE.findall(item.get("content", "")))
    return found


def _infer_purpose(message: str) -> str:
    lower = message.lower()
    if any(w in lower for w in ("intro", "introduction", "meet", "connect")):
        return "introduction"
    if any(w in lower for w in ("follow up", "follow-up", "checking in", "touch base")):
        return "follow_up"
    if any(w in lower for w in ("thank", "thanks", "grateful")):
        return "thank_you"
    if any(w in lower for w in ("update", "status", "progress")):
        return "update"
    if any(w in lower for w in ("proposal", "quote", "offer", "pricing")):
        return "sales"
    return "general"


def _rule_compose_email(
    company: str,
    message: str,
    purpose: str,
    context: BusinessContext | None,
    sender_name: str = "",
) -> tuple[str, str]:
    industry = context.industry if context else ""
    goal = context.goal if context else "grow the business"
    market = context.market if context else ""
    sign_name = sender_name or company

    templates = {
        "introduction": (
            f"Introduction from {company}",
            f"""Hello,

I hope this message finds you well. I'm reaching out from {company}"""
            + (f", where we specialize in {industry}" if industry else "")
            + f""".

{message}

I'd welcome the chance to connect and explore how we might work together"""
            + (f" — especially as we focus on {goal.lower()}" if goal else "")
            + (f" across {market}" if market else "")
            + f""".

Would you be open to a brief conversation this week?

Best regards,
{sign_name}
{company}""",
        ),
        "follow_up": (
            f"Following up — {company}",
            f"""Hi,

I wanted to follow up on my previous message and keep the conversation moving.

{message}

Happy to adjust timing or details — just let me know what works best for you.

Best,
{sign_name}
{company}""",
        ),
        "thank_you": (
            f"Thank you — {company}",
            f"""Hello,

Thank you for your time and attention.

{message}

I appreciate the opportunity to connect.

Warm regards,
{sign_name}
{company}""",
        ),
        "sales": (
            f"Proposal from {company}",
            f"""Hello,

Thank you for your interest in {company}.

{message}

I'd be glad to walk through next steps at your convenience.

Best regards,
{sign_name}
{company}""",
        ),
        "update": (
            f"Update from {company}",
            f"""Hello,

I wanted to share a quick update from {company}.

{message}

Please let me know if you have any questions.

Best,
{sign_name}
{company}""",
        ),
    }

    if purpose in templates:
        return templates[purpose]
    return (
        f"[{company}] Message from Nexa",
        f"""Hello,

I'm reaching out from {company}.

{message}

Best regards,
{sign_name}
{company}""",
    )


async def compose_email(
    message: str,
    company: str,
    context: BusinessContext | None,
    history: list[dict],
    sender_name: str = "",
    purpose: str = "",
) -> tuple[str, str]:
    purpose = purpose or _infer_purpose(message)
    block = context.to_prompt_block() if context else f"Company: {company}"
    hist = "\n".join(
        f"{h.get('role', 'user')}: {h.get('content', '')[:200]}"
        for h in history[-6:]
    )

    system = """You are Nexa, an elite AI Chief Operating Officer writing business email on behalf of the user.
Return JSON only: {"subject": "...", "body": "..."}
Rules:
- Professional, warm, concise — not robotic
- Write the full email body (greeting, substance, sign-off) — do NOT paste the user's raw command verbatim
- Infer what to say from the user's intent and business context
- Subject under 70 chars, body 80-220 words unless user asked for very short
- Sign with the sender/company name provided"""

    user = f"""Business context:
{block}
Sender name: {sender_name or company}
Email purpose: {purpose}

Recent chat:
{hist or "(none)"}

User request (write the email they want sent):
{message}"""

    data = await _call_json_ai(system, user, max_tokens=700)
    if data and data.get("subject") and data.get("body"):
        return str(data["subject"]).strip(), str(data["body"]).strip()

    return _rule_compose_email(company, message, purpose, context, sender_name)


def _rule_classify(message: str, history: list[dict], context: BusinessContext | None) -> dict:
    lower = message.lower().strip()
    emails = EMAIL_RE.findall(message)
    hist_emails = _emails_from_history(history)

    wants_email = any(w in lower for w in EMAIL_ACTION_WORDS)
    wants_execute = any(w in lower for w in EXECUTE_WORDS)

    if wants_email or (emails and "email" in lower):
        recipient = emails[-1] if emails else (hist_emails[-1] if hist_emails else "")
        return {
            "action": "send_email",
            "recipient_email": recipient,
            "email_purpose": _infer_purpose(message),
            "confidence": 0.85 if recipient else 0.6,
            "reasoning": "Email intent detected",
        }

    # Multi-sentence commands that sound like outcomes
    if len(lower.split()) >= 5 and not lower.endswith("?"):
        if wants_execute:
            return {"action": "execute", "confidence": 0.7, "reasoning": "Outcome command"}

    if lower.endswith("?"):
        return {"action": "chat", "confidence": 0.8, "reasoning": "Question"}

    if wants_execute:
        return {"action": "execute", "confidence": 0.75, "reasoning": "Action verb"}

    return {"action": "chat", "confidence": 0.5, "reasoning": "Conversation"}


async def analyze_message(
    message: str,
    history: list[dict],
    context: BusinessContext | None,
) -> dict:
    """Decide what Nexa should do: send_email, execute, or chat."""
    rule = _rule_classify(message, history, context)
    if settings.ai_provider == "rules" and not _has_ai_key():
        return rule

    block = context.to_prompt_block() if context else "No business profile"
    connected = ", ".join(context.connected_integrations) if context else ""
    hist = "\n".join(
        f"{h.get('role', 'user')}: {h.get('content', '')[:180]}"
        for h in history[-8:]
    )

    system = """You are Nexa's autonomous decision engine. Classify the user's latest message.

Return JSON only:
{
  "action": "send_email" | "execute" | "chat",
  "recipient_email": "email or null",
  "recipient_name": "name or null",
  "email_purpose": "introduction|follow_up|thank_you|sales|update|general",
  "confidence": 0.0-1.0,
  "reasoning": "brief"
}

Rules:
- send_email: user wants an email sent/drafted/reached out — even casual ("tell john we're ready", "follow up with the client")
- execute: user wants business actions run (leads, revenue, marketing, stripe, slack, calendar, reports)
- chat: questions, greetings, help, strategy discussion without immediate execution
- Extract recipient email from message OR recent chat if obvious
- Prefer send_email when Gmail is connected and intent is clearly emailing"""

    user = f"""Connected tools: {connected or "none"}
{block}

Recent chat:
{hist or "(none)"}

Latest message:
{message}"""

    data = await _call_json_ai(system, user, max_tokens=350)
    if not data or "action" not in data:
        return rule

    action = data.get("action", "chat")
    if action not in ("send_email", "execute", "chat"):
        action = rule["action"]

    recipient = data.get("recipient_email") or rule.get("recipient_email") or ""
    if recipient and not EMAIL_RE.match(str(recipient)):
        recipient = ""

    if not recipient:
        emails = EMAIL_RE.findall(message) or _emails_from_history(history)
        recipient = emails[-1] if emails else ""

    return {
        "action": action,
        "recipient_email": recipient,
        "recipient_name": data.get("recipient_name") or "",
        "email_purpose": data.get("email_purpose") or _infer_purpose(message),
        "confidence": float(data.get("confidence", 0.8)),
        "reasoning": data.get("reasoning", ""),
    }


def _has_ai_key() -> bool:
    return bool(settings.openai_api_key or settings.anthropic_api_key or settings.gemini_api_key)


def wants_email_action(message: str, analysis: dict | None = None) -> bool:
    if analysis and analysis.get("action") == "send_email":
        return True
    lower = message.lower()
    return any(w in lower for w in EMAIL_ACTION_WORDS)
