import httpx

from app.services.stripe_integration import fetch_stripe_snapshot
from app.services.webhooks import send_slack_message, trigger_n8n


async def verify_stripe_key(secret_key: str) -> tuple[bool, str]:
    data = await fetch_stripe_snapshot(secret_key)
    if not data:
        return False, "Could not reach Stripe — check your key"
    if data.get("stripe_status") == "error":
        return False, str(data.get("stripe_message", "Invalid Stripe key"))
    bal = data.get("stripe_balance_usd", 0)
    cust = data.get("stripe_customers", 0)
    return True, f"Connected — ${bal} balance, {cust} customers"


async def verify_slack_webhook(url: str) -> tuple[bool, str]:
    ok, msg = await send_slack_message(
        url,
        "✅ OperatorOS connected — your AI COO can post updates to this channel.",
    )
    return ok, msg if ok else f"Slack test failed: {msg}"


async def verify_n8n_webhook(url: str) -> tuple[bool, str]:
    ok, msg = await trigger_n8n(
        url,
        {"event": "operatoros.connect", "message": "OperatorOS connected successfully"},
    )
    return ok, msg if ok else f"n8n test failed: {msg}"
