import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.db_models import User
from app.deps import get_current_user
from app.services.integrations.google_store import upsert_google_integration
from app.services.security import create_oauth_state, decode_oauth_state

router = APIRouter(prefix="/api/v1/oauth/google", tags=["oauth"])


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

    state = create_oauth_state(user.id, integration_id)
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
    from urllib.parse import urlencode

    params = {
        "client_id": settings.google_client_id,
        "redirect_uri": settings.google_oauth_redirect_uri,
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
    decoded = decode_oauth_state(state) if state else None
    if not decoded or not code:
        return RedirectResponse(f"{settings.frontend_url}/dashboard/integrations?error=oauth_failed")

    user_id, integration_id = decoded
    redirect_uri = settings.google_oauth_redirect_uri

    async with httpx.AsyncClient(timeout=20) as client:
        token_resp = await client.post(
            "https://oauth2.googleapis.com/token",
            data={
                "code": code,
                "client_id": settings.google_client_id,
                "client_secret": settings.google_client_secret,
                "redirect_uri": redirect_uri,
                "grant_type": "authorization_code",
            },
        )

        if token_resp.status_code != 200:
            return RedirectResponse(
                f"{settings.frontend_url}/dashboard/integrations?error=token_exchange_failed"
            )

        tokens = token_resp.json()
        access_token = tokens.get("access_token", "")
        email = ""
        if access_token:
            user_resp = await client.get(
                "https://www.googleapis.com/oauth2/v3/userinfo",
                headers={"Authorization": f"Bearer {access_token}"},
            )
            if user_resp.status_code == 200:
                email = (user_resp.json().get("email") or "").strip()

    config = {
        "access_token": access_token,
        "refresh_token": tokens.get("refresh_token", ""),
        "expires_in": tokens.get("expires_in", 3600),
    }

    await upsert_google_integration(db, user_id, integration_id, config, email=email)
    await db.commit()
    return RedirectResponse(f"{settings.frontend_url}/dashboard/integrations?connected={integration_id}")
