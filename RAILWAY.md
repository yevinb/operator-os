# Connect Railway to GitHub Pages

Your backend is on Railway. The frontend needs its **public URL**.

## 1. Copy your Railway URL

In Railway dashboard:

1. Open your **Nexa** service
2. **Settings** → **Networking** → **Public Networking**
3. Copy the domain (example: `https://operator-os-xxxx.up.railway.app`)

Test: `https://operator-os-production-2a8a.up.railway.app/api/v1/health`

## 2. Paste the URL (pick one)

### Option A — GitHub Secret (recommended)

1. GitHub repo → **Settings** → **Secrets and variables** → **Actions**
2. **New repository secret**: `RAILWAY_API_URL`
3. Value: `https://your-app.up.railway.app` (no trailing slash)
4. Re-run the **Deploy to GitHub Pages** workflow

### Option B — Edit config file

Edit `frontend/public/api-config.json`:

```json
{
  "apiUrl": "https://your-app.up.railway.app"
}
```

Commit and push.

## 3. Railway environment variables

| Variable | Value |
|----------|--------|
| `JWT_SECRET` | long random string |
| `DATABASE_URL` | **Add Railway Postgres** — keeps accounts & Gmail connections after deploys |
| `CORS_ORIGINS` | `["https://yevinb.github.io"]` |
| `GOOGLE_CLIENT_ID` | from Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | from Google Cloud Console |
| `GOOGLE_REDIRECT_URI` | `https://your-app.up.railway.app/api/v1/oauth/google/callback` |
| `SHOPIFY_API_KEY` | Shopify app API key (Custom app → Client ID) |
| `SHOPIFY_API_SECRET` | Shopify app API secret |
| `SHOPIFY_REDIRECT_URI` | `https://your-app.up.railway.app/api/v1/oauth/shopify/callback` |
| `INTUIT_CLIENT_ID` | QuickBooks / Intuit app Client ID |
| `INTUIT_CLIENT_SECRET` | Intuit Client Secret |
| `QUICKBOOKS_REDIRECT_URI` | `https://your-app.up.railway.app/api/v1/oauth/quickbooks/callback` |
| `FRONTEND_URL` | `https://yevinb.github.io/operator-os` |
| `GROQ_API_KEY` | Groq API key (AI brain) |
| `AI_PROVIDER` | `groq` or `auto` |
| `NEXA_CONTROL_KEY` | long random secret — Cursor/MCP agent auth |
| `NEXA_CONTROL_EMAIL` | your Nexa login email (e.g. `yevinbollegala@gmail.com`) |
| `OPENAI_API_KEY` | optional |

## Cursor controls Nexa

See `CURSOR_CONTROL.md`. Set `NEXA_CONTROL_KEY` + `NEXA_CONTROL_EMAIL` on Railway, then enable MCP in Cursor (`.cursor/mcp.json`).

**Persistent accounts:** Without `DATABASE_URL`, SQLite is stored in `/app/data` (better than `/tmp`, but Postgres is recommended).

**Add Postgres on Railway:** Project → **+ New** → **Database** → **PostgreSQL** → link to your Nexa service (Railway sets `DATABASE_URL` automatically).

**Root directory:** `backend`

## 4. Verify

1. https://yevinb.github.io/operator-os/ — hard refresh
2. Sign up / log in
3. Dashboard → **Backend online** in header
4. Run a command — uses Railway + your business profile
