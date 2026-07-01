"""QuickBooks OAuth token refresh."""

import base64

import httpx

from app.config import settings


def _basic_auth() -> str:
    raw = f"{settings.intuit_client_id}:{settings.intuit_client_secret}"
    return base64.b64encode(raw.encode()).decode()


async def refresh_quickbooks_token(refresh_token: str) -> dict | None:
    if not refresh_token or not settings.intuit_client_id:
        return None
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            r = await client.post(
                settings.intuit_token_url,
                headers={
                    "Authorization": f"Basic {_basic_auth()}",
                    "Content-Type": "application/x-www-form-urlencoded",
                    "Accept": "application/json",
                },
                data={
                    "grant_type": "refresh_token",
                    "refresh_token": refresh_token,
                },
            )
            if r.status_code != 200:
                return None
            data = r.json()
            return {
                "access_token": data.get("access_token", ""),
                "refresh_token": data.get("refresh_token", refresh_token),
                "expires_in": int(data.get("expires_in", 3600)),
            }
    except Exception:
        return None


async def resolve_quickbooks_access(api_key: str, config: dict) -> tuple[str, dict]:
    """Return working QuickBooks access token, refreshing when needed."""
    access = (api_key or "").strip()
    refresh = config.get("refresh_token", "")
    if access:
        return access, config
    if refresh:
        refreshed = await refresh_quickbooks_token(refresh)
        if refreshed and refreshed.get("access_token"):
            return refreshed["access_token"], {**config, **refreshed}
    return "", config

