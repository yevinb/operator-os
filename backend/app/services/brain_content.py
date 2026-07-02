"""AI deliverable generation for Nexa Brain agents (Nas-style magic employees)."""

from __future__ import annotations

import json
from typing import Any

from app.services.ai_clients import complete_json, has_any_ai_key
from app.services.business_context import BusinessContext

_PROMPTS: dict[str, str] = {
    "social_pack": """Generate today's social content pack for this business.
Return JSON:
{
  "title": "Daily Social Pack",
  "instagram_post": "full caption with hooks and CTA",
  "instagram_reel_hook": "15-sec reel script hook",
  "facebook_post": "FB post text",
  "static_image_idea": "describe visual for designer",
  "hashtags": ["tag1","tag2"],
  "weekly_theme": "one line theme for the week"
}""",
    "lead_shortlist": """Find high-intent buyer conversations for this business.
Return JSON:
{
  "title": "Today's Customer Finder Shortlist",
  "leads": [{"name":"","channel":"","intent_signal":"","opening_line":"","priority":"high|medium"}],
  "summary": "one sentence"
}""",
    "competitive_brief": """Competitive intelligence brief — when to poach unhappy competitor customers.
Return JSON:
{
  "title": "Customer Stealer Brief",
  "competitors_to_watch": ["name"],
  "signals": ["signal to monitor"],
  "poach_actions": [{"action":"","target_segment":"","message_angle":""}],
  "one_move_today": "single imperative action"
}""",
    "campaign_brief": """Trend/opportunity campaign ready to launch NOW.
Return JSON:
{
  "title": "Opportunity Campaign Brief",
  "trend": "what's happening",
  "window": "why now",
  "campaign_name": "",
  "hook": "",
  "channels": ["IG","FB","email"],
  "copy": "launch post copy",
  "cta": ""
}""",
    "seo_article": """SEO blog targeting high-intent buyer keywords.
Return JSON:
{
  "title": "article title",
  "meta_description": "",
  "target_keyword": "",
  "outline": ["H2 section", ...],
  "intro_paragraph": "first 150 words",
  "faq": [{"q":"","a":""}]
}""",
    "video_script": """YouTube + Shorts script from their latest content angle.
Return JSON:
{
  "title": "Video Script Pack",
  "youtube_title": "",
  "youtube_script": "60-90 sec script",
  "shorts_hooks": ["hook1","hook2","hook3"],
  "thumbnail_idea": ""
}""",
    "creator_shortlist": """UGC creators who fit this brand.
Return JSON:
{
  "title": "UGC Creator Shortlist",
  "creators": [{"handle":"","niche":"","why_fit":"","estimated_rate":"","outreach_dm":""}],
  "summary": ""
}""",
    "ad_creatives": """10 ad variants across platforms.
Return JSON:
{
  "title": "AI Ads Maker Batch",
  "variants": [{"platform":"Meta|Google|TikTok|LinkedIn","hook":"","primary_text":"","headline":"","cta":""}],
  "best_performer_prediction": "which to test first and why"
}""",
    "ads_decision": """ONE ads decision only — scale, kill, or test.
Return JSON:
{
  "title": "Today's Ads Decision",
  "decision": "scale|kill|test",
  "target": "which campaign/ad set",
  "action": "one imperative sentence",
  "why": "one sentence",
  "metrics_context": "brief if known"
}""",
    "brand_digest": """Daily brand monitoring digest.
Return JSON:
{
  "title": "Brand Monitoring Digest",
  "sentiment": "positive|neutral|at_risk",
  "mentions_summary": "",
  "alerts": ["alert if any"],
  "recommended_response": "one action if needed",
  "weekly_trend": "one line"
}""",
    "revenue_brief": """Revenue pulse with risks.
Return JSON:
{
  "title": "Revenue Pulse",
  "snapshot": "",
  "risks": ["risk"],
  "one_action": "what to do today",
  "why": ""
}""",
    "outreach_batch": """Outreach email batch for warm leads.
Return JSON:
{
  "title": "Outreach Batch",
  "emails": [{"to":"","subject":"","body":""}],
  "summary": ""
}""",
}


def _rule_deliverable(dtype: str, context: BusinessContext, metrics: dict) -> dict:
    company = context.company or "your business"
    templates: dict[str, dict] = {
        "social_pack": {
            "title": "Daily Social Pack",
            "instagram_post": f"🚀 {company} is solving {context.goal or 'growth'} for {context.market or 'your market'}. Here's what we learned this week — comment 'GROW' for the playbook.",
            "instagram_reel_hook": f"POV: You finally automated {context.industry or 'your business'} with AI",
            "facebook_post": f"{company} update: We're helping clients hit {context.goal or 'revenue goals'}. DM us to learn how.",
            "static_image_idea": f"Bold quote card: '{context.goal or 'Grow smarter'}' with {company} branding",
            "hashtags": ["#business", "#growth", "#AI"],
            "weekly_theme": f"{context.industry or 'Business'} growth week",
        },
        "lead_shortlist": {
            "title": "Today's Customer Finder Shortlist",
            "leads": [
                {"name": "Warm lead from CRM", "channel": "HubSpot", "intent_signal": "Visited pricing", "opening_line": f"Hi — saw you exploring {company}. Happy to help.", "priority": "high"},
                {"name": "LinkedIn prospect", "channel": "LinkedIn", "intent_signal": "Posted about hiring", "opening_line": "Congrats on scaling — we help with ops automation.", "priority": "medium"},
            ],
            "summary": "2 high-intent conversations to enter today.",
        },
        "competitive_brief": {
            "title": "Customer Stealer Brief",
            "competitors_to_watch": ["Top competitor in your niche"],
            "signals": ["Complaints on social", "Price increases", "Service outages"],
            "poach_actions": [{"action": "DM unhappy customers", "target_segment": "SMB switching tools", "message_angle": "We migrate you in 48h"}],
            "one_move_today": "Search competitor brand + 'frustrated' on X/Reddit and reply helpfully.",
        },
        "campaign_brief": {
            "title": "Opportunity Campaign Brief",
            "trend": f"AI ops tools trending in {context.industry or 'your industry'}",
            "window": "Next 72 hours before competitors copy the angle",
            "campaign_name": f"{company} AI Brain Launch",
            "hook": "Your second marketing brain — learns daily",
            "channels": ["IG", "FB", "email"],
            "copy": f"{company} just dropped an AI brain that learns your business every day. One decision. Real execution.",
            "cta": "Start free",
        },
        "ads_decision": {
            "title": "Today's Ads Decision",
            "decision": "test",
            "target": "Top spending ad set",
            "action": "Duplicate best ad with 3 new hooks and cap spend at 20% of budget.",
            "why": "Fresh creative extends winning campaigns without scaling losers.",
            "metrics_context": str(metrics)[:200] if metrics else "Connect Meta/Google Ads for live metrics.",
        },
    }
    return templates.get(dtype, {
        "title": f"{dtype.replace('_', ' ').title()}",
        "body": f"Deliverable for {company}. Connect integrations for live execution.",
        "summary": context.business_narrative or "",
    })


async def generate_deliverable(
    deliverable_type: str,
    context: BusinessContext,
    *,
    metrics: dict | None = None,
    learned: dict | None = None,
    extra: dict | None = None,
) -> dict:
    metrics = metrics or {}
    learned = learned or {}
    extra = extra or {}

    system = _PROMPTS.get(deliverable_type, "Return JSON with title and body fields for a business deliverable.")
    user_payload = {
        "company": context.company,
        "industry": context.industry,
        "goal": context.goal,
        "market": context.market,
        "description": context.description,
        "website": context.website,
        "connected_integrations": context.connected_integrations,
        "metrics": metrics,
        "narrative": context.business_narrative,
        "recent_commands": (learned.get("recent_commands") or [])[:5],
        **extra,
    }

    if has_any_ai_key():
        result = await complete_json(
            system + "\nBe specific to this company. No generic filler.",
            json.dumps(user_payload),
            max_tokens=1200,
        )
        if result:
            result["deliverable_type"] = deliverable_type
            result["generated_by"] = "ai"
            return result

    out = _rule_deliverable(deliverable_type, context, metrics)
    out["deliverable_type"] = deliverable_type
    out["generated_by"] = "rules"
    return out
