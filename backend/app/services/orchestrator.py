import json
import re
import time

from app.models import CommandResponse, Task, TaskStatus
from app.services.ai_clients import complete_json
from app.services.business_context import BusinessContext
from app.services.integration_map import filter_tasks_by_connected
from app.services.niche_modes import get_niche


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
    "send_email": {
        "summary": "Send email via connected Gmail.",
        "tasks": [
            ("Send email via Gmail", "communication"),
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
    "outcome_leads": {
        "summary": "Lead generation plan — outreach, ads, CRM sync, and daily optimization.",
        "tasks": [
            ("Build ICP and 50-lead target list", "marketing"),
            ("Draft 3-step cold outreach sequence", "sales"),
            ("Launch paid test campaign (Meta/Google)", "marketing"),
            ("Sync warm leads to HubSpot CRM", "sales"),
            ("Post daily lead count to Slack", "communication"),
            ("Trigger lead nurture workflow in n8n", "operations"),
        ],
    },
    "outcome_sales": {
        "summary": "Sales acceleration — pipeline, offers, and conversion optimization.",
        "tasks": [
            ("Pull revenue baseline from Stripe", "finance"),
            ("Audit funnel and draft 2 upsell offers", "sales"),
            ("Send win-back email to dormant leads", "communication"),
            ("Log sales playbook in Notion", "reporting"),
            ("Trigger sales workflow in n8n", "operations"),
        ],
    },
    "outcome_growth": {
        "summary": "Growth sprint — acquisition, retention, and weekly optimization.",
        "tasks": [
            ("Define growth KPIs for this sprint", "analytics"),
            ("Launch content + paid acquisition test", "marketing"),
            ("Post growth metrics to Slack", "communication"),
            ("Schedule weekly review on Calendar", "operations"),
            ("Trigger growth workflow in n8n", "operations"),
        ],
    },
}


def detect_intent(command: str) -> str:
    lower = command.lower()
    if re.search(r"send.*email|email.*to|write.*email|gmail", lower):
        return "send_email"
    if re.search(r"(\d+)\s*leads?", lower) or "get me" in lower and "lead" in lower:
        return "outcome_leads"
    if re.search(r"(\d+)\s*sales?", lower) or "increase sales" in lower:
        return "outcome_sales"
    if re.search(r"grow|scale|followers|instagram", lower) and not re.search(r"revenue|company", lower):
        return "outcome_growth"
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
    system_prompt = f"""You are Nexa, an AI Chief Operating Officer.
You know this business:
{business_block}

Given a business command, return JSON with:
- intent: snake_case intent id
- summary: one sentence of what you're doing FOR THIS SPECIFIC BUSINESS
- tasks: array of {{action: string, category: string}} (3-8 tasks tailored to their industry, goals, and connected tools)
- Each task should reference building on prior steps when multiple integrations are involved (e.g. "Post Stripe + HubSpot summary to Slack")

Categories: marketing, support, analytics, hr, finance, communication, operations, reporting, sales
Return ONLY valid JSON, no markdown."""

    user_content = command
    if context and context.company:
        user_content = f"Business: {context.company}\nCommand: {command}"

    data = await complete_json(system_prompt, user_content, max_tokens=1024)
    if data:
        return _build_response(command, data)
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
    niche = get_niche(context.niche_mode if context else None)

    summary = template["summary"]
    if context and context.company:
        summary = f"For {company} ({niche.emoji} {niche.label})"
        if industry:
            summary += f" · {industry}"
        summary += f": {template['summary']}"
        if goal:
            summary += f" Focus: {goal}."

    task_source = template["tasks"]
    if intent == "general_ops" and niche.id != "general":
        cats = ["marketing", "sales", "communication", "reporting", "operations"]
        task_source = [(a, cats[i % len(cats)]) for i, a in enumerate(niche.workflows)]

    filtered, skipped = filter_tasks_by_connected(task_source, connected, intent)
    if skipped and context and context.company:
        skip_note = ", ".join(sorted(set(skipped)))
        summary += f" Connect {skip_note} for full workflow."

    tasks = []
    for i, (action, category) in enumerate(filtered):
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
            return _apply_workflow_filter(ai_result, context)

    return execute_with_rules(command, context)


def _apply_workflow_filter(response: CommandResponse, context: BusinessContext | None) -> CommandResponse:
    if not context or not context.connected_integrations:
        return response
    from app.services.integration_map import filter_tasks_by_connected

    task_tuples = [(t.action, t.category) for t in response.tasks]
    filtered, skipped = filter_tasks_by_connected(
        task_tuples, context.connected_integrations, response.intent
    )
    if not filtered:
        return response
    now = int(time.time() * 1000)
    tasks = [
        Task(
            id=f"task-{now}-{i}",
            action=action,
            category=category,
            status=TaskStatus.pending,
        )
        for i, (action, category) in enumerate(filtered)
    ]
    summary = response.summary
    if skipped:
        summary += f" Connect {', '.join(sorted(set(skipped)))} for full workflow."
    return response.model_copy(update={"tasks": tasks, "summary": summary})
