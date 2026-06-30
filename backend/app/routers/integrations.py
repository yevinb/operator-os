from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.db_models import IntegrationConnection, User
from app.deps import get_current_user
from app.services.integration_verify import verify_n8n_webhook, verify_slack_webhook, verify_stripe_key

router = APIRouter(prefix="/api/v1/integrations", tags=["integrations"])

# tier: live = real API/webhook today | linked = saved, OAuth soon | key = needs URL/key
CATALOG = [
    {"id": "stripe", "name": "Stripe", "category": "finance", "description": "Live revenue, balance & customers", "needs_key": True, "tier": "live", "key_hint": "sk_test_... or sk_live_..."},
    {"id": "slack", "name": "Slack", "category": "communication", "description": "Post COO updates to a channel", "needs_key": True, "tier": "live", "key_hint": "https://hooks.slack.com/services/..."},
    {"id": "n8n", "name": "n8n", "category": "automation", "description": "Trigger workflows on every command", "needs_key": True, "tier": "live", "key_hint": "https://your-n8n.app/webhook/..."},
    {"id": "google-ads", "name": "Google Ads", "category": "marketing", "description": "Campaign automation (OAuth coming)", "needs_key": False, "tier": "linked", "key_hint": ""},
    {"id": "meta", "name": "Meta Ads", "category": "marketing", "description": "Facebook & Instagram ads (OAuth coming)", "needs_key": False, "tier": "linked", "key_hint": ""},
    {"id": "gmail", "name": "Gmail", "category": "support", "description": "Customer email automation (OAuth coming)", "needs_key": False, "tier": "linked", "key_hint": ""},
    {"id": "hubspot", "name": "HubSpot", "category": "sales", "description": "CRM & pipeline (OAuth coming)", "needs_key": False, "tier": "linked", "key_hint": ""},
    {"id": "linkedin", "name": "LinkedIn", "category": "hr", "description": "Hiring & outreach (OAuth coming)", "needs_key": False, "tier": "linked", "key_hint": ""},
    {"id": "mcp", "name": "MCP Servers", "category": "automation", "description": "AI tool servers (coming)", "needs_key": False, "tier": "linked", "key_hint": ""},
]


class ConnectRequest(BaseModel):
    api_key: str = ""


class IntegrationOut(BaseModel):
    id: str
    name: str
    category: str
    description: str
    connected: bool
    needs_key: bool
    tier: str
    key_hint: str


async def _verify(integration_id: str, api_key: str) -> tuple[bool, str]:
    if integration_id == "stripe":
        return await verify_stripe_key(api_key)
    if integration_id == "slack":
        return await verify_slack_webhook(api_key)
    if integration_id == "n8n":
        return await verify_n8n_webhook(api_key)
    return True, "Connected"


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
            tier=item["tier"],
            key_hint=item["key_hint"],
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

    key = body.api_key.strip()
    if catalog_item["needs_key"] and not key:
        raise HTTPException(status_code=400, detail=f"Required: {catalog_item['key_hint']}")

    verify_msg = "Connected"
    if catalog_item["tier"] == "live" and key:
        ok, message = await _verify(integration_id, key)
        if not ok:
            raise HTTPException(status_code=400, detail=message)
        verify_msg = message
    elif catalog_item["tier"] == "linked":
        verify_msg = "Linked — full OAuth activation coming soon"

    result = await db.execute(
        select(IntegrationConnection).where(
            IntegrationConnection.user_id == user.id,
            IntegrationConnection.integration_id == integration_id,
        )
    )
    conn = result.scalar_one_or_none()
    if not conn:
        conn = IntegrationConnection(user_id=user.id, integration_id=integration_id)
        db.add(conn)

    conn.connected = True
    conn.api_key = key
    conn.connected_at = datetime.now(timezone.utc)
    await db.commit()

    return {"status": "connected", "id": integration_id, "message": verify_msg}


@router.post("/{integration_id}/disconnect")
async def disconnect_integration(
    integration_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(IntegrationConnection).where(
            IntegrationConnection.user_id == user.id,
            IntegrationConnection.integration_id == integration_id,
        )
    )
    conn = result.scalar_one_or_none()
    if conn:
        conn.connected = False
        conn.api_key = ""
        await db.commit()
    return {"status": "disconnected", "id": integration_id}
