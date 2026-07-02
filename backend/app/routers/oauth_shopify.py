"""Shopify OAuth — one-click Connect store."""

import hashlib
import hmac
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.db_models import User
from app.deps import get_current_user
from app.services.integrations.shopify_store import upsert_shopify_integration
from app.services.security import create_oauth_state, decode_oauth_state
from app.services.shopify_integration import FULL_SCOPES, normalize_shop_domain

router = APIRouter(prefix="/api/v1/oauth/shopify", tags=["oauth"])


def _verify_shopify_hmac(query_params: dict[str, str]) -> bool:
    secret = settings.resolved_shopify_api_secret
    if not secret:
        return False
    received = query_params.get("hmac", "")
    if not received:
        return False
    pairs = []
    for key in sorted(query_params.keys()):
        if key in ("hmac", "signature"):
            continue
        pairs.append(f"{key}={query_params[key]}")
    message = "&".join(pairs)
    digest = hmac.new(secret.encode(), message.encode(), hashlib.sha256).hexdigest()
    return hmac.compare_digest(digest, received)


@router.get("/start")
async def shopify_oauth_start(
    shop: str = Query(""),
    user: User = Depends(get_current_user),
):
    if not settings.resolved_shopify_api_key or not settings.resolved_shopify_api_secret:
        raise HTTPException(
            status_code=503,
            detail="Shopify connect is not available right now. Please try again shortly.",
        )
    domain = normalize_shop_domain(shop)
    if not domain:
        raise HTTPException(status_code=400, detail="Enter your shop domain (e.g. mystore or mystore.myshopify.com)")

    state = create_oauth_state(user.id, domain, "shopify_oauth")
    params = {
        "client_id": settings.resolved_shopify_api_key,
        "scope": ",".join(FULL_SCOPES),
        "redirect_uri": settings.shopify_oauth_redirect_uri,
        "state": state,
    }
    url = f"https://{domain}/admin/oauth/authorize?{urlencode(params)}"
    return {"url": url}


@router.get("/callback")
async def shopify_oauth_callback(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    params = {k: v for k, v in request.query_params.items()}
    code = params.get("code", "")
    shop = params.get("shop", "")
    state = params.get("state", "")
    if not _verify_shopify_hmac(params):
        return RedirectResponse(f"{settings.frontend_url}/dashboard/integrations?error=oauth_failed")

    decoded = decode_oauth_state(state, "shopify_oauth") if state else None
    if not decoded or not code or not shop:
        return RedirectResponse(f"{settings.frontend_url}/dashboard/integrations?error=oauth_failed")

    user_id, _shop_hint = decoded
    domain = normalize_shop_domain(shop)

    async with httpx.AsyncClient(timeout=25) as client:
        token_resp = await client.post(
            f"https://{domain}/admin/oauth/access_token",
            json={
                "client_id": settings.resolved_shopify_api_key,
                "client_secret": settings.resolved_shopify_api_secret,
                "code": code,
            },
        )
        if token_resp.status_code != 200:
            return RedirectResponse(
                f"{settings.frontend_url}/dashboard/integrations?error=token_exchange_failed"
            )
        data = token_resp.json()
        access_token = data.get("access_token", "")
        scope = data.get("scope", "")
        if not access_token:
            return RedirectResponse(
                f"{settings.frontend_url}/dashboard/integrations?error=token_exchange_failed"
            )

    await upsert_shopify_integration(db, user_id, domain, access_token, scope)
    await db.commit()
    return RedirectResponse(f"{settings.frontend_url}/dashboard/integrations?connected=shopify")
