"""Maps task categories to integrations that can execute them."""

CATEGORY_INTEGRATIONS: dict[str, list[str]] = {
    "finance": ["stripe", "shopify", "quickbooks", "n8n"],
    "marketing": ["instagram", "meta", "google-ads", "n8n", "slack"],
    "sales": ["hubspot", "gmail", "n8n"],
    "support": ["gmail", "hubspot", "notion", "n8n"],
    "communication": ["slack", "gmail", "n8n"],
    "operations": ["calendar", "notion", "n8n", "mcp"],
    "hr": ["linkedin", "notion", "n8n"],
    "analytics": ["stripe", "shopify", "hubspot", "n8n"],
    "reporting": ["notion", "slack", "n8n"],
}

INTEGRATION_LABELS: dict[str, str] = {
    "stripe": "Stripe",
    "slack": "Slack",
    "n8n": "n8n",
    "gmail": "Gmail",
    "calendar": "Google Calendar",
    "google-ads": "Google Ads",
    "meta": "Meta Ads",
    "hubspot": "HubSpot",
    "notion": "Notion",
    "quickbooks": "QuickBooks",
    "linkedin": "LinkedIn",
    "shopify": "Shopify",
    "instagram": "Instagram",
    "mcp": "MCP Server",
}


def integrations_for_category(category: str) -> list[str]:
    return CATEGORY_INTEGRATIONS.get(category, ["n8n", "notion", "slack"])


def missing_integration_hint(category: str, connected: list[str]) -> str:
    for iid in integrations_for_category(category):
        if iid not in connected:
            label = INTEGRATION_LABELS.get(iid, iid)
            return f"Connect {label} in Integrations to run this"
    return "Connect an integration in Integrations to run this"


# Preferred integration order for cross-tool workflows (data flows left → right)
WORKFLOW_CHAINS: dict[str, list[str]] = {
    "grow_revenue": ["stripe", "shopify", "hubspot", "slack", "notion", "n8n"],
    "run_company": ["stripe", "shopify", "slack", "calendar", "notion", "n8n"],
    "run_marketing": ["instagram", "meta", "google-ads", "slack", "n8n"],
    "customer_success": ["gmail", "hubspot", "slack", "n8n"],
    "send_email": ["gmail"],
    "hiring": ["linkedin", "calendar", "notion", "slack"],
    "reporting": ["stripe", "shopify", "hubspot", "notion", "gmail", "slack"],
    "general_ops": ["stripe", "shopify", "hubspot", "n8n", "notion", "slack"],
    "cash_flow": ["stripe", "quickbooks", "slack", "n8n"],
    "vendor_management": ["notion", "slack", "n8n"],
    "scheduling": ["calendar", "gmail", "slack"],
    "communication": ["slack", "gmail", "n8n"],
    "outcome_leads": ["hubspot", "gmail", "instagram", "meta", "google-ads", "slack", "n8n"],
    "outcome_sales": ["stripe", "shopify", "hubspot", "gmail", "notion", "n8n"],
    "outcome_growth": ["instagram", "meta", "google-ads", "shopify", "slack", "calendar", "n8n"],
}

# Map task action keywords to primary integration for workflow ordering
TASK_INTEGRATION_HINTS: list[tuple[str, str]] = [
    ("stripe", "stripe"),
    ("revenue", "stripe"),
    ("balance", "stripe"),
    ("hubspot", "hubspot"),
    ("crm", "hubspot"),
    ("contact", "hubspot"),
    ("slack", "slack"),
    ("notion", "notion"),
    ("gmail", "gmail"),
    ("email", "gmail"),
    ("calendar", "calendar"),
    ("meeting", "calendar"),
    ("schedule", "calendar"),
    ("meta", "meta"),
    ("google ads", "google-ads"),
    ("google-ads", "google-ads"),
    ("quickbooks", "quickbooks"),
    ("linkedin", "linkedin"),
    ("shopify", "shopify"),
    ("store", "shopify"),
    ("orders", "shopify"),
    ("products", "shopify"),
    ("instagram", "instagram"),
    ("followers", "instagram"),
    ("n8n", "n8n"),
    ("workflow", "n8n"),
    ("mcp", "mcp"),
]


def integration_for_task(action: str, category: str) -> str | None:
    lower = action.lower()
    for keyword, iid in TASK_INTEGRATION_HINTS:
        if keyword in lower:
            return iid
    cats = CATEGORY_INTEGRATIONS.get(category, [])
    return cats[0] if cats else None


def workflow_chain_for_intent(intent: str) -> list[str]:
    return WORKFLOW_CHAINS.get(intent, WORKFLOW_CHAINS["general_ops"])


def filter_tasks_by_connected(
    tasks: list[tuple[str, str]],
    connected: list[str],
    intent: str,
) -> tuple[list[tuple[str, str]], list[str]]:
    """Reorder tasks by workflow chain; return skipped integration labels."""
    chain = workflow_chain_for_intent(intent)
    skipped: list[str] = []
    ordered: list[tuple[str, str]] = []
    remaining = list(tasks)

    for iid in chain:
        for i, (action, cat) in enumerate(remaining):
            hint = integration_for_task(action, cat)
            if hint == iid:
                if iid in connected:
                    ordered.append((action, cat))
                else:
                    skipped.append(INTEGRATION_LABELS.get(iid, iid))
                remaining.pop(i)
                break

    for action, cat in remaining:
        hint = integration_for_task(action, cat)
        if hint and hint not in connected:
            skipped.append(INTEGRATION_LABELS.get(hint, hint))
        else:
            ordered.append((action, cat))

    return ordered, skipped
