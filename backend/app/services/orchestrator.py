import re
import time
import json
from app.models import Task, TaskStatus, CommandResponse
from app.services.business_context import BusinessContext


INTENT_TEMPLATES: dict[str, dict] = {
    "grow_revenue": {
        "summary": "Launching full sales acceleration pipeline across ads, outreach, and conversion optimization.",
        "tasks": [
            ("Analyze sales funnel drop-off points", "analytics"),
            ("Create 3 high-converting ad variants", "marketing"),
            ("Launch Google & Meta campaigns ($500/day)", "marketing"),
            ("Send personalized follow-ups to 47 warm leads", "sales"),
            ("A/B test landing page headline", "marketing"),
            ("Set up conversion tracking pixels", "analytics"),
            ("Schedule daily performance report", "reporting"),
        ],
    },
    "run_company": {
        "summary": "Executing full company operations review and autonomous management cycle.",
        "tasks": [
            ("Check revenue vs. forecast ($124K MTD, +12%)", "finance"),
            ("Review team performance dashboards", "hr"),
            ("Schedule 3 priority meetings this week", "operations"),
            ("Flag underperforming vendor contract", "finance"),
            ("Generate cash flow forecast (90 days)", "finance"),
            ("Reply to 8 pending Slack messages", "communication"),
            ("Update project timelines in Asana", "operations"),
            ("Create executive summary report", "reporting"),
        ],
    },
    "run_marketing": {
        "summary": "Spinning up multi-channel marketing automation.",
        "tasks": [
            ("Draft weekly newsletter (2,400 subscribers)", "marketing"),
            ("Post to LinkedIn, X, and Instagram", "marketing"),
            ("Optimize SEO for top 5 landing pages", "marketing"),
            ("Retarget website visitors with display ads", "marketing"),
            ("Analyze competitor ad spend", "analytics"),
        ],
    },
    "customer_success": {
        "summary": "Handling customer communications and support autonomously.",
        "tasks": [
            ("Reply to 23 customer emails", "support"),
            ("Resolve 5 open support tickets", "support"),
            ("Send onboarding sequence to 12 new signups", "sales"),
            ("Request reviews from satisfied customers", "marketing"),
            ("Flag churn-risk accounts for outreach", "analytics"),
        ],
    },
    "hiring": {
        "summary": "Initiating hiring pipeline for open positions.",
        "tasks": [
            ("Post job listing on LinkedIn & Indeed", "hr"),
            ("Screen 34 incoming applications", "hr"),
            ("Schedule interviews with top 5 candidates", "hr"),
            ("Draft offer letter template", "hr"),
            ("Update org chart and headcount forecast", "operations"),
        ],
    },
    "reporting": {
        "summary": "Generating comprehensive business intelligence report.",
        "tasks": [
            ("Pull revenue data from Stripe", "finance"),
            ("Compile marketing ROI by channel", "analytics"),
            ("Summarize team productivity metrics", "hr"),
            ("Generate PDF executive dashboard", "reporting"),
            ("Email report to stakeholders", "communication"),
        ],
    },
    "general_ops": {
        "summary": "Analyzing your request and deploying autonomous actions across your business.",
        "tasks": [
            ("Parse command intent and priority", "operations"),
            ("Check relevant business data", "analytics"),
            ("Queue autonomous action plan", "operations"),
            ("Execute highest-impact tasks first", "operations"),
            ("Monitor results and self-improve", "analytics"),
        ],
    },
    "cash_flow": {
        "summary": "Analyzing cash position and forecasting runway.",
        "tasks": [
            ("Pull bank balances and Stripe payouts", "finance"),
            ("Calculate 30/60/90 day cash forecast", "finance"),
            ("Flag overdue invoices ($12,400 outstanding)", "finance"),
            ("Recommend expense cuts ($3,200/mo savings)", "finance"),
            ("Email CFO summary with projections", "communication"),
        ],
    },
    "vendor_management": {
        "summary": "Reviewing vendor performance and contracts.",
        "tasks": [
            ("Audit top 10 vendor contracts", "finance"),
            ("Flag underperforming vendor for termination", "operations"),
            ("Draft termination notice", "operations"),
            ("Source 3 replacement vendor quotes", "operations"),
            ("Negotiate better rates with top supplier", "finance"),
        ],
    },
    "scheduling": {
        "summary": "Booking and optimizing your calendar.",
        "tasks": [
            ("Review calendar for conflicts this week", "operations"),
            ("Book sales call with top 3 leads", "sales"),
            ("Schedule team standup Mon/Wed/Fri", "operations"),
            ("Send meeting prep briefs to attendees", "communication"),
            ("Block focus time for deep work", "operations"),
        ],
    },
    "communication": {
        "summary": "Handling Slack messages and team communication.",
        "tasks": [
            ("Reply to 8 pending Slack DMs", "communication"),
            ("Post weekly wins in #general", "communication"),
            ("Summarize #support channel for CEO", "communication"),
            ("Set up alert for revenue milestones", "operations"),
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
        tailored_action = action
        if context and context.company:
            if category == "marketing" and "google" in action.lower() and "google-ads" not in connected:
                tailored_action = f"Draft ad strategy for {company} — connect Google Ads to launch"
            elif category == "finance" and context.live_metrics:
                tailored_action = f"{action} (using live Stripe data)"
            elif industry and i == 0:
                tailored_action = f"{action} for {company}'s {industry} business"
        tasks.append(
            Task(
                id=f"task-{now}-{i}",
                action=tailored_action,
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
