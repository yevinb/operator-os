import json
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.db_models import IntegrationConnection, User
from app.deps import get_current_user
from app.services.integration_verify import verify_integration
from app.services.integrations.providers import parse_config

router = APIRouter(prefix="/api/v1/integrations", tags=["integrations"])

CATALOG = [
    {"id": "stripe", "name": "Stripe", "category": "finance", "description": "Live revenue, balance & customers", "needs_key": True, "auth_type": "api_key", "key_hint": "sk_test_... or sk_live_...", "config_fields": []},
    {"id": "slack", "name": "Slack", "category": "communication", "description": "Post COO updates to Slack", "needs_key": True, "auth_type": "webhook", "key_hint": "https://hooks.slack.com/services/...", "config_fields": []},
    {"id": "n8n", "name": "n8n", "category": "automation", "description": "Trigger workflows on commands", "needs_key": True, "auth_type": "webhook", "key_hint": "https://your-n8n.app/webhook/...", "config_fields": []},
    {"id": "gmail", "name": "Gmail", "category": "support", "description": "Send customer emails via Gmail API", "needs_key": False, "auth_type": "google_oauth", "key_hint": "", "config_fields": ["default_to"]},
    {"id": "calendar", "name": "Google Calendar", "category": "operations", "description": "Book meetings on your calendar", "needs_key": False, "auth_type": "google_oauth", "key_hint": "", "config_fields": []},
    {"id": "google-ads", "name": "Google Ads", "category": "marketing", "description": "Manage ad campaigns", "needs_key": True, "auth_type": "google_ads", "key_hint": "Developer token", "config_fields": ["customer_id"]},
    {"id": "meta", "name": "Meta Ads", "category": "marketing", "description": "Facebook & Instagram ads", "needs_key": True, "auth_type": "api_key", "key_hint": "Long-lived access token", "config_fields": ["ad_account_id"]},
    {"id": "hubspot", "name": "HubSpot", "category": "sales", "description": "CRM contacts & pipeline", "needs_key": True, "auth_type": "api_key", "key_hint": "Private app token (pat-...)", "config_fields": []},
    {"id": "notion", "name": "Notion", "category": "operations", "description": "Create pages & docs", "needs_key": True, "auth_type": "api_key", "key_hint": "Integration token (secret_...)", "config_fields": ["database_id"]},
    {"id": "quickbooks", "name": "QuickBooks", "category": "finance", "description": "Accounting & expenses", "needs_key": True, "auth_type": "api_key", "key_hint": "OAuth access token", "config_fields": ["realm_id"]},
    {"id": "linkedin", "name": "LinkedIn", "category": "hr", "description": "Hiring & B2B outreach", "needs_key": True, "auth_type": "api_key", "key_hint": "LinkedIn access token", "config_fields": []},
    {"id": "shopify", "name": "Shopify", "category": "finance", "description": "Orders, revenue & products", "needs_key": True, "auth_type": "api_key", "key_hint": "shpat_... Admin API access token", "config_fields": ["shop_domain"]},
    {"id": "instagram", "name": "Instagram", "category": "marketing", "description": "Followers, posts & social insights", "needs_key": True, "auth_type": "api_key", "key_hint": "Meta long-lived access token (instagram_basic)", "config_fields": []},
    {"id": "mcp", "name": "MCP Servers", "category": "automation", "description": "Model Context Protocol tools", "needs_key": True, "auth_type": "webhook", "key_hint": "MCP server URL", "config_fields": []},
]


class ConnectRequest(BaseModel):
    api_key: str = ""
    config: dict = {}


class IntegrationOut(BaseModel):
    id: str
    name: str
    category: str
    description: str
    connected: bool
    needs_key: bool
    auth_type: str
    key_hint: str
    config_fields: list[str]


class IntegrationTestOut(BaseModel):
    id: str
    connected: bool
    ok: bool
    message: str


@router.get("", response_model=list[IntegrationOut])
async def list_integrations(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(IntegrationConnection).where(IntegrationConnection.user_id == user.id)
    )
    connections = {c.integration_id: c for c in result.scalars().all()}

    return [
        IntegrationOut(
            id=item["id"],
            name=item["name"],
            category=item["category"],
            description=item["description"],
            connected=bool(connections.get(item["id"]) and connections[item["id"]].connected),
            needs_key=item["needs_key"],
            auth_type=item["auth_type"],
            key_hint=item["key_hint"],
            config_fields=item["config_fields"],
        )
        for item in CATALOG
    ]


@router.post("/{integration_id}/connect")
async def connect_integration(
    integration_id: str,
    body: ConnectRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    catalog_item = next((i for i in CATALOG if i["id"] == integration_id), None)
    if not catalog_item:
        raise HTTPException(status_code=404, detail="Integration not found")

    if catalog_item["auth_type"] == "google_oauth":
        conn = await _get_conn(db, user.id, integration_id)
        if conn and conn.connected and body.config:
            merged = parse_config(conn.config_json)
            merged.update({k: v for k, v in (body.config or {}).items() if str(v).strip()})
            conn.config_json = json.dumps(merged)
            await db.commit()
            return {"status": "connected", "id": integration_id, "message": "Settings saved"}
        raise HTTPException(status_code=400, detail="Use Connect with Google button for this integration")

    key = body.api_key.strip()
    config = body.config or {}

    if catalog_item["auth_type"] == "google_ads":
        gmail = await _get_conn(db, user.id, "gmail")
        if gmail and gmail.config_json:
            config["google_oauth"] = parse_config(gmail.config_json)
        if not config.get("developer_token") and key:
            config["developer_token"] = key
        if not config.get("developer_token"):
            raise HTTPException(status_code=400, detail="Google Ads developer token required. Connect Gmail with Google first.")

    if catalog_item["needs_key"] and catalog_item["auth_type"] != "google_ads" and not key:
        raise HTTPException(status_code=400, detail=f"Required: {catalog_item['key_hint']}")

    for field in catalog_item["config_fields"]:
        if field not in config or not str(config.get(field, "")).strip():
            raise HTTPException(status_code=400, detail=f"Required field: {field}")

    config_json = json.dumps(config)
    ok, message = await verify_integration(integration_id, key, config_json)
    if not ok:
        raise HTTPException(status_code=400, detail=message)

    conn = await _get_conn(db, user.id, integration_id)
    if not conn:
        conn = IntegrationConnection(user_id=user.id, integration_id=integration_id)
        db.add(conn)

    conn.connected = True
    conn.api_key = key
    conn.config_json = config_json
    conn.connected_at = datetime.now(timezone.utc)
    await db.commit()

    return {"status": "connected", "id": integration_id, "message": message}


@router.post("/{integration_id}/disconnect")
async def disconnect_integration(
    integration_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    conn = await _get_conn(db, user.id, integration_id)
    if conn:
        conn.connected = False
        conn.api_key = ""
        conn.config_json = "{}"
        await db.commit()
    return {"status": "disconnected", "id": integration_id}


@router.post("/{integration_id}/test", response_model=IntegrationTestOut)
async def test_integration(
    integration_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    catalog_item = next((i for i in CATALOG if i["id"] == integration_id), None)
    if not catalog_item:
        raise HTTPException(status_code=404, detail="Integration not found")

    conn = await _get_conn(db, user.id, integration_id)
    if not conn or not conn.connected:
        return IntegrationTestOut(
            id=integration_id,
            connected=False,
            ok=False,
            message="Not connected",
        )

    ok, message = await _verify_connected_integration(db, user.id, integration_id, conn)
    return IntegrationTestOut(
        id=integration_id,
        connected=True,
        ok=ok,
        message=message,
    )


@router.post("/test-all", response_model=list[IntegrationTestOut])
async def test_all_integrations(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(IntegrationConnection).where(
            IntegrationConnection.user_id == user.id,
            IntegrationConnection.connected == True,  # noqa: E712
        )
    )
    conns = list(result.scalars().all())
    if not conns:
        return []

    out: list[IntegrationTestOut] = []
    for conn in conns:
        ok, message = await _verify_connected_integration(db, user.id, conn.integration_id, conn)
        out.append(
            IntegrationTestOut(
                id=conn.integration_id,
                connected=True,
                ok=ok,
                message=message,
            )
        )
    return out


async def _get_conn(db: AsyncSession, user_id: str, integration_id: str) -> IntegrationConnection | None:
    result = await db.execute(
        select(IntegrationConnection).where(
            IntegrationConnection.user_id == user_id,
            IntegrationConnection.integration_id == integration_id,
        )
    )
    return result.scalar_one_or_none()


async def _verify_connected_integration(
    db: AsyncSession,
    user_id: str,
    integration_id: str,
    conn: IntegrationConnection,
) -> tuple[bool, str]:
    config = parse_config(conn.config_json)
    key = conn.api_key or ""

    if integration_id == "google-ads":
        # Reuse Google OAuth tokens from Gmail/Calendar connection if present
        gmail = await _get_conn(db, user_id, "gmail")
        if gmail and gmail.connected:
            config["google_oauth"] = parse_config(gmail.config_json)
        if not config.get("developer_token"):
            config["developer_token"] = key
        return await verify_integration(integration_id, config.get("developer_token", ""), json.dumps(config))

    return await verify_integration(integration_id, key, json.dumps(config))
