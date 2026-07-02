# Shopify connect for Nexa

Nexa already has **Shopify OAuth** in the backend (`/api/v1/oauth/shopify/*`). You do **not** need:

```bash
npm init @shopify/app@latest
```

That CLI command builds a **separate embedded Shopify app** (Remix/React inside Shopify Admin). Nexa is a **standalone SaaS** — merchants connect their store from **Integrations → Connect store**.

---

## One-time setup (you, platform owner)

### 1. Shopify Partners + Dev Dashboard

1. [partners.shopify.com](https://partners.shopify.com/) → **Create partner organization** → focus: **Build apps**
2. **App distribution** → open **Dev Dashboard** (or go to [dev.shopify.com](https://dev.shopify.com))
3. **Apps** → **Create app** → name: **Nexa**

### 2. Redirect URL (in Dev Dashboard)

**Configuration** → **URLs** → **Allowed redirection URL(s)**:

```
https://operator-os-production-2a8a.up.railway.app/api/v1/oauth/shopify/callback
```

Replace the domain if your Railway URL is different.

### 3. API scopes

Nexa requests these scopes on connect (configured in code):

- `read_orders`, `write_orders`
- `read_products`, `write_products`
- `read_customers`, `write_customers`
- `read_inventory`, `write_inventory`

In Dev Dashboard, enable the same Admin API access if Shopify asks during app setup.

### 4. Railway variables

| Variable | Value |
|----------|--------|
| `SHOPIFY_API_KEY` | Dev Dashboard → **Client ID** |
| `SHOPIFY_API_SECRET` | Dev Dashboard → **Client secret** |
| `SHOPIFY_REDIRECT_URI` | `https://operator-os-production-2a8a.up.railway.app/api/v1/oauth/shopify/callback` |

Redeploy Nexa on Railway after saving.

### 5. Verify server is ready

```bash
curl -s https://operator-os-production-2a8a.up.railway.app/api/v1/integrations/oauth-server-status
```

`shopify: true` means Railway keys are set.

---

## Per merchant (your customers worldwide)

1. Log into Nexa → **Integrations** → **Shopify** → **Connect store**
2. Enter `mystore` or `mystore.myshopify.com`
3. Approve on Shopify
4. Brain + Business dashboard pull **live** orders, revenue, customers

Each store owner uses **their** Shopify login. You only maintain **one** Nexa app in Dev Dashboard.

---

## Optional: development store

To test without a real business:

1. Partner Dashboard → **Stores** → **Create a client transfer store** or add a **development store**
2. Connect that store domain in Nexa Integrations

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `Shopify OAuth not configured on server` | Set `SHOPIFY_API_KEY` + `SHOPIFY_API_SECRET` on Railway, redeploy |
| `oauth_failed` after approve | Redirect URL in Dev Dashboard must **exactly** match `SHOPIFY_REDIRECT_URI` |
| `token_exchange_failed` | Client secret wrong, or redirect URI mismatch |
| Connect works but no metrics | Run morning cycle / open Business tab; check store has orders |

---

## Why not Shopify CLI?

| `npm init @shopify/app@latest` | Nexa (current) |
|-------------------------------|----------------|
| Embedded app inside Shopify Admin | Standalone web app at github.io |
| Separate Node/Remix codebase | Python FastAPI OAuth already built |
| Good for App Store listing | Good for multi-tool brain (Stripe + Meta + Shopify) |

Use Dev Dashboard **only** to register the OAuth app and copy Client ID / secret.
