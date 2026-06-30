import httpx


async def post_json_webhook(url: str, payload: dict) -> tuple[bool, str]:
    if not url.startswith("https://"):
        return False, "Invalid webhook URL — must start with https://"
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(url, json=payload)
            if resp.status_code < 400:
                return True, "Webhook delivered"
            return False, f"Webhook failed ({resp.status_code})"
    except Exception as e:
        return False, str(e)


async def send_slack_message(webhook_url: str, text: str) -> tuple[bool, str]:
    return await post_json_webhook(webhook_url, {"text": text})


async def trigger_n8n(webhook_url: str, payload: dict) -> tuple[bool, str]:
    return await post_json_webhook(webhook_url, payload)
