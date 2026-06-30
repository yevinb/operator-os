import json
from app.config import settings


async def route_to_ai(command: str, provider: str = "auto") -> dict | None:
    """Route command to GPT, Claude, or Gemini. Returns parsed JSON or None."""
    system = """You are OperatorOS, an AI Chief Operating Officer.
Return JSON: {"intent": "snake_case", "summary": "one sentence", "tasks": [{"action": "...", "category": "..."}]}
Categories: marketing, support, analytics, hr, finance, communication, operations, reporting, sales"""

    if provider in ("openai", "auto") and settings.openai_api_key:
        try:
            from openai import AsyncOpenAI
            client = AsyncOpenAI(api_key=settings.openai_api_key)
            r = await client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": system},
                    {"role": "user", "content": command},
                ],
                response_format={"type": "json_object"},
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
                max_tokens=1024,
                system=system,
                messages=[{"role": "user", "content": command}],
            )
            return json.loads(r.content[0].text)
        except Exception:
            pass

    if provider in ("gemini", "auto") and settings.gemini_api_key:
        try:
            import httpx
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={settings.gemini_api_key}"
            payload = {
                "contents": [{"parts": [{"text": f"{system}\n\nCommand: {command}"}]}],
                "generationConfig": {"responseMimeType": "application/json"},
            }
            async with httpx.AsyncClient() as client:
                resp = await client.post(url, json=payload, timeout=30)
                data = resp.json()
                text = data["candidates"][0]["content"]["parts"][0]["text"]
                return json.loads(text)
        except Exception:
            pass

    return None
