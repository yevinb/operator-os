import json
from datetime import datetime, timezone

import httpx


async def verify_hubspot(api_key: str) -> tuple[bool, str]:
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.get(
                "https://api.hubapi.com/crm/v3/objects/contacts",
                headers={"Authorization": f"Bearer {api_key}"},
                params={"limit": 1},
            )
            if r.status_code == 200:
                total = r.json().get("total", "contacts")
                return True, f"Connected — HubSpot CRM active ({total} contacts indexed)"
            return False, f"HubSpot error {r.status_code}: {r.text[:120]}"
    except Exception as e:
        return False, str(e)


async def hubspot_snapshot(api_key: str) -> dict | None:
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.get(
                "https://api.hubapi.com/crm/v3/objects/contacts",
                headers={"Authorization": f"Bearer {api_key}"},
                params={"limit": 1},
            )
            if r.status_code != 200:
                return None
            return {"hubspot_contacts": r.json().get("total", 0)}
    except Exception:
        return None


async def hubspot_log_note(api_key: str, body: str, title: str = "Nexa update") -> tuple[bool, str]:
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.post(
                "https://api.hubapi.com/crm/v3/objects/notes",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "properties": {
                        "hs_note_body": f"{title}\n\n{body}"[:65000],
                        "hs_timestamp": datetime.now(timezone.utc).isoformat(),
                    }
                },
            )
            if r.status_code in (200, 201):
                return True, "HubSpot note logged to CRM"
            return False, r.text[:120]
    except Exception as e:
        return False, str(e)


async def verify_notion(token: str) -> tuple[bool, str]:
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.get(
                "https://api.notion.com/v1/users/me",
                headers={
                    "Authorization": f"Bearer {token}",
                    "Notion-Version": "2022-06-28",
                },
            )
            if r.status_code == 200:
                name = r.json().get("name", "workspace")
                return True, f"Connected — Notion workspace: {name}"
            return False, f"Notion error {r.status_code}"
    except Exception as e:
        return False, str(e)


async def notion_create_note(token: str, database_id: str, title: str, body: str) -> tuple[bool, str]:
    if not database_id:
        return False, "Notion database ID required in config"
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.post(
                "https://api.notion.com/v1/pages",
                headers={
                    "Authorization": f"Bearer {token}",
                    "Notion-Version": "2022-06-28",
                    "Content-Type": "application/json",
                },
                json={
                    "parent": {"database_id": database_id},
                    "properties": {
                        "Name": {"title": [{"text": {"content": title[:100]}}]},
                    },
                    "children": [
                        {
                            "object": "block",
                            "type": "paragraph",
                            "paragraph": {"rich_text": [{"text": {"content": body[:2000]}}]},
                        }
                    ],
                },
            )
            if r.status_code in (200, 201):
                return True, "Notion page created"
            return False, r.text[:120]
    except Exception as e:
        return False, str(e)


async def notion_find_database(token: str) -> str | None:
    """Return first database ID in workspace for auto-provisioning."""
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.post(
                "https://api.notion.com/v1/search",
                headers={
                    "Authorization": f"Bearer {token}",
                    "Notion-Version": "2022-06-28",
                    "Content-Type": "application/json",
                },
                json={"filter": {"value": "database", "property": "object"}, "page_size": 1},
            )
            if r.status_code == 200:
                results = r.json().get("results", [])
                if results:
                    return results[0].get("id")
    except Exception:
        pass
    return None


async def verify_meta(token: str, ad_account_id: str = "") -> tuple[bool, str]:
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.get(
                "https://graph.facebook.com/v19.0/me/adaccounts",
                params={"access_token": token, "fields": "name,account_id", "limit": 5},
            )
            if r.status_code == 200:
                accounts = r.json().get("data", [])
                return True, f"Connected — {len(accounts)} Meta ad account(s) found"
            err = r.json().get("error", {}).get("message", r.text[:80])
            return False, f"Meta error: {err}"
    except Exception as e:
        return False, str(e)


async def meta_ad_account_name(token: str, ad_account_id: str) -> str | None:
    if not ad_account_id:
        return None
    acct = ad_account_id if ad_account_id.startswith("act_") else f"act_{ad_account_id}"
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.get(
                f"https://graph.facebook.com/v19.0/{acct}",
                params={"access_token": token, "fields": "name,account_status"},
            )
            if r.status_code == 200:
                return r.json().get("name")
    except Exception:
        pass
    return None


async def meta_first_ad_account(token: str) -> str | None:
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.get(
                "https://graph.facebook.com/v19.0/me/adaccounts",
                params={"access_token": token, "fields": "account_id", "limit": 1},
            )
            if r.status_code == 200:
                data = r.json().get("data", [])
                if data:
                    aid = data[0].get("account_id", "")
                    return f"act_{aid}" if aid and not str(aid).startswith("act_") else aid
    except Exception:
        pass
    return None


async def meta_account_insights(token: str, ad_account_id: str) -> tuple[bool, str, dict]:
    acct = ad_account_id if ad_account_id.startswith("act_") else f"act_{ad_account_id}"
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            r = await client.get(
                f"https://graph.facebook.com/v19.0/{acct}/insights",
                params={
                    "access_token": token,
                    "fields": "spend,impressions,clicks,reach",
                    "date_preset": "last_30d",
                },
            )
            if r.status_code != 200:
                err = r.json().get("error", {}).get("message", r.text[:100])
                return False, f"Meta insights error: {err}", {}
            rows = r.json().get("data", [])
            if not rows:
                return True, f"Meta Ads account connected — no spend in last 30 days", {}
            row = rows[0]
            spend = float(row.get("spend", 0) or 0)
            imps = int(row.get("impressions", 0) or 0)
            clicks = int(row.get("clicks", 0) or 0)
            return (
                True,
                f"Meta Ads (30d): ${spend:.2f} spend, {imps:,} impressions, {clicks:,} clicks",
                {"spend": spend, "impressions": imps, "clicks": clicks},
            )
    except Exception as e:
        return False, str(e), {}


async def verify_linkedin(token: str) -> tuple[bool, str]:
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.get(
                "https://api.linkedin.com/v2/userinfo",
                headers={"Authorization": f"Bearer {token}"},
            )
            if r.status_code == 200:
                name = r.json().get("name", "LinkedIn account")
                return True, f"Connected — {name}"
            return False, f"LinkedIn error {r.status_code}"
    except Exception as e:
        return False, str(e)


async def linkedin_profile_snapshot(token: str) -> tuple[bool, str, dict]:
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.get(
                "https://api.linkedin.com/v2/userinfo",
                headers={"Authorization": f"Bearer {token}"},
            )
            if r.status_code != 200:
                return False, f"LinkedIn API error {r.status_code}", {}
            data = r.json()
            name = data.get("name", "LinkedIn user")
            return True, f"LinkedIn profile: {name}", {"sub": data.get("sub"), "name": name}
    except Exception as e:
        return False, str(e), {}


async def linkedin_share_update(token: str, text: str, author_urn: str = "") -> tuple[bool, str]:
    """Post a text update — requires w_member_social scope on the token."""
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            if not author_urn:
                info = await client.get(
                    "https://api.linkedin.com/v2/userinfo",
                    headers={"Authorization": f"Bearer {token}"},
                )
                if info.status_code != 200:
                    return False, "LinkedIn token invalid for posting"
                sub = info.json().get("sub", "")
                author_urn = f"urn:li:person:{sub}" if sub and not sub.startswith("urn:") else sub
            r = await client.post(
                "https://api.linkedin.com/v2/ugcPosts",
                headers={
                    "Authorization": f"Bearer {token}",
                    "Content-Type": "application/json",
                    "X-Restli-Protocol-Version": "2.0.0",
                },
                json={
                    "author": author_urn,
                    "lifecycleState": "PUBLISHED",
                    "specificContent": {
                        "com.linkedin.ugc.ShareContent": {
                            "shareCommentary": {"text": text[:3000]},
                            "shareMediaCategory": "NONE",
                        }
                    },
                    "visibility": {"com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC"},
                },
            )
            if r.status_code in (200, 201):
                return True, "LinkedIn post published"
            err = r.text[:150]
            return False, f"LinkedIn post failed (need w_member_social scope): {err}"
    except Exception as e:
        return False, str(e)


async def verify_quickbooks(access_token: str, realm_id: str) -> tuple[bool, str]:
    if not realm_id:
        return False, "QuickBooks Realm ID required"
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.get(
                f"https://quickbooks.api.intuit.com/v3/company/{realm_id}/companyinfo/{realm_id}",
                headers={"Authorization": f"Bearer {access_token}", "Accept": "application/json"},
            )
            if r.status_code == 200:
                name = r.json().get("CompanyInfo", {}).get("CompanyName", "company")
                return True, f"Connected — QuickBooks: {name}"
            return False, f"QuickBooks error {r.status_code}"
    except Exception as e:
        return False, str(e)


async def quickbooks_company_name(access_token: str, realm_id: str) -> str | None:
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.get(
                f"https://quickbooks.api.intuit.com/v3/company/{realm_id}/companyinfo/{realm_id}",
                headers={"Authorization": f"Bearer {access_token}", "Accept": "application/json"},
            )
            if r.status_code == 200:
                return r.json().get("CompanyInfo", {}).get("CompanyName")
    except Exception:
        pass
    return None


async def quickbooks_finance_snapshot(access_token: str, realm_id: str) -> tuple[bool, str, dict]:
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            r = await client.get(
                f"https://quickbooks.api.intuit.com/v3/company/{realm_id}/reports/ProfitAndLoss",
                headers={"Authorization": f"Bearer {access_token}", "Accept": "application/json"},
                params={"date_macro": "This Month"},
            )
            if r.status_code != 200:
                return False, f"QuickBooks report error {r.status_code}", {}
            report = r.json().get("Rows", {}).get("Row", [])
            income = "N/A"
            for section in report:
                if section.get("group") == "Income":
                    summary = section.get("Summary", {}).get("ColData", [])
                    if len(summary) > 1:
                        income = summary[1].get("value", "N/A")
            return True, f"QuickBooks P&L (this month): Income {income}", {"income": income}
    except Exception as e:
        return False, str(e), {}


async def verify_mcp(url: str) -> tuple[bool, str]:
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.post(
                url,
                json={"jsonrpc": "2.0", "method": "ping", "id": 1},
            )
            if r.status_code < 500:
                return True, "MCP endpoint reachable"
            return False, f"MCP error {r.status_code}"
    except Exception as e:
        return False, str(e)


def parse_config(config_json: str) -> dict:
    try:
        return json.loads(config_json or "{}")
    except json.JSONDecodeError:
        return {}
