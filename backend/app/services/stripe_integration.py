import httpx


async def fetch_stripe_snapshot(secret_key: str) -> dict[str, str | float | int] | None:
    if not secret_key.startswith(("sk_test_", "sk_live_", "rk_test_", "rk_live_")):
        return None

    headers = {"Authorization": f"Bearer {secret_key}"}
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            balance_resp = await client.get("https://api.stripe.com/v1/balance", headers=headers)
            customers_resp = await client.get(
                "https://api.stripe.com/v1/customers",
                headers=headers,
                params={"limit": 100},
            )
            if balance_resp.status_code != 200:
                return {"stripe_status": "error", "stripe_message": "Invalid Stripe key"}

            balance = balance_resp.json()
            customers = customers_resp.json()
            available = sum(a.get("amount", 0) for a in balance.get("available", [])) / 100
            customer_count = len(customers.get("data", []))
            if customers.get("has_more"):
                customer_count = f"{customer_count}+"

            return {
                "stripe_balance_usd": round(available, 2),
                "stripe_customers": customer_count,
            }
    except Exception:
        return None
