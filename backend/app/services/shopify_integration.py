"""Shopify Admin API — orders, revenue, products."""

import httpx

API_VERSION = "2024-01"


def normalize_shop_domain(shop: str) -> str:
    shop = (shop or "").strip().lower()
    shop = shop.replace("https://", "").replace("http://", "").rstrip("/")
    if not shop:
        return ""
    if not shop.endswith(".myshopify.com"):
        shop = f"{shop}.myshopify.com"
    return shop


def _headers(token: str) -> dict[str, str]:
    return {"X-Shopify-Access-Token": token, "Content-Type": "application/json"}


async def verify_shopify(shop: str, access_token: str) -> tuple[bool, str]:
    domain = normalize_shop_domain(shop)
    if not domain:
        return False, "Shop domain required (e.g. my-store.myshopify.com)"
    if not access_token.startswith("shpat_"):
        return False, "Use a Shopify Admin API access token (shpat_...)"
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.get(
                f"https://{domain}/admin/api/{API_VERSION}/shop.json",
                headers=_headers(access_token),
            )
            if r.status_code != 200:
                return False, f"Shopify error {r.status_code}: {r.text[:120]}"
            name = r.json().get("shop", {}).get("name", domain)
            return True, f"Connected — Shopify store: {name}"
    except Exception as e:
        return False, str(e)


async def fetch_shopify_snapshot(shop: str, access_token: str) -> dict[str, str | float | int] | None:
    domain = normalize_shop_domain(shop)
    if not domain or not access_token:
        return None
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            shop_r = await client.get(
                f"https://{domain}/admin/api/{API_VERSION}/shop.json",
                headers=_headers(access_token),
            )
            if shop_r.status_code != 200:
                return {"shopify_status": "error", "shopify_message": f"HTTP {shop_r.status_code}"}

            shop_name = shop_r.json().get("shop", {}).get("name", domain)

            count_r = await client.get(
                f"https://{domain}/admin/api/{API_VERSION}/orders/count.json",
                headers=_headers(access_token),
                params={"status": "any"},
            )
            order_count = 0
            if count_r.status_code == 200:
                order_count = int(count_r.json().get("count", 0))

            orders_r = await client.get(
                f"https://{domain}/admin/api/{API_VERSION}/orders.json",
                headers=_headers(access_token),
                params={"status": "any", "limit": 50, "fields": "id,total_price,financial_status"},
            )
            revenue = 0.0
            if orders_r.status_code == 200:
                for o in orders_r.json().get("orders", []):
                    if o.get("financial_status") in ("paid", "partially_paid", "partially_refunded"):
                        try:
                            revenue += float(o.get("total_price", 0) or 0)
                        except (TypeError, ValueError):
                            pass

            products_r = await client.get(
                f"https://{domain}/admin/api/{API_VERSION}/products/count.json",
                headers=_headers(access_token),
            )
            product_count = 0
            if products_r.status_code == 200:
                product_count = int(products_r.json().get("count", 0))

            return {
                "shopify_store": shop_name,
                "shopify_orders": order_count,
                "shopify_revenue_usd": round(revenue, 2),
                "shopify_products": product_count,
            }
    except Exception:
        return None
