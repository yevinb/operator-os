"""Instagram Graph API — business profile insights (via Meta token)."""

import httpx

GRAPH = "https://graph.facebook.com/v19.0"


async def instagram_discover_account(token: str) -> tuple[str, str, dict]:
    """Returns (account_id, username, fields dict)."""
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.get(
                f"{GRAPH}/me/accounts",
                params={
                    "access_token": token,
                    "fields": "instagram_business_account{id,username,followers_count,media_count}",
                    "limit": 25,
                },
            )
            if r.status_code != 200:
                return "", "", {}
            for page in r.json().get("data", []):
                ig = page.get("instagram_business_account")
                if ig and ig.get("id"):
                    return (
                        str(ig["id"]),
                        str(ig.get("username", "")),
                        ig,
                    )
    except Exception:
        pass
    return "", "", {}


async def verify_instagram(token: str, account_id: str = "") -> tuple[bool, str]:
    if not token:
        return False, "Meta access token required"
    ig_id = account_id.strip()
    username = ""
    if not ig_id:
        ig_id, username, ig = await instagram_discover_account(token)
        if ig_id and not username:
            username = ig.get("username", "")
    if not ig_id:
        return (
            False,
            "No Instagram Business account found — link IG to a Facebook Page and grant instagram_basic permission",
        )
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.get(
                f"{GRAPH}/{ig_id}",
                params={
                    "access_token": token,
                    "fields": "username,followers_count,media_count",
                },
            )
            if r.status_code != 200:
                err = r.json().get("error", {}).get("message", r.text[:100])
                return False, f"Instagram API error: {err}"
            data = r.json()
            user = data.get("username", username or ig_id)
            followers = data.get("followers_count", 0)
            media = data.get("media_count", 0)
            return True, f"Connected — @{user} ({followers:,} followers, {media} posts)"
    except Exception as e:
        return False, str(e)


async def instagram_snapshot(token: str, account_id: str = "") -> dict | None:
    ig_id = account_id.strip()
    if not ig_id:
        ig_id, _, _ = await instagram_discover_account(token)
    if not ig_id:
        return None
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.get(
                f"{GRAPH}/{ig_id}",
                params={
                    "access_token": token,
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
                "instagram_account_id": ig_id,
            }
    except Exception:
        return None


async def instagram_media_insights(token: str, account_id: str = "") -> tuple[bool, str, dict]:
    ig_id = account_id.strip()
    if not ig_id:
        ig_id, _, _ = await instagram_discover_account(token)
    if not ig_id:
        return False, "Instagram Business account not found", {}
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            profile = await client.get(
                f"{GRAPH}/{ig_id}",
                params={"access_token": token, "fields": "username,followers_count,media_count"},
            )
            if profile.status_code != 200:
                return False, "Instagram profile error", {}
            pdata = profile.json()
            username = pdata.get("username", "")
            followers = pdata.get("followers_count", 0)

            media_r = await client.get(
                f"{GRAPH}/{ig_id}/media",
                params={
                    "access_token": token,
                    "fields": "id,caption,like_count,comments_count,timestamp",
                    "limit": 5,
                },
            )
            likes = 0
            comments = 0
            posts = 0
            if media_r.status_code == 200:
                for m in media_r.json().get("data", []):
                    posts += 1
                    likes += int(m.get("like_count", 0) or 0)
                    comments += int(m.get("comments_count", 0) or 0)

            msg = f"Instagram @{username}: {followers:,} followers"
            if posts:
                msg += f", recent {posts} posts — {likes:,} likes, {comments:,} comments"
            return (
                True,
                msg,
                {
                    "username": username,
                    "followers": followers,
                    "recent_likes": likes,
                    "recent_comments": comments,
                },
            )
    except Exception as e:
        return False, str(e), {}
