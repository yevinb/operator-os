# OperatorOS

**Your AI Chief Operating Officer.** Say what you need. It runs your business.

## Phase 1 — Complete

| Feature | Status |
|---------|--------|
| Landing + pricing | ✅ |
| Sign up / login | ✅ |
| Onboarding wizard | ✅ |
| Command Center | ✅ |
| Text commands (primary) | ✅ |
| Voice assistant | ✅ (fix later) |
| Activity log | ✅ |
| Integrations (12 tools) | ✅ |
| Billing ($99/$499/$5K) | ✅ |
| Settings | ✅ |
| AI orchestration (10+ intents) | ✅ |
| FastAPI backend | ✅ |
| GPT + Claude + Gemini router | ✅ |
| PostgreSQL + Redis (docker) | ✅ ready |

## Quick start

```bash
# Frontend
cd frontend && npm install && npm run dev

# Backend
cd backend && python3.12 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt && uvicorn app.main:app --reload --port 8000

# Database (optional)
docker compose up -d
```

## Live demo

https://yevinb.github.io/operator-os/

1. Click **Start free trial**
2. Create account → onboarding
3. Command Center → type **"Increase sales"** → Execute
4. Watch 7 autonomous actions run

## Revenue model

- Starter: $99/mo
- Business: $499/mo  
- Enterprise: $5,000/mo
- Target: 10,000 × $500 = **$5M/month**

## Roadmap

- **Phase 2**: 10,000 paying customers, real Stripe/Slack/n8n
- **Phase 3**: Global expansion, KIB/WEYAY payments
- **Phase 4**: Exit 🚀

## Stack

Frontend: Next.js, React, Tailwind  
Backend: Python, FastAPI  
AI: GPT, Claude, Gemini  
Memory: PostgreSQL, Redis, Vector DB  
Automation: n8n, MCP, Browser  
Hosting: Vercel, Railway, Cloudflare
