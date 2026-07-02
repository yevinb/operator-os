"""
Full Nas-style agent execution — live intel + AI deliverables + real publishing.
"""

from __future__ import annotations

import json
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.db_models import User
from app.services.autopilot import run_autopilot
from app.services.brain_agents import agent_by_id
from app.services.brain_config import config_to_dict, get_brain_config
from app.services.brain_content import generate_deliverable
from app.services.brain_intel import build_intel_context
from app.services.brain_publish import publish_deliverable
from app.services.business_context import build_business_context
from app.services.command_pipeline import run_command_pipeline
from app.services.email_dispatch import try_direct_gmail_send
from app.services.integrations.providers import parse_config


async def _integration_data(user: User) -> tuple[dict, list[str]]:
    data = {
        i.integration_id: {
            "api_key": i.api_key or "",
            "config": parse_config(i.config_json),
        }
        for i in user.integrations
        if i.connected
    }
    connected = list(data.keys())
    return data, connected


async def execute_brain_agent(
    db: AsyncSession,
    user: User,
    agent_id: str,
    *,
    learned: dict | None = None,
) -> dict[str, Any]:
    agent = agent_by_id(agent_id)
    if not agent:
        return {"ok": False, "error": "Unknown agent"}

    context = await build_business_context(user, db)
    integration_data, connected = await _integration_data(user)
    cfg_row = await get_brain_config(db, user.id)
    cfg = config_to_dict(cfg_row)

    intel = await build_intel_context(
        context.company,
        integration_data,
        connected,
        competitors=cfg.get("competitors") or [],
        brand_keywords=cfg.get("brand_keywords") or [],
        website=context.website,
    )

    dtype = agent.get("deliverable_type", "campaign_brief")
    extra: dict[str, Any] = {"live_intel": intel}

    # Agent-specific intel injection
    if agent_id == "customer_finder":
        extra["crm_leads"] = intel.get("crm_leads", [])
    elif agent_id == "customer_stealer":
        extra["competitor_intel"] = intel.get("competitors", [])
    elif agent_id == "brand_monitoring":
        extra["brand_intel"] = intel.get("brand", {})
    elif agent_id == "ads_monitoring":
        extra["ads_intel"] = intel.get("ads", {})
    elif agent_id == "ads_maker":
        extra["ads_intel"] = intel.get("ads", {})

    deliverable = await generate_deliverable(
        dtype,
        context,
        metrics=(learned or {}).get("metrics"),
        learned=learned,
        extra=extra,
    )

    # Enrich with live data overlays
    deliverable = _overlay_live_data(agent_id, deliverable, intel, context)

    executions: list[dict] = []
    publish_proofs = await publish_deliverable(
        agent_id, deliverable, integration_data, connected, context.company
    )
    executions.extend(publish_proofs)

    if agent_id == "email_outreach" and "gmail" in connected:
        emails = deliverable.get("emails") or []
        for item in emails[:3]:
            if not isinstance(item, dict):
                continue
            to = item.get("to", "")
            body = item.get("body", "")
            subject = item.get("subject", "Follow up")
            if to and body:
                instruction = f"Send email to {to} subject: {subject} body: {body}"
                res = await try_direct_gmail_send(
                    instruction, user.id, context.company, db, context=context
                )
                if res:
                    executions.append({"channel": "gmail", "ok": res.get("executed"), "message": res.get("reply", "")})

    if agent.get("autopilot_mode"):
        ap = await run_autopilot(agent["autopilot_mode"], user, db)
        executions.append({"channel": "autopilot", "ok": True, "result": ap})
    elif agent.get("command"):
        response, _ = await run_command_pipeline(agent["command"], user, db)
        executions.append({
            "channel": "command_pipeline",
            "ok": response.executed_count > 0,
            "summary": response.summary,
            "executed_count": response.executed_count,
        })

    verified = sum(1 for e in executions if e.get("ok"))
    return {
        "ok": True,
        "agent_id": agent_id,
        "agent_name": agent["name"],
        "deliverable": deliverable,
        "executions": executions,
        "verified_channels": verified,
        "summary": _build_summary(agent, deliverable, executions, verified),
        "intel_used": {
            "competitors_scanned": len(intel.get("competitors") or []),
            "brand_mentions": len((intel.get("brand") or {}).get("mentions") or []),
            "crm_leads": len(intel.get("crm_leads") or []),
            "ads_connected": bool(intel.get("ads")),
        },
    }


def _overlay_live_data(agent_id: str, deliverable: dict, intel: dict, context) -> dict:
    out = dict(deliverable)
    if agent_id == "ads_monitoring":
        ads = intel.get("ads") or {}
        meta = ads.get("meta") or {}
        google = ads.get("google_ads") or {}
        if meta.get("metrics"):
            m = meta["metrics"]
            spend = m.get("spend", 0)
            clicks = m.get("clicks", 0)
            out["metrics_context"] = f"Meta 30d: ${spend:.2f} spend, {clicks} clicks"
            if not out.get("action") or out.get("generated_by") == "rules":
                out["decision"] = "test" if spend > 0 else "scale"
                out["action"] = out.get("action") or "Test 3 new hooks on top Meta ad — cap at 20% budget."
        if google.get("message"):
            out["google_ads_live"] = google.get("message")
    if agent_id == "customer_finder":
        leads = intel.get("crm_leads") or []
        if leads and not out.get("leads"):
            out["leads"] = [
                {
                    "name": l.get("name"),
                    "channel": "HubSpot CRM",
                    "intent_signal": "CRM contact",
                    "opening_line": f"Hi {l.get('name','')} — quick follow-up from {context.company}.",
                    "priority": "high",
                }
                for l in leads[:10]
            ]
    if agent_id == "customer_stealer":
        comps = intel.get("competitors") or []
        signals = []
        for c in comps:
            signals.extend(c.get("signals") or [])
        if signals:
            out["live_signals"] = signals
            out["one_move_today"] = out.get("one_move_today") or signals[0]
    if agent_id == "brand_monitoring":
        brand = intel.get("brand") or {}
        out["sentiment"] = brand.get("sentiment", out.get("sentiment"))
        mentions = brand.get("mentions") or []
        if mentions:
            out["live_mentions"] = mentions[:5]
    return out


def _build_summary(agent: dict, deliverable: dict, executions: list, verified: int) -> str:
    title = deliverable.get("title") or agent["name"]
    action = deliverable.get("action") or deliverable.get("one_move_today") or ""
    base = f"{title}"
    if action:
        base += f" — {action}"
    if verified:
        base += f" ({verified} channel{'s' if verified != 1 else ''} executed)"
    return base[:500]
