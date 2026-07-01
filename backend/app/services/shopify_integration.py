"""Shopify Admin API — full read/write: orders, products, customers, inventory, fulfillments."""

from __future__ import annotations

import re

import httpx

API_VERSION = "2024-01"

FULL_SCOPES = (
    "read_orders",
    "write_orders",
    "read_products",
    "write_products",
    "read_customers",
    "write_customers",
    "read_inventory",
    "write_inventory",
)


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


def _base(domain: str, path: str) -> str:
    return f"https://{domain}/admin/api/{API_VERSION}/{path.lstrip('/')}"


async def shopify_access_scopes(shop: str, access_token: str) -> list[str]:
    domain = normalize_shop_domain(shop)
    if not domain or not access_token:
        return []
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.get(_base(domain, "oauth/access_scopes.json"), headers=_headers(access_token))
            if r.status_code != 200:
                return []
            return [s.get("handle", "") for s in r.json().get("access_scopes", []) if s.get("handle")]
    except Exception:
        return []


async def verify_shopify(shop: str, access_token: str) -> tuple[bool, str]:
    domain = normalize_shop_domain(shop)
    if not domain:
        return False, "Shop domain required (e.g. my-store.myshopify.com)"
    if not access_token.startswith("shpat_"):
        return False, "Use a Shopify Admin API access token (shpat_...)"
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.get(_base(domain, "shop.json"), headers=_headers(access_token))
            if r.status_code != 200:
                return False, f"Shopify error {r.status_code}: {r.text[:120]}"
            name = r.json().get("shop", {}).get("name", domain)
            scopes = await shopify_access_scopes(shop, access_token)
            scope_note = ""
            if scopes:
                missing = [s for s in FULL_SCOPES if s not in scopes]
                if missing:
                    scope_note = f" · Grant scopes: {', '.join(missing[:4])}{'…' if len(missing) > 4 else ''}"
                else:
                    scope_note = " · Full access scopes granted"
            return True, f"Connected — Shopify: {name}{scope_note}"
    except Exception as e:
        return False, str(e)


async def fetch_shopify_snapshot(shop: str, access_token: str) -> dict[str, str | float | int] | None:
    domain = normalize_shop_domain(shop)
    if not domain or not access_token:
        return None
    try:
        async with httpx.AsyncClient(timeout=25) as client:
            shop_r = await client.get(_base(domain, "shop.json"), headers=_headers(access_token))
            if shop_r.status_code != 200:
                return {"shopify_status": "error", "shopify_message": f"HTTP {shop_r.status_code}"}

            shop_name = shop_r.json().get("shop", {}).get("name", domain)

            async def _count(resource: str) -> int:
                cr = await client.get(
                    _base(domain, f"{resource}/count.json"),
                    headers=_headers(access_token),
                    params={"status": "any"} if resource == "orders" else {},
                )
                return int(cr.json().get("count", 0)) if cr.status_code == 200 else 0

            order_count = await _count("orders")
            product_count = await _count("products")
            customer_count = await _count("customers")

            orders_r = await client.get(
                _base(domain, "orders.json"),
                headers=_headers(access_token),
                params={"status": "any", "limit": 50, "fields": "id,total_price,financial_status,fulfillment_status"},
            )
            revenue = 0.0
            pending = 0
            if orders_r.status_code == 200:
                for o in orders_r.json().get("orders", []):
                    if o.get("financial_status") in ("paid", "partially_paid", "partially_refunded"):
                        try:
                            revenue += float(o.get("total_price", 0) or 0)
                        except (TypeError, ValueError):
                            pass
                    if o.get("fulfillment_status") in (None, "unfulfilled", "partial"):
                        pending += 1

            return {
                "shopify_store": shop_name,
                "shopify_orders": order_count,
                "shopify_revenue_usd": round(revenue, 2),
                "shopify_products": product_count,
                "shopify_customers": customer_count,
                "shopify_pending_fulfillment": pending,
            }
    except Exception:
        return None


async def shopify_create_product(
    shop: str,
    access_token: str,
    title: str,
    body: str = "",
) -> tuple[bool, str, dict]:
    domain = normalize_shop_domain(shop)
    title = (title or "New product")[:255]
    body = (body or title)[:5000]
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            r = await client.post(
                _base(domain, "products.json"),
                headers=_headers(access_token),
                json={
                    "product": {
                        "title": title,
                        "body_html": f"<p>{body}</p>",
                        "status": "active",
                        "variants": [{"price": "0.00", "inventory_management": "shopify"}],
                    }
                },
            )
            if r.status_code not in (200, 201):
                return False, r.text[:150], {}
            product = r.json().get("product", {})
            return (
                True,
                f"Shopify product created: {product.get('title', title)} (ID {product.get('id')})",
                {"product_id": product.get("id"), "title": product.get("title")},
            )
    except Exception as e:
        return False, str(e), {}


async def shopify_create_customer(
    shop: str,
    access_token: str,
    email: str,
    first_name: str = "",
    last_name: str = "",
) -> tuple[bool, str, dict]:
    domain = normalize_shop_domain(shop)
    if not email:
        return False, "Customer email required", {}
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            r = await client.post(
                _base(domain, "customers.json"),
                headers=_headers(access_token),
                json={
                    "customer": {
                        "email": email,
                        "first_name": first_name or "Customer",
                        "last_name": last_name or "",
                        "send_email_invite": False,
                    }
                },
            )
            if r.status_code not in (200, 201):
                return False, r.text[:150], {}
            cust = r.json().get("customer", {})
            return (
                True,
                f"Shopify customer created: {cust.get('email')} (ID {cust.get('id')})",
                {"customer_id": cust.get("id"), "email": cust.get("email")},
            )
    except Exception as e:
        return False, str(e), {}


async def shopify_fulfill_latest_order(shop: str, access_token: str) -> tuple[bool, str, dict]:
    domain = normalize_shop_domain(shop)
    try:
        async with httpx.AsyncClient(timeout=25) as client:
            orders_r = await client.get(
                _base(domain, "orders.json"),
                headers=_headers(access_token),
                params={
                    "status": "open",
                    "fulfillment_status": "unfulfilled",
                    "limit": 1,
                    "order": "created_at asc",
                },
            )
            if orders_r.status_code != 200:
                return False, orders_r.text[:120], {}
            orders = orders_r.json().get("orders", [])
            if not orders:
                return True, "Shopify: no unfulfilled orders to fulfill", {"fulfilled": 0}

            order = orders[0]
            order_id = order["id"]
            fo_r = await client.get(
                _base(domain, f"orders/{order_id}/fulfillment_orders.json"),
                headers=_headers(access_token),
            )
            if fo_r.status_code != 200:
                return False, fo_r.text[:120], {}
            fulfillment_orders = fo_r.json().get("fulfillment_orders", [])
            if not fulfillment_orders:
                return False, "No fulfillment orders found for latest open order", {}

            line_items = []
            for fo in fulfillment_orders:
                if fo.get("status") in ("open", "in_progress"):
                    line_items.append(
                        {
                            "fulfillment_order_id": fo["id"],
                            "fulfillment_order_line_items": [
                                {"id": li["id"], "quantity": li["quantity"]}
                                for li in fo.get("line_items", [])
                            ],
                        }
                    )
            if not line_items:
                return False, "No open fulfillment line items", {}

            fulfill_r = await client.post(
                _base(domain, "fulfillments.json"),
                headers=_headers(access_token),
                json={
                    "fulfillment": {
                        "line_items_by_fulfillment_order": line_items,
                        "notify_customer": True,
                    }
                },
            )
            if fulfill_r.status_code not in (200, 201):
                return False, fulfill_r.text[:150], {}
            name = order.get("name", f"#{order_id}")
            return (
                True,
                f"Shopify order {name} fulfilled and customer notified",
                {"order_id": order_id, "order_name": name},
            )
    except Exception as e:
        return False, str(e), {}


async def shopify_update_inventory(
    shop: str,
    access_token: str,
    quantity: int = 10,
) -> tuple[bool, str, dict]:
    """Set inventory on the first product variant."""
    domain = normalize_shop_domain(shop)
    try:
        async with httpx.AsyncClient(timeout=25) as client:
            pr = await client.get(
                _base(domain, "products.json"),
                headers=_headers(access_token),
                params={"limit": 1, "fields": "id,title,variants"},
            )
            if pr.status_code != 200:
                return False, pr.text[:120], {}
            products = pr.json().get("products", [])
            if not products:
                return False, "No products in store — create a product first", {}
            product = products[0]
            variants = product.get("variants", [])
            if not variants:
                return False, "Product has no variants", {}
            variant = variants[0]
            inv_item_id = variant.get("inventory_item_id")
            if not inv_item_id:
                return False, "Variant has no inventory item", {}

            levels_r = await client.get(
                _base(domain, "inventory_levels.json"),
                headers=_headers(access_token),
                params={"inventory_item_ids": inv_item_id},
            )
            if levels_r.status_code != 200:
                return False, levels_r.text[:120], {}
            levels = levels_r.json().get("inventory_levels", [])
            if not levels:
                return False, "No inventory location found", {}
            location_id = levels[0]["location_id"]

            set_r = await client.post(
                _base(domain, "inventory_levels/set.json"),
                headers=_headers(access_token),
                json={
                    "location_id": location_id,
                    "inventory_item_id": inv_item_id,
                    "available": quantity,
                },
            )
            if set_r.status_code not in (200, 201):
                return False, set_r.text[:150], {}
            return (
                True,
                f"Shopify inventory set to {quantity} for {product.get('title', 'product')}",
                {"product_id": product.get("id"), "quantity": quantity},
            )
    except Exception as e:
        return False, str(e), {}


def _extract_email(text: str) -> str:
    m = re.search(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}", text or "")
    return m.group(0) if m else ""


async def shopify_execute_action(
    shop: str,
    access_token: str,
    action: str,
    command: str,
    company: str,
) -> tuple[bool, str, dict]:
    """Route write/read Shopify actions from natural language."""
    lower = f"{action} {command}".lower()
    if any(k in lower for k in ("create product", "add product", "new product", "launch product")):
        title = action.replace("create", "").replace("product", "").strip() or f"{company} offer"
        if len(title) < 4:
            title = command[:80] or f"{company} product"
        return await shopify_create_product(shop, access_token, title, command[:500])

    if any(k in lower for k in ("create customer", "add customer", "new customer")):
        email = _extract_email(command) or _extract_email(action)
        if not email:
            return False, "Include customer email in command (e.g. add customer john@email.com)", {}
        return await shopify_create_customer(shop, access_token, email)

    if any(k in lower for k in ("fulfill", "ship", "dispatch")):
        return await shopify_fulfill_latest_order(shop, access_token)

    if any(k in lower for k in ("inventory", "stock", "restock")):
        qty = 10
        m = re.search(r"(\d+)\s*(?:units|items|stock|inventory)", lower)
        if m:
            qty = int(m.group(1))
        return await shopify_update_inventory(shop, access_token, qty)

    snap = await fetch_shopify_snapshot(shop, access_token)
    if not snap or snap.get("shopify_status") == "error":
        return False, "Shopify API error", {}
    return (
        True,
        (
            f"Shopify {snap.get('shopify_store')}: {snap.get('shopify_orders')} orders, "
            f"${snap.get('shopify_revenue_usd')} revenue, {snap.get('shopify_products')} products, "
            f"{snap.get('shopify_customers')} customers, {snap.get('shopify_pending_fulfillment')} pending fulfillment"
        ),
        {"source": "shopify_snapshot", **snap},
    )
