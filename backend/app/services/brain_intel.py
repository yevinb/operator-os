"""Live intelligence gathering for Nexa Brain — competitors, brand, web, CRM."""

from __future__ import annotations

import re
from html import unescape
from typing import Any
from urllib.parse import quote_plus, urlparse

import httpx

from app.services.integrations.google import google_ads_campaign_stats, resolve_google_access
from app.services.integrations.providers import (
    hubspot_list_contacts,
    meta_account_insights,
    meta_first_ad_account,
)


def _strip_html(text: str) -> str:
    text = re.sub(r"<script[^>]*>.*?</script>", "", text, flags=re.I | re.S)
    text = re.sub(r"<style[^>]*>.*?</style>", "", text, flags=re.I | re.S)
    text = re.sub(r"<[^>]+>", " ", text)
    return unescape(re.sub(r"\s+", " ", text)).strip()


async def fetch_page_intel(url: str) -> dict[str, Any]:
    url = url.strip()
    if not url.startswith("http"):
        url = f"https://{url}"
    try:
        async with httpx.AsyncClient(timeout=20, follow_redirects=True) as client:
            r = await client.get(url, headers={"User-Agent": "NexaBrain/1.0"})
            if r.status_code >= 400:
                return {"url": url, "ok": False, "error": f"HTTP {r.status_code}"}
            html = r.text[:500_000]
            title_m = re.search(r"<title[^>]*>([^<]+)</title>", html, re.I)
            desc_m = re.search(
                r'<meta[^>]+name=["\']description["\'][^>]+content=["\']([^"\']+)["\']',
                html,
                re.I,
            )
            og_m = re.search(
                r'<meta[^>]+property=["\']og:description["\'][^>]+content=["\']([^"\']+)["\']',
                html,
                re.I,
            )
            title = title_m.group(1).strip() if title_m else urlparse(url).netloc
            description = (desc_m.group(1) if desc_m else og_m.group(1) if og_m else "")[:500]
            snippet = _strip_html(html)[:800]
            return {
                "url": url,
                "ok": True,
                "title": title,
                "description": description,
                "snippet": snippet,
            }
    except Exception as e:
        return {"url": url, "ok": False, "error": str(e)}


async def web_search(query: str, max_results: int = 6) -> list[dict[str, str]]:
    """Public web search for brand/competitor signals."""
    results: list[dict[str, str]] = []
    try:
        async with httpx.AsyncClient(timeout=20, follow_redirects=True) as client:
            r = await client.get(
                "https://html.duckduckgo.com/html/",
                params={"q": query},
                headers={"User-Agent": "Mozilla/5.0 (compatible; NexaBrain/1.0)"},
            )
            if r.status_code != 200:
                return results
            html = r.text
            blocks = re.findall(
                r'<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([^<]+)</a>.*?'
                r'<a[^>]+class="result__snippet"[^>]*>([^<]*)</a>',
                html,
                re.S,
            )
            for href, title, snippet in blocks[:max_results]:
                results.append({
                    "url": href,
                    "title": _strip_html(title),
                    "snippet": _strip_html(snippet),
                })
    except Exception:
        pass
    return results


async def monitor_competitors(competitor_urls: list[str]) -> list[dict]:
    out = []
    for url in competitor_urls[:8]:
        intel = await fetch_page_intel(url)
        signals = []
        if intel.get("ok"):
            blob = f"{intel.get('title','')} {intel.get('description','')} {intel.get('snippet','')}".lower()
            if any(w in blob for w in ("pricing", "price", "plan")):
                signals.append("Pricing page activity detected")
            if any(w in blob for w in ("sorry", "down", "outage", "issue")):
                signals.append("Possible service issues — poach opportunity")
            if any(w in blob for w in ("new", "launch", "announcing")):
                signals.append("New launch detected — counter-campaign window")
        out.append({**intel, "signals": signals})
    return out


async def monitor_brand(company: str, keywords: list[str]) -> dict:
    queries = [f'"{company}"', f"{company} review", f"{company} alternative"]
    for kw in keywords[:3]:
        queries.append(f"{company} {kw}")
    mentions: list[dict] = []
    for q in queries[:5]:
        for hit in await web_search(q, max_results=3):
            mentions.append({**hit, "query": q})
    sentiment = "neutral"
    blob = " ".join(m.get("snippet", "") for m in mentions).lower()
    if any(w in blob for w in ("love", "great", "amazing", "recommend")):
        sentiment = "positive"
    if any(w in blob for w in ("scam", "terrible", "awful", "refund", "angry", "broken")):
        sentiment = "at_risk"
    return {"company": company, "sentiment": sentiment, "mentions": mentions[:12], "queries_run": queries}


async def gather_ads_intel(integration_data: dict, connected: list[str]) -> dict:
    intel: dict[str, Any] = {"meta": None, "google_ads": None}
    if "meta" in connected:
        meta = integration_data.get("meta", {})
        token = meta.get("api_key", "")
        cfg = meta.get("config", {})
        acct = cfg.get("ad_account_id") or ""
        if token and not acct:
            acct = await meta_first_ad_account(token) or ""
        if token and acct:
            ok, msg, metrics = await meta_account_insights(token, acct)
            intel["meta"] = {"ok": ok, "message": msg, "metrics": metrics, "account": acct}
    if "google-ads" in connected:
        ads = integration_data.get("google-ads", {})
        cfg = ads.get("config", {})
        dev = cfg.get("developer_token") or ads.get("api_key", "")
        customer = cfg.get("customer_id", "")
        oauth = cfg.get("google_oauth", {})
        if dev and customer and oauth:
            access, _ = await resolve_google_access(oauth, gmail=False)
            if access:
                ok, msg, stats = await google_ads_campaign_stats(dev, customer, access)
                intel["google_ads"] = {"ok": ok, "message": msg, "stats": stats}
    return intel


async def gather_crm_leads(integration_data: dict, connected: list[str], limit: int = 15) -> list[dict]:
    if "hubspot" not in connected:
        return []
    key = integration_data.get("hubspot", {}).get("api_key", "")
    if not key:
        return []
    return await hubspot_list_contacts(key, limit=limit)


async def build_intel_context(
    company: str,
    integration_data: dict,
    connected: list[str],
    *,
    competitors: list[str],
    brand_keywords: list[str],
    website: str = "",
) -> dict:
    urls = list(competitors)
    if website and website not in urls:
        urls.insert(0, website)
    comp_intel, brand_intel, ads, leads = await gather_parallel(
        company, integration_data, connected, urls, brand_keywords
    )
    return {
        "competitors": comp_intel,
        "brand": brand_intel,
        "ads": ads,
        "crm_leads": leads,
    }


async def gather_parallel(
    company: str,
    integration_data: dict,
    connected: list[str],
    competitors: list[str],
    brand_keywords: list[str],
) -> tuple:
    import asyncio

    return await asyncio.gather(
        monitor_competitors(competitors),
        monitor_brand(company, brand_keywords),
        gather_ads_intel(integration_data, connected),
        gather_crm_leads(integration_data, connected),
    )
