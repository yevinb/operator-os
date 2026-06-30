# Connect Railway to GitHub Pages

Your backend is on Railway. The frontend needs its **public URL**.

## 1. Copy your Railway URL

In Railway dashboard:

1. Open your **OperatorOS** service
2. **Settings** → **Networking** → **Public Networking**
3. Copy the domain (example: `https://operator-os-xxxx.up.railway.app`)

Test: `YOUR_URL/api/v1/health` → should return `{"status":"ok",...}`

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
| `CORS_ORIGINS` | `["https://yevinb.github.io"]` |
| `OPENAI_API_KEY` | optional |

**Root directory:** `backend`

## 4. Verify

1. https://yevinb.github.io/operator-os/ — hard refresh
2. Sign up / log in
3. Dashboard → **Backend online** in header
4. Run a command — uses Railway + your business profile
