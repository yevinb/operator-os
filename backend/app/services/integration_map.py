"""Maps task categories to integrations that can execute them."""

CATEGORY_INTEGRATIONS: dict[str, list[str]] = {
    "finance": ["stripe", "quickbooks", "n8n"],
    "marketing": ["meta", "google-ads", "n8n", "slack"],
    "sales": ["hubspot", "gmail", "n8n"],
    "support": ["gmail", "hubspot", "notion", "n8n"],
    "communication": ["slack", "gmail", "n8n"],
    "operations": ["calendar", "notion", "n8n", "mcp"],
    "hr": ["linkedin", "notion", "n8n"],
    "analytics": ["stripe", "hubspot", "n8n"],
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
