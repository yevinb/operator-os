"""Business entity graph and integration relationships."""

from __future__ import annotations

import json
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db_models import BusinessEntity, ExecutionRun
from app.services.execution_bundle import ExecutionBundle

INTEGRATION_RELATIONSHIPS: dict[str, dict] = {
    "stripe": {
        "label": "Stripe",
        "category": "finance",
        "works_with": ["slack", "notion", "hubspot", "n8n", "gmail"],
        "goals": ["revenue", "finance", "analytics"],
    },
    "hubspot": {
        "label": "HubSpot",
        "category": "sales",
        "works_with": ["gmail", "slack", "notion", "n8n", "stripe"],
        "goals": ["sales", "leads", "crm"],
    },
    "gmail": {
        "label": "Gmail",
        "category": "communication",
        "works_with": ["hubspot", "calendar", "notion", "slack"],
        "goals": ["sales", "support", "communication"],
    },
    "slack": {
        "label": "Slack",
        "category": "communication",
        "works_with": ["stripe", "hubspot", "notion", "n8n", "meta", "google-ads"],
        "goals": ["reporting", "operations", "communication"],
    },
    "notion": {
        "label": "Notion",
        "category": "operations",
        "works_with": ["stripe", "hubspot", "slack", "gmail", "n8n"],
        "goals": ["reporting", "operations"],
    },
    "n8n": {
        "label": "n8n",
        "category": "automation",
        "works_with": ["stripe", "hubspot", "slack", "gmail", "notion", "meta"],
        "goals": ["operations", "automation"],
    },
    "meta": {
        "label": "Meta Ads",
        "category": "marketing",
        "works_with": ["slack", "notion", "n8n", "google-ads"],
        "goals": ["marketing", "leads"],
    },
    "google-ads": {
        "label": "Google Ads",
        "category": "marketing",
        "works_with": ["slack", "notion", "n8n", "meta"],
        "goals": ["marketing", "leads"],
    },
    "calendar": {
        "label": "Google Calendar",
        "category": "operations",
        "works_with": ["gmail", "slack", "hubspot"],
        "goals": ["operations", "sales"],
    },
    "quickbooks": {
        "label": "QuickBooks",
        "category": "finance",
        "works_with": ["stripe", "slack", "notion"],
        "goals": ["finance", "reporting"],
    },
    "linkedin": {
        "label": "LinkedIn",
        "category": "hr",
        "works_with": ["gmail", "notion", "calendar"],
        "goals": ["hr", "sales"],
    },
    "mcp": {
        "label": "MCP Server",
        "category": "automation",
        "works_with": ["n8n", "notion"],
        "goals": ["automation"],
    },
}


def integration_relationships(connected: list[str], goal: str = "") -> dict:
    nodes = []
    edges = []
    seen_edges: set[tuple[str, str]] = set()

    for iid, meta in INTEGRATION_RELATIONSHIPS.items():
        nodes.append({
            "id": iid,
            "label": meta["label"],
            "category": meta["category"],
            "connected": iid in connected,
            "works_with": [w for w in meta["works_with"] if w in connected or w in INTEGRATION_RELATIONSHIPS],
        })
        for target in meta["works_with"]:
            pair = (min(iid, target), max(iid, target))
            if pair in seen_edges:
                continue
            seen_edges.add(pair)
            edges.append({
                "from": iid,
                "to": target,
                "active": iid in connected and target in connected,
            })

    suggestions = _suggested_commands(connected, goal)
    return {"nodes": nodes, "edges": edges, "suggested_commands": suggestions}


def _suggested_commands(connected: list[str], goal: str) -> list[str]:
    cmds: list[str] = []
    if "stripe" in connected and "slack" in connected:
        cmds.append("Check Stripe balance and post summary to Slack")
    if "hubspot" in connected and "notion" in connected:
        cmds.append("Pull HubSpot contacts and log update in Notion")
    if "gmail" in connected:
        cmds.append("Send follow-up email about growing revenue")
    if "meta" in connected or "google-ads" in connected:
        cmds.append("Check ad campaign performance and post to Slack")
    if len(connected) >= 3:
        cmds.append("Run company operations review")
    if goal and "grow" in goal.lower():
        cmds.append(f"Get me 50 leads this month — focus: {goal}")
    return cmds[:6]


async def link_entity(
    db: AsyncSession,
    user_id: str,
    *,
    entity_type: str = "contact",
    name: str = "",
    email: str = "",
    external_ids: dict | None = None,
) -> BusinessEntity | None:
    if not email and not name:
        return None
    if email:
        result = await db.execute(
            select(BusinessEntity).where(
                BusinessEntity.user_id == user_id,
                BusinessEntity.entity_type == entity_type,
                BusinessEntity.email == email,
            )
        )
    else:
        result = await db.execute(
            select(BusinessEntity).where(
                BusinessEntity.user_id == user_id,
                BusinessEntity.entity_type == entity_type,
                BusinessEntity.name == name,
            )
        )
    entity = result.scalar_one_or_none()
    ids = external_ids or {}
    if entity:
        try:
            existing = json.loads(entity.external_ids_json or "{}")
        except json.JSONDecodeError:
            existing = {}
        existing.update(ids)
        entity.external_ids_json = json.dumps(existing)
        if name:
            entity.name = name
        entity.updated_at = datetime.now(timezone.utc)
        return entity
    entity = BusinessEntity(
        user_id=user_id,
        entity_type=entity_type,
        name=name or email,
        email=email,
        external_ids_json=json.dumps(ids),
    )
    db.add(entity)
    await db.flush()
    return entity


async def get_related_entities(db: AsyncSession, user_id: str, email: str) -> list[dict]:
    if not email:
        return []
    result = await db.execute(
        select(BusinessEntity).where(
            BusinessEntity.user_id == user_id,
            BusinessEntity.email == email,
        )
    )
    return [
        {
            "id": e.id,
            "type": e.entity_type,
            "name": e.name,
            "email": e.email,
            "external_ids": json.loads(e.external_ids_json or "{}"),
        }
        for e in result.scalars().all()
    ]


async def save_execution_run(
    db: AsyncSession,
    user_id: str,
    command: str,
    bundle: ExecutionBundle,
    verified_count: int,
) -> ExecutionRun:
    run = ExecutionRun(
        user_id=user_id,
        command=command,
        bundle_json=json.dumps(bundle.to_dict()),
        verified_count=verified_count,
    )
    db.add(run)
    await db.flush()
    bundle.run_id = run.id
    return run


async def absorb_execution_entities(
    db: AsyncSession,
    user_id: str,
    bundle: ExecutionBundle,
) -> None:
    for proof in bundle.proofs:
        p = proof.get("proof") or {}
        integration = proof.get("integration")
        if integration == "gmail" and p.get("recipient"):
            await link_entity(
                db,
                user_id,
                entity_type="contact",
                email=p["recipient"],
                external_ids={"gmail_recipient": p["recipient"]},
            )
        if integration == "hubspot":
            await link_entity(
                db,
                user_id,
                entity_type="company",
                name=bundle.company,
                external_ids={"hubspot_note": True, "run_id": bundle.run_id},
            )
