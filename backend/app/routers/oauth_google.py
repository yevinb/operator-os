import json
import secrets
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import RedirectResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.db_models import IntegrationConnection, User
from app.deps import get_current_user

router = APIRouter(prefix="/api/v1/oauth/google", tags=["oauth"])

_pending_states: dict[str, str] = {}


@router.get("/start")
async def google_oauth_start(
    integration_id: str = Query("gmail"),
    user: User = Depends(get_current_user),
):
    if not settings.google_client_id or not settings.google_client_secret:
        raise HTTPException(
            status_code=503,
            detail="Google OAuth not configured on server. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET on Railway.",
        )
    if integration_id not in {"gmail", "calendar"}:
        raise HTTPException(status_code=400, detail="integration_id must be gmail or calendar")
    state = secrets.token_urlsafe(24)
    _pending_states[state] = json.dumps({"user_id": user.id, "integration_id": integration_id})
    scopes = [
        "openid",
        "email",
        "https://www.googleapis.com/auth/gmail.send",
        "https://www.googleapis.com/auth/gmail.readonly",
    ] if integration_id == "gmail" else [
        "openid",
        "email",
        "https://www.googleapis.com/auth/calendar.events",
    ]
    params = {
        "client_id": settings.google_client_id,
        "redirect_uri": settings.google_redirect_uri,
        "response_type": "code",
        "scope": " ".join(scopes),
        "access_type": "offline",
        "prompt": "consent",
        "state": state,
    }
    url = f"https://accounts.google.com/o/oauth2/v2/auth?{urlencode(params)}"
    return {"url": url}


@router.get("/callback")
async def google_oauth_callback(
    code: str = Query(""),
    state: str = Query(""),
    db: AsyncSession = Depends(get_db),
):
    state_payload = _pending_states.pop(state, None)
    if not state_payload or not code:
        return RedirectResponse(f"{settings.frontend_url}/dashboard/integrations?error=oauth_failed")
    try:
        payload = json.loads(state_payload)
        user_id = payload["user_id"]
        integration_id = payload["integration_id"]
    except Exception:
        return RedirectResponse(f"{settings.frontend_url}/dashboard/integrations?error=oauth_state_invalid")

    async with httpx.AsyncClient(timeout=20) as client:
        token_resp = await client.post(
            "https://oauth2.googleapis.com/token",
            data={
                "code": code,
                "client_id": settings.google_client_id,
                "client_secret": settings.google_client_secret,
                "redirect_uri": settings.google_redirect_uri,
                "grant_type": "authorization_code",
            },
        )

    if token_resp.status_code != 200:
        return RedirectResponse(f"{settings.frontend_url}/dashboard/integrations?error=token_exchange_failed")

    tokens = token_resp.json()
    config = {
        "access_token": tokens.get("access_token", ""),
        "refresh_token": tokens.get("refresh_token", ""),
        "expires_in": tokens.get("expires_in", 3600),
    }

    await _upsert_integration(db, user_id, integration_id, tokens.get("access_token", ""), config)

    await db.commit()
    return RedirectResponse(f"{settings.frontend_url}/dashboard/integrations?connected={integration_id}")


async def _upsert_integration(
    db: AsyncSession, user_id: str, integration_id: str, api_key: str, config: dict
) -> None:
    result = await db.execute(
        select(IntegrationConnection).where(
            IntegrationConnection.user_id == user_id,
            IntegrationConnection.integration_id == integration_id,
        )
    )
    conn = result.scalar_one_or_none()
    if not conn:
        conn = IntegrationConnection(user_id=user_id, integration_id=integration_id)
        db.add(conn)
    conn.connected = True
    conn.api_key = api_key
    conn.config_json = json.dumps(config)
    from datetime import datetime, timezone
    conn.connected_at = datetime.now(timezone.utc)
