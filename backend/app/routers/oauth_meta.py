"""Meta / Instagram OAuth — one-click Connect with Instagram (like Gmail)."""

from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.db_models import User
from app.deps import get_current_user
from app.services.integrations.meta_store import upsert_meta_integration
from app.services.security import create_oauth_state, decode_oauth_state

router = APIRouter(prefix="/api/v1/oauth/meta", tags=["oauth"])

INSTAGRAM_SCOPES = [
    "instagram_basic",
    "instagram_content_publish",
    "instagram_manage_comments",
    "pages_show_list",
    "pages_read_engagement",
]


@router.get("/start")
async def meta_oauth_start(
    integration_id: str = Query("instagram"),
    user: User = Depends(get_current_user),
):
    if not settings.meta_app_id or not settings.meta_app_secret:
        raise HTTPException(
            status_code=503,
            detail="Instagram OAuth not configured on server. Set META_APP_ID and META_APP_SECRET on Railway.",
        )
    if integration_id not in {"instagram"}:
        raise HTTPException(status_code=400, detail="integration_id must be instagram")

    state = create_oauth_state(user.id, integration_id, "meta_oauth")
    params = {
        "client_id": settings.meta_app_id,
        "redirect_uri": settings.meta_oauth_redirect_uri,
        "scope": ",".join(INSTAGRAM_SCOPES),
        "response_type": "code",
        "state": state,
    }
    url = f"https://www.facebook.com/v19.0/dialog/oauth?{urlencode(params)}"
    return {"url": url}


@router.get("/callback")
async def meta_oauth_callback(
    code: str = Query(""),
    state: str = Query(""),
    error: str = Query(""),
    error_description: str = Query(""),
    db: AsyncSession = Depends(get_db),
):
    if error:
        msg = error_description or error
        return RedirectResponse(
            f"{settings.frontend_url}/dashboard/integrations?error=meta_oauth_failed&detail={msg[:80]}"
        )

    decoded = decode_oauth_state(state, "meta_oauth") if state else None
    if not decoded or not code:
        return RedirectResponse(f"{settings.frontend_url}/dashboard/integrations?error=oauth_failed")

    user_id, integration_id = decoded
    redirect_uri = settings.meta_oauth_redirect_uri

    async with httpx.AsyncClient(timeout=25) as client:
        short_resp = await client.get(
            "https://graph.facebook.com/v19.0/oauth/access_token",
            params={
                "client_id": settings.meta_app_id,
                "client_secret": settings.meta_app_secret,
                "redirect_uri": redirect_uri,
                "code": code,
            },
        )
        if short_resp.status_code != 200:
            return RedirectResponse(
                f"{settings.frontend_url}/dashboard/integrations?error=token_exchange_failed"
            )
        short_token = short_resp.json().get("access_token", "")
        if not short_token:
            return RedirectResponse(
                f"{settings.frontend_url}/dashboard/integrations?error=token_exchange_failed"
            )

        long_resp = await client.get(
            "https://graph.facebook.com/v19.0/oauth/access_token",
            params={
                "grant_type": "fb_exchange_token",
                "client_id": settings.meta_app_id,
                "client_secret": settings.meta_app_secret,
                "fb_exchange_token": short_token,
            },
        )
        access_token = short_token
        expires_in = 3600
        if long_resp.status_code == 200:
            data = long_resp.json()
            access_token = data.get("access_token", short_token)
            expires_in = int(data.get("expires_in", 5184000))

    await upsert_meta_integration(db, user_id, integration_id, access_token, expires_in)
    await db.commit()
    return RedirectResponse(f"{settings.frontend_url}/dashboard/integrations?connected={integration_id}")
