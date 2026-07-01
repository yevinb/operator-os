# Nexa — Powered by Cursor

When users chat in Nexa, **Cursor runs everything behind the scenes**.

## How it works

```
User (Nexa app) → Nexa API → Cursor Engine → real tools (Gmail, Stripe, Slack, …)
```

- No terminal. No extra steps for users.
- Every message goes through `cursor_engine.py` — a Cursor-style agent that picks tools and executes live.
- Groq (on Railway) powers the agent loop; integrations do the real work.

## For developers (this repo)

Cursor IDE can also call Nexa via MCP (`nexa-mcp/server.py`) for building and debugging — end users never see this.

Railway env:
- `GROQ_API_KEY` — agent brain
- `NEXA_CONTROL_EMAIL` — default business user
- `NEXA_CONTROL_KEY` — optional agent API auth
