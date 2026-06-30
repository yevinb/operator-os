from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.db_models import IntegrationConnection, User
from app.deps import get_current_user

router = APIRouter(prefix="/api/v1/integrations", tags=["integrations"])

CATALOG = [
    {"id": "stripe", "name": "Stripe", "category": "finance", "description": "Revenue, payments, subscriptions", "needs_key": True},
    {"id": "slack", "name": "Slack", "category": "communication", "description": "Team messages & alerts", "needs_key": False},
    {"id": "google-ads", "name": "Google Ads", "category": "marketing", "description": "Create & manage ad campaigns", "needs_key": False},
    {"id": "meta", "name": "Meta Ads", "category": "marketing", "description": "Facebook & Instagram campaigns", "needs_key": False},
    {"id": "gmail", "name": "Gmail", "category": "support", "description": "Customer email automation", "needs_key": False},
    {"id": "n8n", "name": "n8n", "category": "automation", "description": "Workflow automation engine", "needs_key": True},
    {"id": "mcp", "name": "MCP Servers", "category": "automation", "description": "Model Context Protocol tools", "needs_key": False},
    {"id": "hubspot", "name": "HubSpot", "category": "sales", "description": "CRM & sales pipeline", "needs_key": False},
    {"id": "linkedin", "name": "LinkedIn", "category": "hr", "description": "Hiring & B2B outreach", "needs_key": False},
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


@router.get("", response_model=list[IntegrationOut])
async def list_integrations(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(IntegrationConnection).where(IntegrationConnection.user_id == user.id)
    )
    connections = {c.integration_id: c for c in result.scalars().all()}

    out = []
    for item in CATALOG:
        conn = connections.get(item["id"])
        out.append(
            IntegrationOut(
                id=item["id"],
                name=item["name"],
                category=item["category"],
                description=item["description"],
                connected=bool(conn and conn.connected),
                needs_key=item["needs_key"],
            )
        )
    return out


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

    if catalog_item["needs_key"] and not body.api_key.strip():
        raise HTTPException(status_code=400, detail="API key required for this integration")

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
    conn.api_key = body.api_key.strip()
    conn.connected_at = datetime.now(timezone.utc)
    await db.commit()

    return {"status": "connected", "id": integration_id}


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
