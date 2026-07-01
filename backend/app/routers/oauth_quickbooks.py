"""QuickBooks / Intuit OAuth — one-click connect."""

import base64
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.db_models import User
from app.deps import get_current_user
from app.services.integrations.quickbooks_store import upsert_quickbooks_integration
from app.services.security import create_oauth_state, decode_oauth_state

router = APIRouter(prefix="/api/v1/oauth/quickbooks", tags=["oauth"])

QB_SCOPE = "com.intuit.quickbooks.accounting"


def _basic_auth() -> str:
    raw = f"{settings.intuit_client_id}:{settings.intuit_client_secret}"
    return base64.b64encode(raw.encode()).decode()


@router.get("/start")
async def quickbooks_oauth_start(
    user: User = Depends(get_current_user),
):
    if not settings.intuit_client_id or not settings.intuit_client_secret:
        raise HTTPException(
            status_code=503,
            detail="QuickBooks OAuth not configured. Set INTUIT_CLIENT_ID and INTUIT_CLIENT_SECRET on Railway.",
        )

    state = create_oauth_state(user.id, "quickbooks", "quickbooks_oauth")
    params = {
        "client_id": settings.intuit_client_id,
        "redirect_uri": settings.quickbooks_oauth_redirect_uri,
        "response_type": "code",
        "scope": QB_SCOPE,
        "state": state,
    }
    url = f"{settings.intuit_oauth_base}?{urlencode(params)}"
    return {"url": url}


@router.get("/callback")
async def quickbooks_oauth_callback(
    code: str = Query(""),
    state: str = Query(""),
    realm_id: str = Query(""),
    error: str = Query(""),
    db: AsyncSession = Depends(get_db),
):
    if error:
        return RedirectResponse(f"{settings.frontend_url}/dashboard/integrations?error=oauth_failed")

    decoded = decode_oauth_state(state, "quickbooks_oauth") if state else None
    if not decoded or not code:
        return RedirectResponse(f"{settings.frontend_url}/dashboard/integrations?error=oauth_failed")

    user_id, integration_id = decoded
    if integration_id != "quickbooks":
        return RedirectResponse(f"{settings.frontend_url}/dashboard/integrations?error=oauth_failed")

    async with httpx.AsyncClient(timeout=25) as client:
        token_resp = await client.post(
            settings.intuit_token_url,
            headers={
                "Authorization": f"Basic {_basic_auth()}",
                "Content-Type": "application/x-www-form-urlencoded",
                "Accept": "application/json",
            },
            data={
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": settings.quickbooks_oauth_redirect_uri,
            },
        )
        if token_resp.status_code != 200:
            return RedirectResponse(
                f"{settings.frontend_url}/dashboard/integrations?error=token_exchange_failed"
            )
        data = token_resp.json()
        access_token = data.get("access_token", "")
        refresh_token = data.get("refresh_token", "")
        expires_in = int(data.get("expires_in", 3600))
        if not access_token:
            return RedirectResponse(
                f"{settings.frontend_url}/dashboard/integrations?error=token_exchange_failed"
            )

    await upsert_quickbooks_integration(
        db, user_id, access_token, refresh_token, realm_id, expires_in
    )
    await db.commit()
    return RedirectResponse(f"{settings.frontend_url}/dashboard/integrations?connected=quickbooks")
