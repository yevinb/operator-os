from app.services.integrations.google import verify_google_ads, verify_google_tokens
from app.services.integrations.providers import (
    parse_config,
    verify_hubspot,
    verify_linkedin,
    verify_mcp,
    verify_meta,
    verify_notion,
    verify_quickbooks,
)
from app.services.instagram_integration import verify_instagram
from app.services.shopify_integration import verify_shopify
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
    ok, msg = await send_slack_message(url, "✅ Nexa connected to Slack.")
    return ok, msg if ok else f"Slack failed: {msg}"


async def verify_n8n_webhook(url: str) -> tuple[bool, str]:
    ok, msg = await trigger_n8n(url, {"event": "nexa.connect"})
    return ok, msg if ok else f"n8n failed: {msg}"


async def verify_integration(
    integration_id: str,
    api_key: str,
    config_json: str = "{}",
) -> tuple[bool, str]:
    config = parse_config(config_json)

    if integration_id == "stripe":
        return await verify_stripe_key(api_key)
    if integration_id == "slack":
        return await verify_slack_webhook(api_key)
    if integration_id == "n8n":
        return await verify_n8n_webhook(api_key)
    if integration_id == "hubspot":
        return await verify_hubspot(api_key)
    if integration_id == "notion":
        return await verify_notion(api_key)
    if integration_id == "meta":
        return await verify_meta(api_key, config.get("ad_account_id", ""))
    if integration_id == "linkedin":
        return await verify_linkedin(api_key)
    if integration_id == "quickbooks":
        return await verify_quickbooks(api_key, config.get("realm_id", ""))
    if integration_id == "mcp":
        return await verify_mcp(api_key)
    if integration_id in ("gmail", "calendar"):
        return await verify_google_tokens(config)
    if integration_id == "google-ads":
        google_cfg = config.get("google_oauth", {})
        access = google_cfg.get("access_token", "")
        if not access and google_cfg.get("refresh_token"):
            from app.services.integrations.google import refresh_google_token
            refreshed = await refresh_google_token(google_cfg["refresh_token"])
            if refreshed:
                access = refreshed["access_token"]
        return await verify_google_ads(
            config.get("developer_token", api_key),
            config.get("customer_id", ""),
            access,
        )
    if integration_id == "shopify":
        return await verify_shopify(config.get("shop_domain", ""), api_key)
    if integration_id == "instagram":
        return await verify_instagram(api_key, config.get("instagram_account_id", ""))

    return True, "Connected"
