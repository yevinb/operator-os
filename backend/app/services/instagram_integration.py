"""Instagram Graph API — full access: insights, publish posts, comments, DMs via Page token."""

from __future__ import annotations

import re

import httpx

GRAPH = "https://graph.facebook.com/v19.0"

REQUIRED_SCOPES = (
    "instagram_basic",
    "instagram_content_publish",
    "instagram_manage_comments",
    "pages_read_engagement",
    "pages_show_list",
)


async def instagram_discover_account(token: str) -> tuple[str, str, dict]:
    """Returns (account_id, username, page bundle)."""
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.get(
                f"{GRAPH}/me/accounts",
                params={
                    "access_token": token,
                    "fields": "id,name,access_token,instagram_business_account{id,username,followers_count,media_count}",
                    "limit": 25,
                },
            )
            if r.status_code != 200:
                return "", "", {}
            for page in r.json().get("data", []):
                ig = page.get("instagram_business_account")
                if ig and ig.get("id"):
                    bundle = {
                        **ig,
                        "page_id": page.get("id"),
                        "page_name": page.get("name"),
                        "page_access_token": page.get("access_token", token),
                    }
                    return str(ig["id"]), str(ig.get("username", "")), bundle
    except Exception:
        pass
    return "", "", {}


async def instagram_resolve(
    token: str,
    account_id: str = "",
    page_id: str = "",
) -> dict | None:
    ig_id = account_id.strip()
    username = ""
    page_token = token
    resolved_page_id = page_id.strip()

    if ig_id and not resolved_page_id:
        _, _, bundle = await instagram_discover_account(token)
        if bundle.get("id") == ig_id or str(bundle.get("id")) == ig_id:
            return {
                "ig_id": ig_id,
                "username": bundle.get("username", ""),
                "page_id": bundle.get("page_id", ""),
                "page_token": bundle.get("page_access_token", token),
            }

    if not ig_id:
        ig_id, username, bundle = await instagram_discover_account(token)
        if not ig_id:
            return None
        return {
            "ig_id": ig_id,
            "username": username or bundle.get("username", ""),
            "page_id": bundle.get("page_id", ""),
            "page_token": bundle.get("page_access_token", token),
        }

    if resolved_page_id:
        try:
            async with httpx.AsyncClient(timeout=15) as client:
                r = await client.get(
                    f"{GRAPH}/{resolved_page_id}",
                    params={
                        "access_token": token,
                        "fields": "access_token,instagram_business_account{id,username}",
                    },
                )
                if r.status_code == 200:
                    data = r.json()
                    page_token = data.get("access_token", token)
                    ig = data.get("instagram_business_account", {})
                    if ig:
                        return {
                            "ig_id": str(ig.get("id", ig_id)),
                            "username": ig.get("username", ""),
                            "page_id": resolved_page_id,
                            "page_token": page_token,
                        }
        except Exception:
            pass

    return {"ig_id": ig_id, "username": username, "page_id": resolved_page_id, "page_token": page_token}


async def instagram_token_scopes(token: str) -> list[str]:
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.get(
                f"{GRAPH}/debug_token",
                params={"input_token": token, "access_token": token},
            )
            if r.status_code != 200:
                return []
            return r.json().get("data", {}).get("scopes", []) or []
    except Exception:
        return []


async def verify_instagram(token: str, account_id: str = "") -> tuple[bool, str]:
    if not token:
        return False, "Meta access token required"
    ctx = await instagram_resolve(token, account_id)
    if not ctx:
        return (
            False,
            "No Instagram Business account — link IG to a Facebook Page and grant instagram_basic + instagram_content_publish",
        )
    ig_id = ctx["ig_id"]
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.get(
                f"{GRAPH}/{ig_id}",
                params={
                    "access_token": ctx["page_token"],
                    "fields": "username,followers_count,media_count",
                },
            )
            if r.status_code != 200:
                err = r.json().get("error", {}).get("message", r.text[:100])
                return False, f"Instagram API error: {err}"
            data = r.json()
            user = data.get("username", ctx.get("username") or ig_id)
            followers = data.get("followers_count", 0)
            media = data.get("media_count", 0)
            scopes = await instagram_token_scopes(token)
            publish_ok = "instagram_content_publish" in scopes
            publish_note = " · Can publish posts" if publish_ok else " · Add instagram_content_publish to post"
            return True, f"Connected — @{user} ({followers:,} followers, {media} posts){publish_note}"
    except Exception as e:
        return False, str(e)


async def instagram_snapshot(token: str, account_id: str = "") -> dict | None:
    ctx = await instagram_resolve(token, account_id)
    if not ctx:
        return None
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.get(
                f"{GRAPH}/{ctx['ig_id']}",
                params={
                    "access_token": ctx["page_token"],
                    "fields": "username,followers_count,media_count",
                },
            )
            if r.status_code != 200:
                return None
            data = r.json()
            return {
                "instagram_username": data.get("username", ""),
                "instagram_followers": data.get("followers_count", 0),
                "instagram_posts": data.get("media_count", 0),
                "instagram_account_id": ctx["ig_id"],
            }
    except Exception:
        return None


async def instagram_media_insights(token: str, account_id: str = "") -> tuple[bool, str, dict]:
    ctx = await instagram_resolve(token, account_id)
    if not ctx:
        return False, "Instagram Business account not found", {}
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            profile = await client.get(
                f"{GRAPH}/{ctx['ig_id']}",
                params={"access_token": ctx["page_token"], "fields": "username,followers_count,media_count"},
            )
            if profile.status_code != 200:
                return False, "Instagram profile error", {}
            pdata = profile.json()
            username = pdata.get("username", "")
            followers = pdata.get("followers_count", 0)

            media_r = await client.get(
                f"{GRAPH}/{ctx['ig_id']}/media",
                params={
                    "access_token": ctx["page_token"],
                    "fields": "id,caption,like_count,comments_count,timestamp,media_type",
                    "limit": 10,
                },
            )
            likes = comments = posts = 0
            latest_caption = ""
            if media_r.status_code == 200:
                items = media_r.json().get("data", [])
                for m in items:
                    posts += 1
                    likes += int(m.get("like_count", 0) or 0)
                    comments += int(m.get("comments_count", 0) or 0)
                    if not latest_caption and m.get("caption"):
                        latest_caption = str(m["caption"])[:80]

            msg = f"Instagram @{username}: {followers:,} followers, {posts} recent posts"
            if posts:
                msg += f" — {likes:,} likes, {comments:,} comments"
            return (
                True,
                msg,
                {
                    "username": username,
                    "followers": followers,
                    "recent_likes": likes,
                    "recent_comments": comments,
                    "latest_caption": latest_caption,
                },
            )
    except Exception as e:
        return False, str(e), {}


async def instagram_publish_post(
    token: str,
    caption: str,
    image_url: str,
    account_id: str = "",
    page_id: str = "",
) -> tuple[bool, str, dict]:
    ctx = await instagram_resolve(token, account_id, page_id)
    if not ctx:
        return False, "Instagram account not resolved", {}
    if not image_url:
        return False, "Image URL required — add default_image_url in Integrations or include a public image link", {}
    caption = (caption or "Update from Nexa")[:2200]
    page_token = ctx["page_token"]
    ig_id = ctx["ig_id"]
    try:
        async with httpx.AsyncClient(timeout=45) as client:
            create_r = await client.post(
                f"{GRAPH}/{ig_id}/media",
                params={
                    "access_token": page_token,
                    "image_url": image_url,
                    "caption": caption,
                },
            )
            if create_r.status_code != 200:
                err = create_r.json().get("error", {}).get("message", create_r.text[:120])
                return False, f"Instagram create media failed: {err}", {}
            creation_id = create_r.json().get("id")
            if not creation_id:
                return False, "No creation ID from Instagram", {}

            publish_r = await client.post(
                f"{GRAPH}/{ig_id}/media_publish",
                params={"access_token": page_token, "creation_id": creation_id},
            )
            if publish_r.status_code != 200:
                err = publish_r.json().get("error", {}).get("message", publish_r.text[:120])
                return False, f"Instagram publish failed: {err}", {}
            media_id = publish_r.json().get("id", "")
            user = ctx.get("username", "account")
            return (
                True,
                f"Instagram post published on @{user} (media ID {media_id})",
                {"media_id": media_id, "username": user, "caption": caption[:100]},
            )
    except Exception as e:
        return False, str(e), {}


async def instagram_reply_latest_comment(
    token: str,
    reply_text: str,
    account_id: str = "",
) -> tuple[bool, str, dict]:
    ctx = await instagram_resolve(token, account_id)
    if not ctx:
        return False, "Instagram account not found", {}
    reply_text = (reply_text or "Thanks for your comment!")[:500]
    try:
        async with httpx.AsyncClient(timeout=25) as client:
            media_r = await client.get(
                f"{GRAPH}/{ctx['ig_id']}/media",
                params={
                    "access_token": ctx["page_token"],
                    "fields": "id,comments{id,text,username}",
                    "limit": 3,
                },
            )
            if media_r.status_code != 200:
                return False, media_r.text[:120], {}
            comment_id = None
            for media in media_r.json().get("data", []):
                comments = media.get("comments", {}).get("data", [])
                if comments:
                    comment_id = comments[0]["id"]
                    break
            if not comment_id:
                return True, "Instagram: no recent comments to reply to", {"replied": False}

            reply_r = await client.post(
                f"{GRAPH}/{comment_id}/replies",
                params={"access_token": ctx["page_token"], "message": reply_text},
            )
            if reply_r.status_code != 200:
                err = reply_r.json().get("error", {}).get("message", reply_r.text[:120])
                return False, f"Comment reply failed: {err}", {}
            return True, f"Replied on Instagram: {reply_text[:60]}", {"comment_id": comment_id}
    except Exception as e:
        return False, str(e), {}


def _extract_url(text: str) -> str:
    m = re.search(r"https?://[^\s<>\"']+", text or "")
    return m.group(0).rstrip(".,)") if m else ""


async def instagram_execute_action(
    token: str,
    action: str,
    command: str,
    company: str,
    config: dict | None = None,
) -> tuple[bool, str, dict]:
    """Route Instagram read/write from task text."""
    cfg = config or {}
    account_id = cfg.get("instagram_account_id", "")
    page_id = cfg.get("page_id", "")
    default_image = cfg.get("default_image_url", "")
    lower = f"{action} {command}".lower()

    if any(k in lower for k in ("post", "publish", "share on instagram", "share on ig", "upload")):
        caption = command if len(command) > 20 else f"{company}: {action}"
        if caption.lower().startswith("post "):
            caption = caption[5:].strip()
        image_url = _extract_url(command) or _extract_url(action) or default_image
        return await instagram_publish_post(token, caption, image_url, account_id, page_id)

    if any(k in lower for k in ("reply", "comment", "respond")):
        reply = command if "reply" in lower or "comment" in lower else action
        reply = re.sub(r"(?i)reply to comment|reply on instagram|respond to", "", reply).strip()
        if len(reply) < 3:
            reply = f"Thanks for connecting with {company}!"
        return await instagram_reply_latest_comment(token, reply, account_id)

    return await instagram_media_insights(token, account_id)
