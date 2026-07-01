"""Persist Meta/Instagram OAuth tokens as integration connections."""

import json
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db_models import IntegrationConnection
from app.services.integrations.providers import parse_config
from app.services.instagram_integration import instagram_discover_account


async def upsert_meta_integration(
    db: AsyncSession,
    user_id: str,
    integration_id: str,
    access_token: str,
    expires_in: int = 0,
) -> IntegrationConnection:
    result = await db.execute(
        select(IntegrationConnection).where(
            IntegrationConnection.user_id == user_id,
            IntegrationConnection.integration_id == integration_id,
        )
    )
    conn = result.scalar_one_or_none()
    existing = parse_config(conn.config_json) if conn else {}

    ig_id, username, bundle = await instagram_discover_account(access_token)
    merged = {
        **existing,
        "access_token": access_token,
        "expires_in": expires_in or existing.get("expires_in", 0),
        "oauth": True,
    }
    if ig_id:
        merged["instagram_account_id"] = ig_id
        merged["username"] = username
    if bundle.get("page_id"):
        merged["page_id"] = bundle["page_id"]
    if bundle.get("page_access_token"):
        merged["page_access_token"] = bundle["page_access_token"]
    if bundle.get("page_name"):
        merged["page_name"] = bundle["page_name"]

    if not conn:
        conn = IntegrationConnection(user_id=user_id, integration_id=integration_id)
        db.add(conn)

    conn.connected = True
    conn.api_key = access_token
    conn.config_json = json.dumps(merged)
    conn.connected_at = datetime.now(timezone.utc)
    return conn
