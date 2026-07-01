"""Persist Google OAuth tokens as integration connections."""

import json
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db_models import IntegrationConnection
from app.services.integrations.google import resolve_google_access
from app.services.integrations.providers import parse_config


async def _get_conn(db: AsyncSession, user_id: str, integration_id: str) -> IntegrationConnection | None:
    result = await db.execute(
        select(IntegrationConnection).where(
            IntegrationConnection.user_id == user_id,
            IntegrationConnection.integration_id == integration_id,
        )
    )
    return result.scalar_one_or_none()


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

    if integration_id == "google-ads":
        merged["google_oauth"] = {
            "access_token": tokens.get("access_token", "") or existing.get("google_oauth", {}).get("access_token", ""),
            "refresh_token": refresh or existing.get("google_oauth", {}).get("refresh_token", ""),
            "expires_in": tokens.get("expires_in", existing.get("google_oauth", {}).get("expires_in", 3600)),
            "email": email or existing.get("google_oauth", {}).get("email", ""),
        }
        if not conn:
            conn = IntegrationConnection(user_id=user_id, integration_id=integration_id)
            db.add(conn)
        conn.connected = True
        conn.api_key = existing.get("developer_token") or conn.api_key or ""
        conn.config_json = json.dumps(merged)
        conn.connected_at = datetime.now(timezone.utc)
        return conn

    if not conn:
        conn = IntegrationConnection(user_id=user_id, integration_id=integration_id)
        db.add(conn)

    conn.connected = True
    conn.api_key = merged.get("access_token", "")
    conn.config_json = json.dumps(merged)
    conn.connected_at = datetime.now(timezone.utc)
    return conn


async def resolve_and_persist_google(
    db: AsyncSession | None,
    user_id: str | None,
    integration_id: str,
    config: dict,
    *,
    gmail: bool = False,
) -> tuple[str, dict]:
    """Refresh Google access token if needed and persist to DB."""
    access, updated = await resolve_google_access(config, gmail=gmail)
    if not access or not db or not user_id:
        return access, updated

    old_token = config.get("access_token", "")
    if updated.get("access_token") and (updated.get("access_token") != old_token or integration_id == "google-ads"):
        conn = await _get_conn(db, user_id, integration_id)
        if conn and conn.connected:
            if integration_id == "google-ads":
                merged = parse_config(conn.config_json)
                merged["google_oauth"] = {
                    k: updated.get(k, "")
                    for k in ("access_token", "refresh_token", "expires_in", "email")
                    if updated.get(k)
                }
                conn.config_json = json.dumps(merged)
            else:
                merged = parse_config(conn.config_json)
                merged.update({k: v for k, v in updated.items() if v})
                conn.config_json = json.dumps(merged)
                conn.api_key = merged.get("access_token", access)
            await db.flush()
    return access, updated
