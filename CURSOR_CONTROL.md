# Nexa — Cursor-Controlled Business OS

Nexa is your autonomous AI Chief Operating Officer. **Cursor controls Nexa** via MCP tools and the Control API.

## Quick setup (one time)

### 1. Railway variables

```
NEXA_CONTROL_KEY=<generate a long random secret>
NEXA_CONTROL_EMAIL=yevinbollegala@gmail.com
GROQ_API_KEY=gsk_...
```

Generate key: `python3 -c "import secrets; print(secrets.token_urlsafe(32))"`

### 2. Cursor MCP

Copy `.cursor/mcp.json` env values or set in Cursor Settings → MCP:

```
NEXA_API_URL=https://operator-os-production-2a8a.up.railway.app
NEXA_CONTROL_KEY=<same as Railway>
NEXA_CONTROL_EMAIL=<your Nexa login email>
```

Install MCP deps once:

```bash
pip install -r nexa-mcp/requirements.txt
```

Restart Cursor. You should see **nexa-business** MCP tools.

### 3. Tell Cursor

> "Run nexa_status, then nexa_autopilot growth"

## What Cursor can control

- **Gmail** — send intelligent emails
- **Stripe** — revenue, customers
- **Slack / n8n** — notifications, workflows
- **HubSpot / Notion** — CRM, docs
- **Meta / Google Ads** — ad metrics
- **Calendar** — book meetings
- **LinkedIn / QuickBooks** — HR, finance
- **Autopilot** — full business cycles unattended

## CLI (terminal from Cursor)

```bash
export NEXA_CONTROL_KEY=...
export NEXA_CONTROL_EMAIL=...
python3 scripts/nexa-cli.py status
python3 scripts/nexa-cli.py run "Check Stripe and post to Slack"
python3 scripts/nexa-cli.py autopilot growth
```

## Live URLs

- App: https://yevinb.github.io/operator-os/
- API: https://operator-os-production-2a8a.up.railway.app
- Docs: https://operator-os-production-2a8a.up.railway.app/docs
