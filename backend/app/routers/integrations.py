from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(prefix="/api/v1/integrations", tags=["integrations"])

INTEGRATIONS = [
    {"id": "stripe", "name": "Stripe", "category": "finance", "connected": False},
    {"id": "slack", "name": "Slack", "category": "communication", "connected": False},
    {"id": "google-ads", "name": "Google Ads", "category": "marketing", "connected": False},
    {"id": "meta", "name": "Meta Ads", "category": "marketing", "connected": False},
    {"id": "n8n", "name": "n8n", "category": "automation", "connected": False},
    {"id": "mcp", "name": "MCP Servers", "category": "automation", "connected": False},
    {"id": "gmail", "name": "Gmail", "category": "support", "connected": False},
    {"id": "hubspot", "name": "HubSpot", "category": "sales", "connected": False},
]


class IntegrationOut(BaseModel):
    id: str
    name: str
    category: str
    connected: bool


@router.get("", response_model=list[IntegrationOut])
async def list_integrations():
    return INTEGRATIONS


@router.post("/{integration_id}/connect")
async def connect_integration(integration_id: str):
    for i in INTEGRATIONS:
        if i["id"] == integration_id:
            i["connected"] = True
            return {"status": "connected", "id": integration_id}
    return {"status": "not_found"}


@router.post("/{integration_id}/disconnect")
async def disconnect_integration(integration_id: str):
    for i in INTEGRATIONS:
        if i["id"] == integration_id:
            i["connected"] = False
            return {"status": "disconnected", "id": integration_id}
    return {"status": "not_found"}
