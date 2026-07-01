"""Unified AI clients — OpenAI, Groq, Anthropic, Gemini."""

import json
import re

import httpx

from app.config import settings

GROQ_BASE_URL = "https://api.groq.com/openai/v1"
DEFAULT_GROQ_MODEL = "llama-3.3-70b-versatile"


def has_any_ai_key() -> bool:
    return bool(
        settings.groq_api_key
        or settings.openai_api_key
        or settings.anthropic_api_key
        or settings.gemini_api_key
    )


def _provider_order() -> list[str]:
    p = settings.ai_provider
    if p == "rules":
        return []
    if p != "auto":
        return [p]
    # auto: Groq first (fast + generous free tier), then others
    order = []
    if settings.groq_api_key:
        order.append("groq")
    if settings.openai_api_key:
        order.append("openai")
    if settings.anthropic_api_key:
        order.append("anthropic")
    if settings.gemini_api_key:
        order.append("gemini")
    return order


def active_provider_name() -> str:
    if settings.ai_provider == "rules":
        return "rules"
    order = _provider_order()
    return order[0] if order else "rules"


async def complete_json(system: str, user: str, max_tokens: int = 600) -> dict | None:
    for provider in _provider_order():
        data = await _complete_json_provider(provider, system, user, max_tokens)
        if data:
            return data
    return None


async def complete_text(
    system: str,
    messages: list[dict],
    max_tokens: int = 450,
    temperature: float = 0.7,
) -> str | None:
    for provider in _provider_order():
        text = await _complete_text_provider(provider, system, messages, max_tokens, temperature)
        if text:
            return text
    return None


async def _complete_json_provider(
    provider: str, system: str, user: str, max_tokens: int
) -> dict | None:
    if provider == "groq" and settings.groq_api_key:
        try:
            from openai import AsyncOpenAI

            client = AsyncOpenAI(
                api_key=settings.groq_api_key,
                base_url=GROQ_BASE_URL,
            )
            r = await client.chat.completions.create(
                model=settings.groq_model or DEFAULT_GROQ_MODEL,
                messages=[
                    {"role": "system", "content": system + "\nReturn ONLY valid JSON."},
                    {"role": "user", "content": user},
                ],
                response_format={"type": "json_object"},
                max_tokens=max_tokens,
                temperature=0.4,
            )
            return json.loads(r.choices[0].message.content or "{}")
        except Exception:
            pass

    if provider == "openai" and settings.openai_api_key:
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

    if provider == "anthropic" and settings.anthropic_api_key:
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

    if provider == "gemini" and settings.gemini_api_key:
        try:
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


async def _complete_text_provider(
    provider: str,
    system: str,
    messages: list[dict],
    max_tokens: int,
    temperature: float,
) -> str | None:
    if provider == "groq" and settings.groq_api_key:
        try:
            from openai import AsyncOpenAI

            client = AsyncOpenAI(
                api_key=settings.groq_api_key,
                base_url=GROQ_BASE_URL,
            )
            r = await client.chat.completions.create(
                model=settings.groq_model or DEFAULT_GROQ_MODEL,
                messages=[{"role": "system", "content": system}, *messages],
                max_tokens=max_tokens,
                temperature=temperature,
            )
            return (r.choices[0].message.content or "").strip() or None
        except Exception:
            pass

    if provider == "openai" and settings.openai_api_key:
        try:
            from openai import AsyncOpenAI

            client = AsyncOpenAI(api_key=settings.openai_api_key)
            r = await client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[{"role": "system", "content": system}, *messages],
                max_tokens=max_tokens,
                temperature=temperature,
            )
            return (r.choices[0].message.content or "").strip() or None
        except Exception:
            pass

    if provider == "anthropic" and settings.anthropic_api_key:
        try:
            from anthropic import AsyncAnthropic

            client = AsyncAnthropic(api_key=settings.anthropic_api_key)
            r = await client.messages.create(
                model="claude-3-5-haiku-latest",
                max_tokens=max_tokens,
                system=system,
                messages=messages,
            )
            return (r.content[0].text or "").strip() or None
        except Exception:
            pass

    if provider == "gemini" and settings.gemini_api_key:
        try:
            hist = "\n".join(f"{m['role']}: {m['content']}" for m in messages[-10:])
            url = (
                "https://generativelanguage.googleapis.com/v1beta/models/"
                f"gemini-1.5-flash:generateContent?key={settings.gemini_api_key}"
            )
            async with httpx.AsyncClient(timeout=25) as client:
                r = await client.post(
                    url,
                    json={"contents": [{"parts": [{"text": f"{system}\n\n{hist}"}]}]},
                )
                data = r.json()
                return data["candidates"][0]["content"]["parts"][0]["text"].strip() or None
        except Exception:
            pass

    return None
