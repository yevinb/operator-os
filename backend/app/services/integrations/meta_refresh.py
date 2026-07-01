"""Meta long-lived token refresh."""

import httpx

from app.config import settings

GRAPH = "https://graph.facebook.com/v19.0"


async def refresh_meta_token(access_token: str) -> tuple[str, int]:
    """Exchange for a new long-lived token. Returns (token, expires_in)."""
    if not access_token or not settings.meta_app_id or not settings.meta_app_secret:
        return access_token, 0
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            r = await client.get(
                f"{GRAPH}/oauth/access_token",
                params={
                    "grant_type": "fb_exchange_token",
                    "client_id": settings.meta_app_id,
                    "client_secret": settings.meta_app_secret,
                    "fb_exchange_token": access_token,
                },
            )
            if r.status_code == 200:
                data = r.json()
                return data.get("access_token", access_token), int(data.get("expires_in", 5184000))
    except Exception:
        pass
    return access_token, 0
