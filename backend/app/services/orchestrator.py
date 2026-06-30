import re
import time
import json
from app.models import Task, TaskStatus, CommandResponse
from app.services.business_context import BusinessContext


INTENT_TEMPLATES: dict[str, dict] = {
    "grow_revenue": {
        "summary": "Sales acceleration — runs against your connected Stripe, ads, CRM, and automation tools.",
        "tasks": [
            ("Pull live revenue from Stripe", "finance"),
            ("Post sales update to Slack", "communication"),
            ("Sync warm leads from HubSpot", "sales"),
            ("Trigger sales workflow in n8n", "operations"),
            ("Log strategy in Notion", "reporting"),
        ],
    },
    "run_company": {
        "summary": "Company operations review using your live integrations.",
        "tasks": [
            ("Check Stripe balance and customer count", "finance"),
            ("Post ops summary to Slack", "communication"),
            ("Schedule priority meetings on Calendar", "operations"),
            ("Log executive summary in Notion", "reporting"),
            ("Trigger ops workflow in n8n", "operations"),
        ],
    },
    "run_marketing": {
        "summary": "Marketing actions via Meta, Google Ads, Slack, and n8n.",
        "tasks": [
            ("Check Meta ad account status", "marketing"),
            ("Check Google Ads connection", "marketing"),
            ("Post campaign update to Slack", "communication"),
            ("Trigger marketing workflow in n8n", "operations"),
        ],
    },
    "customer_success": {
        "summary": "Customer support via Gmail, HubSpot, and automation.",
        "tasks": [
            ("Send customer update via Gmail", "support"),
            ("Pull CRM contacts from HubSpot", "sales"),
            ("Post support summary to Slack", "communication"),
            ("Trigger support workflow in n8n", "operations"),
        ],
    },
    "hiring": {
        "summary": "Hiring pipeline via LinkedIn, Calendar, and Notion.",
        "tasks": [
            ("Verify LinkedIn API for hiring", "hr"),
            ("Schedule interviews on Calendar", "operations"),
            ("Log hiring plan in Notion", "hr"),
            ("Notify team on Slack", "communication"),
        ],
    },
    "reporting": {
        "summary": "Business report from Stripe, HubSpot, and Notion.",
        "tasks": [
            ("Pull revenue from Stripe", "finance"),
            ("Pull contacts from HubSpot", "analytics"),
            ("Create report page in Notion", "reporting"),
            ("Email report via Gmail", "communication"),
            ("Post summary to Slack", "communication"),
        ],
    },
    "general_ops": {
        "summary": "Parse your command and run against connected tools.",
        "tasks": [
            ("Check live business data", "analytics"),
            ("Execute via n8n automation", "operations"),
            ("Log action in Notion", "reporting"),
            ("Notify team on Slack", "communication"),
        ],
    },
    "cash_flow": {
        "summary": "Cash position from Stripe and QuickBooks.",
        "tasks": [
            ("Pull Stripe balance and payouts", "finance"),
            ("Sync QuickBooks company data", "finance"),
            ("Post cash summary to Slack", "communication"),
            ("Trigger finance workflow in n8n", "operations"),
        ],
    },
    "vendor_management": {
        "summary": "Vendor review logged to Notion and Slack.",
        "tasks": [
            ("Log vendor audit in Notion", "operations"),
            ("Post vendor update to Slack", "communication"),
            ("Trigger vendor workflow in n8n", "operations"),
        ],
    },
    "scheduling": {
        "summary": "Calendar scheduling via Google Calendar.",
        "tasks": [
            ("Book meetings on Google Calendar", "operations"),
            ("Send calendar invite via Gmail", "communication"),
            ("Notify team on Slack", "communication"),
        ],
    },
    "communication": {
        "summary": "Team communication via Slack and Gmail.",
        "tasks": [
            ("Post update to Slack", "communication"),
            ("Send team email via Gmail", "communication"),
            ("Trigger comms workflow in n8n", "operations"),
        ],
    },
}


def detect_intent(command: str) -> str:
    lower = command.lower()
    if re.search(r"sales|revenue|grow|increase|sell", lower):
        return "grow_revenue"
    if re.search(r"company|run my|operate|manage", lower):
        return "run_company"
    if re.search(r"market|ads|campaign|newsletter|social", lower):
        return "run_marketing"
    if re.search(r"customer|support|reply|email|client", lower):
        return "customer_success"
    if re.search(r"hire|recruit|employee|developer|salesperson", lower):
        return "hiring"
    if re.search(r"report|dashboard|summary", lower):
        return "reporting"
    if re.search(r"cash|flow|runway|forecast", lower):
        return "cash_flow"
    if re.search(r"vendor|fire|terminate|contract", lower):
        return "vendor_management"
    if re.search(r"meeting|schedule|calendar|book", lower):
        return "scheduling"
    if re.search(r"slack|message|team", lower):
        return "communication"
    return "general_ops"


async def execute_with_ai(
    command: str,
    provider: str,
    openai_key: str,
    anthropic_key: str,
    context: BusinessContext | None = None,
) -> CommandResponse | None:
    """Try AI-powered intent parsing. Returns None if unavailable."""
    business_block = context.to_prompt_block() if context else "No business profile yet."
    system_prompt = f"""You are OperatorOS, an AI Chief Operating Officer.
You know this business:
{business_block}

Given a business command, return JSON with:
- intent: snake_case intent id
- summary: one sentence of what you're doing FOR THIS SPECIFIC BUSINESS
- tasks: array of {{action: string, category: string}} (3-8 tasks tailored to their industry, goals, and connected tools)

Categories: marketing, support, analytics, hr, finance, communication, operations, reporting, sales
Return ONLY valid JSON, no markdown."""

    user_content = command
    if context and context.company:
        user_content = f"Business: {context.company}\nCommand: {command}"

    try:
        if provider in ("openai", "auto") and openai_key:
            from openai import AsyncOpenAI
            client = AsyncOpenAI(api_key=openai_key)
            resp = await client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_content},
                ],
                response_format={"type": "json_object"},
            )
            data = json.loads(resp.choices[0].message.content or "{}")
            return _build_response(command, data)

        if provider in ("anthropic", "auto") and anthropic_key:
            from anthropic import AsyncAnthropic
            client = AsyncAnthropic(api_key=anthropic_key)
            resp = await client.messages.create(
                model="claude-3-5-haiku-latest",
                max_tokens=1024,
                system=system_prompt,
                messages=[{"role": "user", "content": user_content}],
            )
            text = resp.content[0].text
            data = json.loads(text)
            return _build_response(command, data)
    except Exception:
        pass

    return None


def _build_response(command: str, data: dict) -> CommandResponse:
    now = int(time.time() * 1000)
    tasks = [
        Task(
            id=f"task-{now}-{i}",
            action=t.get("action", "Execute task"),
            category=t.get("category", "operations"),
            status=TaskStatus.pending,
        )
        for i, t in enumerate(data.get("tasks", []))
    ]
    return CommandResponse(
        command=command,
        intent=data.get("intent", "general_ops"),
        summary=data.get("summary", "Executing autonomous actions."),
        tasks=tasks,
    )


def execute_with_rules(command: str, context: BusinessContext | None = None) -> CommandResponse:
    intent = detect_intent(command)
    template = INTENT_TEMPLATES[intent]
    now = int(time.time() * 1000)

    company = context.company if context else "your business"
    industry = context.industry if context else ""
    goal = context.goal if context else ""
    connected = context.connected_integrations if context else []

    summary = template["summary"]
    if context and context.company:
        summary = f"For {company}"
        if industry:
            summary += f" ({industry})"
        summary += f": {template['summary']}"
        if goal:
            summary += f" Focus: {goal}."

    tasks = []
    for i, (action, category) in enumerate(template["tasks"]):
        tasks.append(
            Task(
                id=f"task-{now}-{i}",
                action=action,
                category=category,
                status=TaskStatus.pending,
            )
        )

    return CommandResponse(
        command=command,
        intent=intent,
        summary=summary,
        tasks=tasks,
    )


async def orchestrate_command(
    command: str,
    ai_provider: str = "auto",
    openai_key: str = "",
    anthropic_key: str = "",
    context: BusinessContext | None = None,
) -> CommandResponse:
    if ai_provider != "rules":
        ai_result = await execute_with_ai(command, ai_provider, openai_key, anthropic_key, context)
        if ai_result:
            return ai_result

    return execute_with_rules(command, context)
