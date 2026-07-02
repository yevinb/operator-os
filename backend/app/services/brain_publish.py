"""Publish Brain deliverables to Slack, Notion, Meta, LinkedIn, HubSpot."""

from __future__ import annotations

import json
from typing import Any

from app.services.integrations.providers import (
    hubspot_log_note,
    linkedin_share_update,
    meta_post_page_update,
    notion_create_note,
    notion_find_database,
)
from app.services.webhooks import send_slack_message


def _format_deliverable(agent_id: str, deliverable: dict) -> str:
    lines = [f"🧠 Nexa Brain — {deliverable.get('title', agent_id)}"]
    for key, val in deliverable.items():
        if key in ("title", "deliverable_type", "generated_by", "asset_id"):
            continue
        if isinstance(val, str) and val.strip():
            lines.append(f"\n*{key.replace('_', ' ').title()}*\n{val}")
        elif isinstance(val, list) and val:
            lines.append(f"\n*{key.replace('_', ' ').title()}*")
            for item in val[:5]:
                if isinstance(item, dict):
                    lines.append("• " + " — ".join(f"{k}: {v}" for k, v in item.items() if v)[:200])
                else:
                    lines.append(f"• {item}")
    return "\n".join(lines)[:3500]


async def publish_deliverable(
    agent_id: str,
    deliverable: dict,
    integration_data: dict,
    connected: list[str],
    company: str,
) -> list[dict[str, Any]]:
    """Push deliverable to every connected channel. Returns execution proofs."""
    proofs: list[dict[str, Any]] = []
    text = _format_deliverable(agent_id, deliverable)
    title = str(deliverable.get("title") or f"Nexa Brain — {agent_id}")

    slack_url = integration_data.get("slack", {}).get("api_key", "")
    if slack_url and "slack" in connected:
        ok, msg = await send_slack_message(slack_url, text)
        proofs.append({"channel": "slack", "ok": ok, "message": msg})

    notion = integration_data.get("notion", {})
    if notion.get("api_key") and "notion" in connected:
        cfg = notion.get("config", {})
        db_id = cfg.get("database_id", "")
        if not db_id:
            db_id = await notion_find_database(notion["api_key"]) or ""
        ok, msg = await notion_create_note(notion["api_key"], db_id, title, text)
        proofs.append({"channel": "notion", "ok": ok, "message": msg})

    hubspot_key = integration_data.get("hubspot", {}).get("api_key", "")
    if hubspot_key and "hubspot" in connected:
        ok, msg = await hubspot_log_note(hubspot_key, text, title=title)
        proofs.append({"channel": "hubspot", "ok": ok, "message": msg})

    meta_token = integration_data.get("meta", {}).get("api_key", "")
    if meta_token and "meta" in connected and agent_id in ("social_content", "opportunity_finder", "ads_maker"):
        post_body = (
            deliverable.get("instagram_post")
            or deliverable.get("facebook_post")
            or deliverable.get("copy")
            or text[:2000]
        )
        if isinstance(post_body, str) and post_body.strip():
            ok, msg = await meta_post_page_update(meta_token, post_body)
            proofs.append({"channel": "meta_page", "ok": ok, "message": msg})

    linkedin_token = integration_data.get("linkedin", {}).get("api_key", "")
    if linkedin_token and "linkedin" in connected and agent_id in ("social_content", "seo_video"):
        post = deliverable.get("instagram_post") or deliverable.get("youtube_script") or text[:2800]
        if isinstance(post, str):
            ok, msg = await linkedin_share_update(linkedin_token, post[:3000])
            proofs.append({"channel": "linkedin", "ok": ok, "message": msg})

    return proofs
