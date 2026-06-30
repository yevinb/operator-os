import json
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
