"""
Nexa Brain — full Nas Daily Brain model.

Learns daily · one decision · 13 magic employees · deliverables · 24/7 autopilot.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db_models import (
    BrainAgentRun,
    BrainContentAsset,
    BrainDailyLog,
    BrainMemoryEntry,
    CommandLog,
    User,
)
from app.services.ai_clients import complete_json, has_any_ai_key
from app.services.brain_agents import AGENT_CATALOG, agent_status
from app.services.brain_executor import execute_brain_agent
from app.services.business_context import BusinessContext, build_business_context
from app.services.business_snapshot import build_business_snapshot

SOURCE_LABELS: dict[str, str] = {
    "gmail": "Gmail",
    "google-ads": "Google Ads",
    "meta": "Meta Ads",
    "stripe": "Stripe",
    "shopify": "Shopify",
    "hubspot": "HubSpot",
    "slack": "Slack",
    "notion": "Notion",
    "quickbooks": "QuickBooks",
    "calendar": "Google Calendar",
    "n8n": "n8n",
    "linkedin": "LinkedIn",
    "instagram": "Instagram",
    "google_drive": "Google Drive",
}


def _day_key() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def _week_key() -> str:
    now = datetime.now(timezone.utc)
    return f"{now.isocalendar().year}-W{now.isocalendar().week:02d}"


def _connected_sources(context: BusinessContext) -> list[dict[str, str]]:
    sources: list[dict[str, str]] = [
        {"id": "nexa", "label": context.company or "Your business", "type": "profile"},
    ]
    for iid in context.connected_integrations:
        sources.append({
            "id": iid,
            "label": SOURCE_LABELS.get(iid, iid.replace("-", " ").title()),
            "type": "integration",
        })
    if context.website:
        sources.append({"id": "website", "label": context.website, "type": "url"})
    return sources


async def _recent_commands(db: AsyncSession, user_id: str, limit: int = 15) -> list[dict]:
    result = await db.execute(
        select(CommandLog)
        .where(CommandLog.user_id == user_id)
        .order_by(desc(CommandLog.created_at))
        .limit(limit)
    )
    return [
        {
            "command": r.command,
            "intent": r.intent,
            "summary": r.summary,
            "at": r.created_at.isoformat() if r.created_at else "",
        }
        for r in result.scalars().all()
    ]


async def _memory_snippets(db: AsyncSession, user_id: str, limit: int = 20) -> list[str]:
    result = await db.execute(
        select(BrainMemoryEntry)
        .where(BrainMemoryEntry.user_id == user_id)
        .order_by(desc(BrainMemoryEntry.created_at))
        .limit(limit)
    )
    return [r.content for r in result.scalars().all() if r.content]


async def _store_memory(db: AsyncSession, user_id: str, content: str, source: str, memory_type: str = "insight") -> None:
    if not content.strip():
        return
    db.add(BrainMemoryEntry(user_id=user_id, memory_type=memory_type, content=content[:2000], source=source))
    await db.commit()


async def _store_asset(
    db: AsyncSession,
    user_id: str,
    agent_id: str,
    asset_type: str,
    deliverable: dict,
) -> BrainContentAsset:
    title = str(deliverable.get("title") or f"{agent_id} deliverable")
    asset = BrainContentAsset(
        user_id=user_id,
        agent_id=agent_id,
        asset_type=asset_type,
        title=title[:512],
        body_json=json.dumps(deliverable),
    )
    db.add(asset)
    await db.flush()
    return asset


def list_agents(context: BusinessContext) -> list[dict]:
    connected = set(context.connected_integrations)
    return [
        {**agent, "status": agent_status(agent, connected), "integrations": agent.get("integrations") or []}
        for agent in AGENT_CATALOG
    ]


def _rule_brief(context: BusinessContext, learned: dict, agents: list[dict]) -> dict:
    connected = learned.get("connected_integrations") or []
    narrative = learned.get("narrative") or context.business_narrative or ""
    active = [a for a in agents if a["status"] == "active"]

    if not connected:
        action = "Run your AI Social Content and Customer Finder agents — Brain works even before integrations."
        why = "Nas Brain generates deliverables first, then executes when you connect your stack."
    elif "meta" in connected or "google-ads" in connected:
        action = "Daily Ads Monitoring says: test 3 new hooks on your top ad — cap spend at 20%."
        why = "One ads decision per day beats dashboard paralysis."
    elif "stripe" in connected:
        bal = learned.get("metrics", {}).get("stripe_balance_usd", "—")
        action = f"Revenue Pulse: review ${bal} position, then run Outreach Agent on warm leads."
        why = "Cash + pipeline = daily compound growth."
    else:
        action = "Run all active agents — your Brain has 13 magic employees ready."
        why = f"{len(active)} agents active. Let them work while you focus on strategy."

    return {
        "headline": f"Good morning — your Brain learned {context.company or 'your business'} overnight.",
        "action": action,
        "why": why,
        "insights": [
            narrative[:220] if narrative else "Brain unified your business context.",
            f"{len(active)} agents active · {len(connected)} integrations · learns daily",
            "One decision. Real deliverables. No data dumps.",
        ],
        "generated_by": "rules",
    }


async def _ai_brief(context: BusinessContext, learned: dict, agents: list[dict], memories: list[str]) -> dict | None:
    system = """You are Nexa Brain — Nas.com's "second marketing brain" model.
Return JSON only:
{
  "headline": "motivating morning line",
  "action": "ONE imperative action today (max 2 sentences)",
  "why": "one sentence",
  "insights": ["insight 1", "insight 2", "insight 3"]
}
No dashboards. One decision. Be specific to their company."""

    user = json.dumps({
        "company": context.company,
        "goal": context.goal,
        "industry": context.industry,
        "metrics": learned.get("metrics"),
        "narrative": learned.get("narrative"),
        "active_agents": [a["name"] for a in agents if a["status"] == "active"],
        "memories": memories[:10],
        "recent_commands": learned.get("recent_commands", [])[:5],
    })
    return await complete_json(system, user, max_tokens=550)


async def learn_today(db: AsyncSession, user: User, *, force: bool = False) -> dict:
    day = _day_key()
    if not force:
        existing = await db.execute(
            select(BrainDailyLog).where(BrainDailyLog.user_id == user.id, BrainDailyLog.day_key == day)
        )
        row = existing.scalar_one_or_none()
        if row and row.learned_json:
            return json.loads(row.learned_json)

    context = await build_business_context(user, db)
    integration_data = {
        i.integration_id: {"api_key": i.api_key or "", "config": json.loads(i.config_json or "{}")}
        for i in user.integrations
        if i.connected
    }
    snap = await build_business_snapshot(
        context.company,
        context.connected_integrations,
        integration_data,
        cache_key=user.id,
    )
    commands = await _recent_commands(db, user.id)
    memories = await _memory_snippets(db, user.id)

    learned = {
        "day_key": day,
        "company": context.company,
        "goal": context.goal,
        "industry": context.industry,
        "market": context.market,
        "description": context.description,
        "website": context.website,
        "connected_integrations": list(context.connected_integrations),
        "metrics": snap.metrics,
        "narrative": snap.narrative,
        "recent_commands": commands,
        "memory_count": len(memories),
        "learned_at": datetime.now(timezone.utc).isoformat(),
        "sources_count": len(context.connected_integrations) + 1,
    }

    insight = f"{context.company}: {snap.narrative}"[:500]
    await _store_memory(db, user.id, insight, "daily_learn", "pulse")

    result = await db.execute(
        select(BrainDailyLog).where(BrainDailyLog.user_id == user.id, BrainDailyLog.day_key == day)
    )
    log = result.scalar_one_or_none()
    if log:
        log.learned_json = json.dumps(learned)
    else:
        db.add(BrainDailyLog(user_id=user.id, day_key=day, learned_json=json.dumps(learned)))
    await db.commit()
    return learned


async def get_daily_brief(db: AsyncSession, user: User, *, refresh: bool = False) -> dict:
    day = _day_key()
    learned = await learn_today(db, user, force=refresh)

    result = await db.execute(
        select(BrainDailyLog).where(BrainDailyLog.user_id == user.id, BrainDailyLog.day_key == day)
    )
    log = result.scalar_one_or_none()

    if log and log.brief_json and not refresh:
        brief = json.loads(log.brief_json)
        brief["learned"] = learned
        return brief

    context = await build_business_context(user, db)
    agents = list_agents(context)
    memories = await _memory_snippets(db, user.id)
    brief = await _ai_brief(context, learned, agents, memories) if has_any_ai_key() else None
    if not brief:
        brief = _rule_brief(context, learned, agents)

    brief["day_key"] = day
    brief["learned"] = learned
    brief["generated_at"] = datetime.now(timezone.utc).isoformat()

    if log:
        log.brief_json = json.dumps({k: v for k, v in brief.items() if k != "learned"})
        await db.commit()
    return brief


async def get_weekly_report(db: AsyncSession, user: User, *, refresh: bool = False) -> dict:
    week = _week_key()
    day = _day_key()
    result = await db.execute(
        select(BrainDailyLog).where(BrainDailyLog.user_id == user.id, BrainDailyLog.day_key == day)
    )
    log = result.scalar_one_or_none()

    if log and log.weekly_report_json and not refresh:
        return json.loads(log.weekly_report_json)

    context = await build_business_context(user, db)
    learned = await learn_today(db, user)

    runs_result = await db.execute(
        select(BrainAgentRun)
        .where(BrainAgentRun.user_id == user.id)
        .order_by(desc(BrainAgentRun.created_at))
        .limit(50)
    )
    runs = runs_result.scalars().all()

    report = {
        "week_key": week,
        "title": f"Weekly Brain Report — {context.company}",
        "agents_run": len(runs),
        "highlights": [
            f"{len([r for r in runs if r.status == 'completed'])} agent runs completed",
            learned.get("narrative", "Brain learning active"),
            f"Goal: {context.goal or 'Grow revenue'}",
        ],
        "top_deliverables": [
            json.loads(r.deliverable_json).get("title", r.agent_id)
            for r in runs[:5]
            if r.deliverable_json
        ],
        "next_week_focus": context.goal or "Scale what worked. Kill what didn't.",
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }

    if has_any_ai_key():
        ai = await complete_json(
            "Weekly marketing brain report. Return JSON: title, summary (3 sentences), wins[], risks[], next_week_priorities[]",
            json.dumps({"company": context.company, "runs": len(runs), "learned": learned, "goal": context.goal}),
            max_tokens=700,
        )
        if ai:
            report.update(ai)

    if log:
        log.weekly_report_json = json.dumps(report)
        await db.commit()
    return report


async def get_brain_feed(db: AsyncSession, user: User, limit: int = 30) -> list[dict]:
    assets = await db.execute(
        select(BrainContentAsset)
        .where(BrainContentAsset.user_id == user.id)
        .order_by(desc(BrainContentAsset.created_at))
        .limit(limit)
    )
    out = []
    for a in assets.scalars().all():
        try:
            body = json.loads(a.body_json or "{}")
        except json.JSONDecodeError:
            body = {}
        out.append({
            "id": a.id,
            "agent_id": a.agent_id,
            "asset_type": a.asset_type,
            "title": a.title,
            "body": body,
            "created_at": a.created_at.isoformat() if a.created_at else "",
        })
    return out


async def get_brain_status(db: AsyncSession, user: User) -> dict:
    from app.services.brain_config import config_to_dict, get_brain_config

    context = await build_business_context(user, db)
    agents = list_agents(context)
    active_count = sum(1 for a in agents if a["status"] == "active")

    days_result = await db.execute(
        select(func.count(BrainDailyLog.id)).where(BrainDailyLog.user_id == user.id)
    )
    mem_result = await db.execute(
        select(func.count(BrainMemoryEntry.id)).where(BrainMemoryEntry.user_id == user.id)
    )
    runs_today = await db.execute(
        select(func.count(BrainAgentRun.id)).where(
            BrainAgentRun.user_id == user.id,
            BrainAgentRun.day_key == _day_key(),
        )
    )

    day = _day_key()
    today_log = (
        await db.execute(
            select(BrainDailyLog).where(BrainDailyLog.user_id == user.id, BrainDailyLog.day_key == day)
        )
    ).scalar_one_or_none()

    brain_cfg = config_to_dict(await get_brain_config(db, user.id))

    return {
        "company": context.company,
        "goal": context.goal,
        "tagline": "Learns your business every day so your marketing team can make better decisions.",
        "days_learned": days_result.scalar() or 0,
        "memory_entries": mem_result.scalar() or 0,
        "learned_today": bool(today_log and today_log.learned_json),
        "agents_active": active_count,
        "agents_total": len(AGENT_CATALOG),
        "agents_run_today": runs_today.scalar() or 0,
        "sources": _connected_sources(context),
        "connected_integrations": list(context.connected_integrations),
        "narrative": context.business_narrative,
        "autopilot_24_7": brain_cfg.get("auto_run_daily", True),
        "model": "nas_brain_v2",
        "competitors": brain_cfg.get("competitors", []),
        "brand_keywords": brain_cfg.get("brand_keywords", []),
    }


async def ingest_url(db: AsyncSession, user: User, url: str) -> dict:
    """Learn from a URL — Nas Content-style context ingestion."""
    context = await build_business_context(user, db)
    url = url.strip()
    if not url.startswith("http"):
        url = f"https://{url}"

    summary = f"Business URL registered: {url}"
    if has_any_ai_key():
        ai = await complete_json(
            "Analyze this business URL context for a marketing brain. Return JSON: summary, audience, offers[], tone, keywords[]",
            json.dumps({"url": url, "company": context.company, "industry": context.industry}),
            max_tokens=500,
        )
        if ai:
            summary = ai.get("summary") or summary
            await _store_memory(db, user.id, json.dumps(ai)[:2000], "url_ingest", "context")

    await _store_memory(db, user.id, summary, "url_ingest", "context")
    return {"ok": True, "url": url, "summary": summary}


async def run_agent(db: AsyncSession, user: User, agent_id: str) -> dict:
    learned = await learn_today(db, user)
    result = await execute_brain_agent(db, user, agent_id, learned=learned)
    if not result.get("ok"):
        return result

    deliverable = result.get("deliverable") or {}
    from app.db_models import BrainAgentRun, BrainContentAsset

    asset = BrainContentAsset(
        user_id=user.id,
        agent_id=agent_id,
        asset_type=deliverable.get("deliverable_type", "brief"),
        title=str(deliverable.get("title", agent_id))[:512],
        body_json=json.dumps(deliverable),
    )
    db.add(asset)
    await db.flush()
    deliverable["asset_id"] = asset.id

    day = _day_key()
    db.add(
        BrainAgentRun(
            user_id=user.id,
            agent_id=agent_id,
            day_key=day,
            status="completed",
            deliverable_json=json.dumps(deliverable),
            execution_json=json.dumps(result.get("executions", [])),
        )
    )
    mem = result.get("summary", "")
    if mem:
        await _store_memory(db, user.id, mem, agent_id, "agent_run")
    await db.commit()

    return {
        "ok": True,
        "agent_id": agent_id,
        "agent_name": result.get("agent_name"),
        "deliverable": deliverable,
        "executions": result.get("executions", []),
        "intel_used": result.get("intel_used"),
        "summary": result.get("summary"),
        "executed_count": result.get("verified_channels", 0),
        "planned_count": 0,
    }


async def run_all_active_agents(db: AsyncSession, user: User) -> dict:
    """24/7 magic employees — run every active agent for today."""
    context = await build_business_context(user, db)
    agents = [a for a in list_agents(context) if a["status"] == "active"]
    results = []
    errors = []

    for agent in agents:
        try:
            res = await run_agent(db, user, agent["id"])
            if res.get("ok"):
                results.append({"agent_id": agent["id"], "name": agent["name"], "summary": res.get("summary")})
            else:
                errors.append({"agent_id": agent["id"], "error": res.get("error")})
        except Exception as e:
            errors.append({"agent_id": agent["id"], "error": str(e)})

    await _store_memory(
        db,
        user.id,
        f"Autopilot cycle: {len(results)} agents ran, {len(errors)} skipped",
        "autopilot",
        "cycle",
    )

    return {
        "ok": True,
        "ran": len(results),
        "skipped": len(errors),
        "results": results,
        "errors": errors,
    }


async def morning_cycle(db: AsyncSession, user: User) -> dict:
    """Full Nas morning cycle: learn → brief → run daily agents."""
    learned = await learn_today(db, user, force=True)
    brief = await get_daily_brief(db, user, refresh=True)
    weekly = await get_weekly_report(db, user, refresh=True)

    context = await build_business_context(user, db)
    daily_agents = [
        a for a in list_agents(context)
        if a["status"] == "active" and a.get("schedule") == "daily"
    ]
    agent_results = []
    for agent in daily_agents[:6]:
        res = await run_agent(db, user, agent["id"])
        if res.get("ok"):
            agent_results.append(res)

    return {
        "ok": True,
        "learned": learned,
        "brief": {k: v for k, v in brief.items() if k != "learned"},
        "weekly": weekly,
        "agents_ran": len(agent_results),
        "agent_results": [
            {"name": r.get("agent_name"), "summary": r.get("summary")} for r in agent_results
        ],
    }
