"""Persist QuickBooks OAuth tokens as integration connections."""

import json
from datetime import datetime, timezone

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db_models import IntegrationConnection
from app.services.integrations.providers import parse_config
from app.services.integrations.quickbooks_oauth import refresh_quickbooks_token


async def persist_quickbooks_tokens(
    db: AsyncSession,
    user_id: str,
    api_key: str,
    config: dict,
) -> tuple[str, dict]:
    """Refresh QuickBooks token when expired and persist."""
    access = api_key
    realm = config.get("realm_id", "")
    if access and realm:
        try:
            async with httpx.AsyncClient(timeout=12) as client:
                r = await client.get(
                    f"https://quickbooks.api.intuit.com/v3/company/{realm}/companyinfo/{realm}",
                    headers={"Authorization": f"Bearer {access}", "Accept": "application/json"},
                )
                if r.status_code == 200:
                    return access, config
        except Exception:
            pass

    refresh = config.get("refresh_token", "")
    if refresh:
        refreshed = await refresh_quickbooks_token(refresh)
        if refreshed and refreshed.get("access_token"):
            merged = {**config, **refreshed}
            result = await db.execute(
                select(IntegrationConnection).where(
                    IntegrationConnection.user_id == user_id,
                    IntegrationConnection.integration_id == "quickbooks",
                )
            )
            conn = result.scalar_one_or_none()
            if conn and conn.connected:
                conn.api_key = refreshed["access_token"]
                conn.config_json = json.dumps(merged)
                await db.flush()
            return refreshed["access_token"], merged
    return access, config


async def upsert_quickbooks_integration(
    db: AsyncSession,
    user_id: str,
    access_token: str,
    refresh_token: str,
    realm_id: str,
    expires_in: int = 3600,
) -> IntegrationConnection:
    result = await db.execute(
        select(IntegrationConnection).where(
            IntegrationConnection.user_id == user_id,
            IntegrationConnection.integration_id == "quickbooks",
        )
    )
    conn = result.scalar_one_or_none()
    existing = parse_config(conn.config_json) if conn else {}
    merged = {
        **existing,
        "realm_id": realm_id or existing.get("realm_id", ""),
        "refresh_token": refresh_token or existing.get("refresh_token", ""),
        "expires_in": expires_in,
        "oauth": True,
    }

    if not conn:
        conn = IntegrationConnection(user_id=user_id, integration_id="quickbooks")
        db.add(conn)

    conn.connected = True
    conn.api_key = access_token
    conn.config_json = json.dumps(merged)
    conn.connected_at = datetime.now(timezone.utc)
    return conn
