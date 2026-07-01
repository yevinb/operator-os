"""Persist Google OAuth tokens as integration connections."""

import json
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db_models import IntegrationConnection
from app.services.integrations.providers import parse_config


async def upsert_google_integration(
    db: AsyncSession,
    user_id: str,
    integration_id: str,
    tokens: dict,
    email: str = "",
) -> IntegrationConnection:
    result = await db.execute(
        select(IntegrationConnection).where(
            IntegrationConnection.user_id == user_id,
            IntegrationConnection.integration_id == integration_id,
        )
    )
    conn = result.scalar_one_or_none()
    existing = parse_config(conn.config_json) if conn else {}

    merged = {
        **existing,
        "access_token": tokens.get("access_token", "") or existing.get("access_token", ""),
        "expires_in": tokens.get("expires_in", existing.get("expires_in", 3600)),
        "email": email or existing.get("email", ""),
    }
    refresh = tokens.get("refresh_token") or existing.get("refresh_token", "")
    if refresh:
        merged["refresh_token"] = refresh

    if integration_id == "gmail" and not merged.get("default_to") and merged.get("email"):
        merged["default_to"] = merged["email"]

    if not conn:
        conn = IntegrationConnection(user_id=user_id, integration_id=integration_id)
        db.add(conn)

    conn.connected = True
    conn.api_key = merged.get("access_token", "")
    conn.config_json = json.dumps(merged)
    conn.connected_at = datetime.now(timezone.utc)
    return conn
