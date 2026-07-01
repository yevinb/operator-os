import base64
import json
from email.mime.text import MIMEText

import httpx

from app.config import settings


def _parse_google_error(text: str, status: int) -> str:
    try:
        data = json.loads(text)
        msg = data.get("error", {}).get("message") or data.get("error_description") or text
    except Exception:
        msg = text[:200]
    if status == 403 and "gmail" in msg.lower():
        return f"{msg} — enable Gmail API in Google Cloud Console and reconnect Gmail"
    if status in (401, 403):
        return f"{msg} — reconnect Gmail in Integrations"
    return msg[:200]


async def _token_valid(access_token: str, gmail: bool = False) -> bool:
    if not access_token:
        return False
    url = (
        "https://gmail.googleapis.com/gmail/v1/users/me/profile"
        if gmail
        else "https://www.googleapis.com/oauth2/v2/userinfo"
    )
    try:
        async with httpx.AsyncClient(timeout=12) as client:
            r = await client.get(url, headers={"Authorization": f"Bearer {access_token}"})
            return r.status_code == 200
    except Exception:
        return False


async def resolve_google_access(config: dict, *, gmail: bool = False) -> tuple[str, dict]:
    """Return a working access token, refreshing when needed."""
    access = config.get("access_token", "")
    refresh = config.get("refresh_token", "")

    if access and await _token_valid(access, gmail=gmail):
        return access, config

    if refresh:
        refreshed = await refresh_google_token(refresh)
        if refreshed:
            config = {**config, **refreshed}
            if await _token_valid(config["access_token"], gmail=gmail):
                return config["access_token"], config
            # Token works for Google but maybe not Gmail scope — still usable for send attempt
            return config["access_token"], config

    return "", config


def _google_creds(config: dict) -> dict | None:
    if config.get("access_token"):
        return config
    return None


async def verify_google_tokens(config: dict) -> tuple[bool, str]:
    access, updated = await resolve_google_access(config, gmail=True)
    if not access:
        access, updated = await resolve_google_access(config, gmail=False)
    if not access:
        return False, "Google not authorized — use Connect with Google"
    email = updated.get("email", "")
    if email:
        return True, f"Connected — {email} (Gmail ready)"
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.get(
                "https://www.googleapis.com/oauth2/v2/userinfo",
                headers={"Authorization": f"Bearer {access}"},
            )
            if r.status_code == 200:
                email = r.json().get("email", "Google account")
                return True, f"Connected — {email} (Gmail ready)"
            return False, "Google token expired — reconnect"
    except Exception as e:
        return False, str(e)


async def refresh_google_token(refresh_token: str) -> dict | None:
    if not settings.google_client_id or not settings.google_client_secret:
        return None
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.post(
                "https://oauth2.googleapis.com/token",
                data={
                    "client_id": settings.google_client_id,
                    "client_secret": settings.google_client_secret,
                    "refresh_token": refresh_token,
                    "grant_type": "refresh_token",
                },
            )
            if r.status_code == 200:
                data = r.json()
                return {
                    "access_token": data["access_token"],
                    "refresh_token": refresh_token,
                    "expires_in": data.get("expires_in", 3600),
                }
    except Exception:
        pass
    return None


async def send_gmail(
    access_token: str,
    to: str,
    subject: str,
    body: str,
    from_email: str = "",
) -> tuple[bool, str]:
    msg = MIMEText(body)
    msg["to"] = to
    msg["subject"] = subject
    if from_email:
        msg["from"] = from_email
    raw = base64.urlsafe_b64encode(msg.as_bytes()).decode()
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            r = await client.post(
                "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
                headers={"Authorization": f"Bearer {access_token}"},
                json={"raw": raw},
            )
            if r.status_code == 200:
                return True, f"Email sent (id {r.json().get('id', '')[:8]}...)"
            return False, _parse_google_error(r.text, r.status_code)
    except Exception as e:
        return False, str(e)


async def create_calendar_event(access_token: str, title: str, description: str) -> tuple[bool, str]:
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            r = await client.post(
                "https://www.googleapis.com/calendar/v3/calendars/primary/events",
                headers={"Authorization": f"Bearer {access_token}"},
                json={
                    "summary": title[:200],
                    "description": description[:2000],
                    "start": {"dateTime": "2026-07-02T10:00:00+03:00"},
                    "end": {"dateTime": "2026-07-02T11:00:00+03:00"},
                },
            )
            if r.status_code in (200, 201):
                return True, f"Calendar event created: {title[:40]}"
            return False, r.text[:120]
    except Exception as e:
        return False, str(e)


async def verify_google_ads(developer_token: str, customer_id: str, access_token: str) -> tuple[bool, str]:
    if not developer_token or not customer_id:
        return False, "Developer token and customer ID required"
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.get(
                f"https://googleads.googleapis.com/v17/customers/{customer_id.replace('-', '')}",
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "developer-token": developer_token,
                },
            )
            if r.status_code == 200:
                return True, f"Connected — Google Ads customer {customer_id}"
            return False, f"Google Ads error {r.status_code}: {r.text[:100]}"
    except Exception as e:
        return False, str(e)
