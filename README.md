# Nexa — AI Chief Operating Officer

**Your AI Chief Operating Officer.** Connect your business. Command it. It executes.

## What's built

| Layer | Status |
|-------|--------|
| Business profile (industry, goal, market) | ✅ Saved & used in every command |
| Real auth (JWT + database) | ✅ SQLite local / Postgres production |
| Context-aware AI orchestration | ✅ Rules + GPT/Claude when API keys set |
| Task executor | ✅ Runs against connected integrations |
| Stripe integration | ✅ Live revenue/customer data with API key |
| Integrations framework | ✅ Connect/disconnect + API keys |
| Payments (Stripe links) | ✅ Ready via env vars |
| Frontend + Backend | ✅ Full stack |

## Quick start (full stack)

```bash
# Terminal 1 — Backend
cd backend && chmod +x run.sh && ./run.sh

# Terminal 2 — Frontend
cd frontend && npm install && npm run dev
```

1. Sign up at http://localhost:3000/signup
2. Complete onboarding (company, industry, goal, market)
3. Integrations → Connect **Stripe** with `sk_test_...` key
4. Command Center → **Increase sales** → see tasks with live Stripe data

## Deploy

**Frontend** — GitHub Pages (auto on push to main)

**Backend** — Railway:
```bash
cd backend
# Set env: JWT_SECRET, DATABASE_URL, OPENAI_API_KEY, CORS_ORIGINS
railway up
```

Then set in frontend build:
```
NEXT_PUBLIC_API_URL=https://your-api.railway.app
```

## Revenue model

- Starter: $99/mo
- Business: $499/mo
- Enterprise: $5,000/mo

Set `NEXT_PUBLIC_STRIPE_*_URL` for live checkout.

## Stack

Frontend: Next.js, React, Tailwind  
Backend: FastAPI, SQLAlchemy, JWT  
AI: GPT-4o, Claude (optional)  
Integrations: Stripe (live), Slack/Gmail/Ads (framework)  
DB: SQLite / PostgreSQL
