# OperatorOS

**Your AI Chief Operating Officer.** Say what you need. The AI runs your business.

Not a chatbot. An autonomous employee.

## What it does

You type or speak:
> "Increase sales."

OperatorOS:
- Creates ads
- Launches campaigns
- Replies to customers
- Books meetings
- Writes newsletters
- Tracks conversions
- Improves itself

## Tech stack

| Layer | Stack |
|-------|-------|
| Frontend | Next.js, React, Tailwind |
| Backend | Python, FastAPI |
| AI | GPT, Claude (optional), rule-based fallback |
| Memory | PostgreSQL, Redis (docker-compose ready) |
| Automation | n8n, MCP (Phase 2) |
| Hosting | Vercel (frontend), Railway (backend) |

## Quick start

### 1. Frontend

```bash
cd frontend
cp .env.local.example .env.local
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### 2. Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --port 8000
```

API docs: [http://localhost:8000/docs](http://localhost:8000/docs)

### 3. Database (optional, Phase 2)

```bash
docker compose up -d
```

## AI configuration

Add API keys to `backend/.env` for smarter command parsing:

```
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
AI_PROVIDER=auto
```

Without keys, the rule-based engine handles all commands with realistic action plans.

## Pricing tiers

| Plan | Price | Target |
|------|-------|--------|
| Starter | $99/mo | Solo founders |
| Business | $499/mo | Growing companies |
| Enterprise | $5,000/mo | Scale |

## Roadmap

- **Phase 1** (Week 1): Core app — command center, orchestration, landing
- **Phase 2**: 10,000 paying customers, real integrations (Stripe, Slack, n8n)
- **Phase 3**: Global expansion, KIB/WEYAY payments
- **Phase 4**: Exit

## Project structure

```
operator-os/
├── frontend/          # Next.js app
│   ├── src/app/       # Pages (landing, dashboard)
│   └── src/components/
├── backend/           # FastAPI API
│   └── app/
│       ├── main.py
│       └── services/orchestrator.py
└── docker-compose.yml
```
