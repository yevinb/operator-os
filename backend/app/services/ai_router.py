from app.services.ai_clients import complete_json


async def route_to_ai(command: str, provider: str = "auto") -> dict | None:
    """Route command to Groq, GPT, Claude, or Gemini. Returns parsed JSON or None."""
    system = """You are Nexa, an AI Chief Operating Officer.
Return JSON: {"intent": "snake_case", "summary": "one sentence", "tasks": [{"action": "...", "category": "..."}]}
Categories: marketing, support, analytics, hr, finance, communication, operations, reporting, sales"""
    return await complete_json(system, command, max_tokens=1024)
