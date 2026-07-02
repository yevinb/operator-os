"""Full Nas Agents catalog — 10+ magic employees for Nexa Brain."""

from __future__ import annotations

from typing import Any

# Mirrors https://agents.nas.com/ agent lineup
AGENT_CATALOG: list[dict[str, Any]] = [
    {
        "id": "social_content",
        "tag": "Awareness",
        "name": "AI Social Content",
        "description": "We run your social channels for you. Every platform, every day, zero briefs from your team.",
        "outcome": "Daily posts, reels & statics across IG and FB + weekly report",
        "integrations": ["meta", "slack"],
        "deliverable_type": "social_pack",
        "schedule": "daily",
        "always_generates": True,
    },
    {
        "id": "customer_finder",
        "tag": "Intent Capture",
        "name": "Customer Finder",
        "description": "We find people actively shopping in your category and get you in the conversation before anyone else.",
        "outcome": "Daily shortlist of live buying conversations to enter",
        "integrations": ["hubspot", "gmail"],
        "deliverable_type": "lead_shortlist",
        "schedule": "daily",
        "always_generates": True,
    },
    {
        "id": "customer_stealer",
        "tag": "Awareness",
        "name": "Customer Stealer",
        "description": "We monitor your competitors 24/7 and tell you exactly when to poach their unhappy customers.",
        "outcome": "Daily competitive brief with specific actions to take",
        "integrations": ["slack"],
        "deliverable_type": "competitive_brief",
        "schedule": "daily",
        "always_generates": True,
    },
    {
        "id": "opportunity_finder",
        "tag": "Viral Awareness",
        "name": "Opportunity Finder",
        "description": "We tell you when a trend or industry moment is worth a campaign, and hand you one ready to launch.",
        "outcome": "Campaign brief delivered while the window is still open",
        "integrations": ["slack", "meta"],
        "deliverable_type": "campaign_brief",
        "schedule": "daily",
        "always_generates": True,
    },
    {
        "id": "seo_writer",
        "tag": "Organic Discovery",
        "name": "SEO & Blog Writer",
        "description": "We publish SEO content under your brand, targeting keywords your buyers are searching.",
        "outcome": "Biweekly blogs, guides & FAQs targeting high-intent queries",
        "integrations": ["notion", "slack"],
        "deliverable_type": "seo_article",
        "schedule": "biweekly",
        "always_generates": True,
    },
    {
        "id": "seo_video",
        "tag": "Brand Authority",
        "name": "SEO Video Maker",
        "description": "We turn every blog post into a YouTube video. Double the reach, zero extra work from your team.",
        "outcome": "Biweekly video scripts, Shorts formats & YouTube-ready outlines",
        "integrations": ["notion", "slack"],
        "deliverable_type": "video_script",
        "schedule": "biweekly",
        "always_generates": True,
    },
    {
        "id": "ugc_finder",
        "tag": "Social Proof",
        "name": "UGC Creator Finder",
        "description": "We find creators who genuinely fit your brand, before their rates go up and your competitor signs them.",
        "outcome": "Weekly shortlist of vetted creators with outreach templates",
        "integrations": ["gmail", "slack"],
        "deliverable_type": "creator_shortlist",
        "schedule": "weekly",
        "always_generates": True,
    },
    {
        "id": "ads_maker",
        "tag": "Conversion",
        "name": "AI Ads Maker",
        "description": "We produce a fresh batch of ad creative every week so your campaigns never run on stale hooks.",
        "outcome": "10–20 ad variants per brief across Meta, Google, TikTok & LinkedIn",
        "integrations": ["meta", "google-ads"],
        "deliverable_type": "ad_creatives",
        "schedule": "weekly",
        "always_generates": True,
    },
    {
        "id": "ads_monitoring",
        "tag": "Optimization",
        "name": "Daily Ads Monitoring",
        "description": "Every morning we review your ad accounts and send you one action: scale this, kill that, test here.",
        "outcome": "Daily performance brief — no data dumps, just decisions",
        "integrations": ["google-ads", "meta"],
        "deliverable_type": "ads_decision",
        "schedule": "daily",
        "command": "Review ad performance and give me exactly one action: scale, kill, or test",
    },
    {
        "id": "brand_monitoring",
        "tag": "Retention",
        "name": "Daily Brand Monitoring",
        "description": "We read every mention of your brand online and alert you the moment something goes sideways.",
        "outcome": "Daily brand digest + weekly sentiment trend report",
        "integrations": ["slack", "hubspot"],
        "deliverable_type": "brand_digest",
        "schedule": "daily",
        "always_generates": True,
    },
    {
        "id": "revenue_pulse",
        "tag": "Conversion",
        "name": "Revenue Pulse",
        "description": "Monitors Stripe, Shopify, and QuickBooks — surfaces revenue risks before they hit your bank account.",
        "outcome": "Daily revenue snapshot + anomaly alerts",
        "integrations": ["stripe", "shopify", "quickbooks"],
        "deliverable_type": "revenue_brief",
        "schedule": "daily",
        "command": "Give me today's revenue pulse and flag any risks",
    },
    {
        "id": "email_outreach",
        "tag": "Conversion",
        "name": "Outreach Agent",
        "description": "Sends follow-ups and customer emails via your connected Gmail — on autopilot.",
        "outcome": "Automated follow-ups from your inbox",
        "integrations": ["gmail"],
        "deliverable_type": "outreach_batch",
        "schedule": "daily",
        "command": "Send follow-up emails to my warmest leads today",
    },
    {
        "id": "ops_autopilot",
        "tag": "Operations",
        "name": "Full Autopilot",
        "description": "Runs a full business cycle across every connected tool — your 24/7 AI COO.",
        "outcome": "Multi-step execution across all integrations",
        "integrations": [],
        "autopilot_mode": "full",
        "schedule": "daily",
    },
]


def agent_by_id(agent_id: str) -> dict | None:
    for a in AGENT_CATALOG:
        if a["id"] == agent_id:
            return a
    return None


def agent_status(agent: dict, connected: set[str]) -> str:
    if agent.get("always_generates"):
        return "active"
    required = set(agent.get("integrations") or [])
    if not required:
        return "active" if connected else "needs_setup"
    if required & connected:
        return "active"
    if agent.get("autopilot_mode"):
        return "active" if connected else "needs_setup"
    return "needs_setup"
