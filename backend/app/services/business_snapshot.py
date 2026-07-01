"""Unified business snapshot — live data from all connected integrations."""

from __future__ import annotations

import asyncio
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any

from app.services.integrations.google import google_ads_campaign_stats, resolve_google_access
from app.services.integrations.providers import (
    hubspot_snapshot,
    linkedin_profile_snapshot,
    meta_account_insights,
    meta_first_ad_account,
    quickbooks_finance_snapshot,
)
from app.services.instagram_integration import instagram_snapshot
from app.services.shopify_integration import fetch_shopify_snapshot

IntegrationData = dict[str, dict]

_CACHE: dict[str, tuple[float, "BusinessSnapshot"]] = {}
_CACHE_TTL = 60.0


@dataclass
class BusinessSnapshot:
    metrics: dict[str, str | float | int] = field(default_factory=dict)
    sources: dict[str, dict[str, Any]] = field(default_factory=dict)
    narrative: str = ""
    updated_at: str = ""
    connected: list[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "metrics": self.metrics,
            "sources": self.sources,
            "narrative": self.narrative,
            "updated_at": self.updated_at,
            "connected": self.connected,
        }


def _build_narrative(company: str, metrics: dict, connected: list[str]) -> str:
    parts: list[str] = []
    if metrics.get("stripe_balance_usd") is not None:
        parts.append(f"Stripe balance ${metrics['stripe_balance_usd']}")
    if metrics.get("stripe_customers") is not None:
        parts.append(f"{metrics['stripe_customers']} customers")
    if metrics.get("hubspot_contacts") is not None:
        parts.append(f"{metrics['hubspot_contacts']} CRM contacts")
    if metrics.get("meta_spend") is not None:
        parts.append(f"Meta spend ${metrics['meta_spend']:.2f} (30d)")
    if metrics.get("google_ads_spend") is not None:
        parts.append(f"Google Ads spend ${metrics['google_ads_spend']:.2f}")
    if metrics.get("quickbooks_income") is not None:
        parts.append(f"QuickBooks income {metrics['quickbooks_income']}")
    if metrics.get("linkedin_name"):
        parts.append(f"LinkedIn: {metrics['linkedin_name']}")
    if metrics.get("shopify_orders") is not None:
        parts.append(f"Shopify {metrics['shopify_orders']} orders")
    if metrics.get("shopify_revenue_usd") is not None:
        parts.append(f"${metrics['shopify_revenue_usd']} store revenue")
    if metrics.get("instagram_followers") is not None:
        user = metrics.get("instagram_username", "IG")
        parts.append(f"@{user} {metrics['instagram_followers']} followers")

    if not parts:
        tools = ", ".join(connected) if connected else "no tools"
        return f"{company}: Nexa is online. Connected: {tools}. Connect more integrations for live metrics."

    return f"{company} pulse — " + ", ".join(parts) + "."


async def _fetch_stripe(data: IntegrationData) -> tuple[dict, dict]:
    key = data.get("stripe", {}).get("api_key", "")
    if not key:
        return {}, {}
    snap = await fetch_stripe_snapshot(key)
    if not snap:
        return {}, {}
    return dict(snap), {"stripe": snap}


async def _fetch_hubspot(data: IntegrationData) -> tuple[dict, dict]:
    key = data.get("hubspot", {}).get("api_key", "")
    if not key:
        return {}, {}
    snap = await hubspot_snapshot(key)
    if not snap:
        return {}, {}
    return {"hubspot_contacts": snap.get("hubspot_contacts", 0)}, {"hubspot": snap}


async def _fetch_meta(data: IntegrationData) -> tuple[dict, dict]:
    meta = data.get("meta", {})
    token = meta.get("api_key", "")
    if not token:
        return {}, {}
    cfg = meta.get("config", {})
    acct = cfg.get("ad_account_id", "") or await meta_first_ad_account(token) or ""
    if not acct:
        return {}, {}
    ok, _msg, proof = await meta_account_insights(token, acct)
    if not ok or not proof:
        return {}, {}
    return {
        "meta_spend": proof.get("spend", 0),
        "meta_impressions": proof.get("impressions", 0),
        "meta_clicks": proof.get("clicks", 0),
    }, {"meta": proof}


async def _fetch_google_ads(data: IntegrationData) -> tuple[dict, dict]:
    ads = data.get("google-ads", {})
    cfg = ads.get("config", {})
    dev = cfg.get("developer_token") or ads.get("api_key", "")
    customer = cfg.get("customer_id", "")
    oauth = cfg.get("google_oauth", {})
    access = ""
    if oauth:
        access, _ = await resolve_google_access(oauth, gmail=False)
    if not access:
        gmail_cfg = data.get("gmail", {}).get("config", {})
        if gmail_cfg:
            access, _ = await resolve_google_access(gmail_cfg, gmail=False)
    if not (dev and customer and access):
        return {}, {}
    ok, _msg, proof = await google_ads_campaign_stats(dev, customer, access)
    if not ok or not proof:
        return {}, {}
    spend = proof.get("spend_usd", 0)
    return {
        "google_ads_spend": spend,
        "google_ads_campaigns": proof.get("campaigns", 0),
    }, {"google-ads": proof}


async def _fetch_quickbooks(data: IntegrationData) -> tuple[dict, dict]:
    qb = data.get("quickbooks", {})
    token = qb.get("api_key", "")
    realm = qb.get("config", {}).get("realm_id", "")
    if not (token and realm):
        return {}, {}
    ok, _msg, proof = await quickbooks_finance_snapshot(token, realm)
    if not ok:
        return {}, {}
    income = proof.get("income", "N/A")
    return {"quickbooks_income": income}, {"quickbooks": proof}


async def _fetch_shopify(data: IntegrationData) -> tuple[dict, dict]:
    shop = data.get("shopify", {})
    token = shop.get("api_key", "")
    domain = shop.get("config", {}).get("shop_domain", "")
    if not (token and domain):
        return {}, {}
    snap = await fetch_shopify_snapshot(domain, token)
    if not snap or snap.get("shopify_status") == "error":
        return {}, {}
    return {
        "shopify_orders": snap.get("shopify_orders", 0),
        "shopify_revenue_usd": snap.get("shopify_revenue_usd", 0),
        "shopify_products": snap.get("shopify_products", 0),
        "shopify_store": snap.get("shopify_store", ""),
    }, {"shopify": snap}


async def _fetch_instagram(data: IntegrationData) -> tuple[dict, dict]:
    ig = data.get("instagram", {})
    token = ig.get("api_key", "")
    if not token:
        return {}, {}
    account_id = ig.get("config", {}).get("instagram_account_id", "")
    snap = await instagram_snapshot(token, account_id)
    if not snap:
        return {}, {}
    return {
        "instagram_username": snap.get("instagram_username", ""),
        "instagram_followers": snap.get("instagram_followers", 0),
        "instagram_posts": snap.get("instagram_posts", 0),
    }, {"instagram": snap}


async def _fetch_linkedin(data: IntegrationData) -> tuple[dict, dict]:
    token = data.get("linkedin", {}).get("api_key", "")
    if not token:
        return {}, {}
    ok, _msg, proof = await linkedin_profile_snapshot(token)
    if not ok:
        return {}, {}
    name = proof.get("name", "")
    return {"linkedin_name": name}, {"linkedin": proof}


async def build_business_snapshot(
    company: str,
    connected: list[str],
    integration_data: IntegrationData,
    *,
    use_cache: bool = True,
    cache_key: str = "",
) -> BusinessSnapshot:
    key = cache_key or company
    if use_cache and key in _CACHE:
        ts, snap = _CACHE[key]
        if time.monotonic() - ts < _CACHE_TTL:
            return snap

    fetchers: list[tuple[str, Any]] = []
    if "stripe" in connected:
        fetchers.append(("stripe", _fetch_stripe(integration_data)))
    if "hubspot" in connected:
        fetchers.append(("hubspot", _fetch_hubspot(integration_data)))
    if "meta" in connected:
        fetchers.append(("meta", _fetch_meta(integration_data)))
    if "google-ads" in connected:
        fetchers.append(("google-ads", _fetch_google_ads(integration_data)))
    if "quickbooks" in connected:
        fetchers.append(("quickbooks", _fetch_quickbooks(integration_data)))
    if "shopify" in connected:
        fetchers.append(("shopify", _fetch_shopify(integration_data)))
    if "instagram" in connected:
        fetchers.append(("instagram", _fetch_instagram(integration_data)))
    if "linkedin" in connected:
        fetchers.append(("linkedin", _fetch_linkedin(integration_data)))

    metrics: dict[str, str | float | int] = {}
    sources: dict[str, dict] = {}

    if fetchers:
        results = await asyncio.gather(*[f[1] for f in fetchers], return_exceptions=True)
        for (name, _), result in zip(fetchers, results):
            if isinstance(result, Exception):
                continue
            m, s = result
            metrics.update(m)
            sources.update(s)

    now = datetime.now(timezone.utc).isoformat()
    snap = BusinessSnapshot(
        metrics=metrics,
        sources=sources,
        narrative=_build_narrative(company, metrics, connected),
        updated_at=now,
        connected=list(connected),
    )
    _CACHE[key] = (time.monotonic(), snap)
    return snap
