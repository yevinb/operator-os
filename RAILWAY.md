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
| `JWT_SECRET` | long random string — **must stay the same** or everyone gets signed out |
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
| `BRAIN_CRON_SECRET` | optional — secret for scheduled `/api/v1/brain/cron` (24/7 autopilot) |
| `AI_PROVIDER` | `groq` or `auto` |
| `NEXA_CONTROL_KEY` | long random secret — Cursor/MCP agent auth |
| `NEXA_CONTROL_EMAIL` | your Nexa login email (e.g. `yevinbollegala@gmail.com`) |
| `OPENAI_API_KEY` | optional |

## Cursor controls Nexa

See `CURSOR_CONTROL.md`. Set `NEXA_CONTROL_KEY` + `NEXA_CONTROL_EMAIL` on Railway, then enable MCP in Cursor (`.cursor/mcp.json`).

**Stay signed in:** Nexa keeps you signed in on this device (localStorage, up to 365 days). For sessions to survive Railway redeploys, set a stable `JWT_SECRET` and link **Postgres** (`DATABASE_URL`). Without Postgres, redeploys can wipe accounts — sign in with Google again if that happens.

**Add Postgres on Railway:** Project → **+ New** → **Database** → **PostgreSQL** → link to your Nexa service (Railway sets `DATABASE_URL` automatically).

**Root directory:** `backend`

## 5. Google sign-in — let **anyone** in the world log in

Nexa uses **two** Google flows:

| Flow | Scopes | Who can use it |
|------|--------|----------------|
| **Sign in with Google** (login page) | Email + profile only | **Anyone** — once app is **In production** |
| **Connect Gmail** (Integrations page) | Gmail send/read | Needs **Google verification** for public use |

### Step A — Find the right screen in Google Cloud

The menu moved. Use either path:

**New UI:** [Google Cloud Console](https://console.cloud.google.com/) → pick your project → left menu **Google Auth Platform** → **Audience**

**Old UI:** **APIs & Services** → **OAuth consent screen**

On **Audience** you should see:

- **User type:** External  
- **Publishing status:** Testing or In production  

### Step B — Allow everyone (not just test users)

1. Open **Audience** (or OAuth consent screen)  
2. Under **Publishing status**, click **Publish app** → set to **In production**  
3. Fill **Branding**: app name **Nexa**, support email, home page `https://yevinb.github.io/operator-os`  
4. Add **Privacy policy URL** (required): `https://yevinb.github.io/operator-os/privacy`
5. **Save**

With **login-only** scopes (`openid email profile`), Google usually does **not** require full Gmail verification for sign-in. Anyone with a Google account can log in.

### Step C — Gmail for all users (optional, slower)

To let **anyone** connect Gmail (not just test users):

1. **Google Auth Platform** → **Data access** — confirm Gmail scopes are listed  
2. **Verification center** → submit for verification (privacy policy, demo video, how you use Gmail)  
3. Often **1–6 weeks**

Until verified, add emails under **Audience** → **Test users** (max 100) for Gmail connect only.

### Step D — Redirect URIs (**Clients**)

**Google Auth Platform** → **Clients** → your OAuth client → **Authorized redirect URIs**:

```
https://operator-os-production-2a8a.up.railway.app/api/v1/auth/google/callback
https://operator-os-production-2a8a.up.railway.app/api/v1/oauth/google/callback
```

Until verified, add emails under **Audience** → **Test users** for Gmail connect only.

### Homepage “not registered to you” (verification rejected)

Google does **not** use GitHub ownership. It uses **Google Search Console** with the **same Google account** as Cloud Console (`yevin.bollegala@gmail.com`).

1. Open [Google Search Console](https://search.google.com/search-console) — sign in as **yevin.bollegala@gmail.com**
2. **Add property** → **URL prefix** → `https://yevinb.github.io/operator-os/`
3. Verify ownership (pick one):
   - **HTML file:** download `googlexxxxx.html` → put it in `frontend/public/` → commit & deploy → click Verify in Search Console
   - **HTML tag:** add the meta tag Search Console gives you to `frontend/src/app/layout.tsx` in `<head>` → deploy → Verify
4. In **Google Auth Platform** → **Branding** → **Authorized domains** → ensure `github.io` is listed
5. **Application home page:** `https://yevinb.github.io/operator-os/`
6. **Privacy policy:** `https://yevinb.github.io/operator-os/privacy`
7. Homepage must link to privacy policy (Nexa footer does this after latest deploy)
8. Resubmit in **Verification center**

**Important:** Search Console account email must match the Google Cloud developer account.

## 6. Verify

1. https://yevinb.github.io/operator-os/ — hard refresh
2. Sign up / log in
3. Dashboard → **Backend online** in header
4. Run a command — uses Railway + your business profile
