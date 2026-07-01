"""Persist Shopify OAuth tokens as integration connections."""

import json
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db_models import IntegrationConnection
from app.services.integrations.providers import parse_config
from app.services.shopify_integration import normalize_shop_domain


async def upsert_shopify_integration(
    db: AsyncSession,
    user_id: str,
    shop_domain: str,
    access_token: str,
    scope: str = "",
) -> IntegrationConnection:
    domain = normalize_shop_domain(shop_domain)
    result = await db.execute(
        select(IntegrationConnection).where(
            IntegrationConnection.user_id == user_id,
            IntegrationConnection.integration_id == "shopify",
        )
    )
    conn = result.scalar_one_or_none()
    existing = parse_config(conn.config_json) if conn else {}
    merged = {
        **existing,
        "shop_domain": domain,
        "scope": scope or existing.get("scope", ""),
        "oauth": True,
    }

    if not conn:
        conn = IntegrationConnection(user_id=user_id, integration_id="shopify")
        db.add(conn)

    conn.connected = True
    conn.api_key = access_token
    conn.config_json = json.dumps(merged)
    conn.connected_at = datetime.now(timezone.utc)
    return conn
