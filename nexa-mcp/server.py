#!/usr/bin/env python3
"""
Nexa MCP Server — Cursor controls your entire business through Nexa.

Setup:
  pip install -r nexa-mcp/requirements.txt
  export NEXA_CONTROL_KEY=your-key
  export NEXA_CONTROL_EMAIL=you@gmail.com  # optional if set on Railway

Add to Cursor: Settings → MCP → or use .cursor/mcp.json in this repo.
"""

from __future__ import annotations

import json
import os

import httpx

try:
    from mcp.server.fastmcp import FastMCP
except ImportError:
    print("Install: pip install mcp httpx", file=__import__("sys").stderr)
    raise

API = os.environ.get("NEXA_API_URL", "https://operator-os-production-2a8a.up.railway.app").rstrip("/")
KEY = os.environ.get("NEXA_CONTROL_KEY", "")
EMAIL = os.environ.get("NEXA_CONTROL_EMAIL", "")

mcp = FastMCP(
    "nexa-business",
    instructions=(
        "You control the user's real business through Nexa. "
        "Always prefer nexa_* tools for email, sales, marketing, finance, and ops. "
        "Run nexa_status first, then nexa_autopilot or nexa_run to execute."
    ),
)


def _headers() -> dict[str, str]:
    h = {"Content-Type": "application/json"}
    if KEY:
        h["X-Nexa-Control-Key"] = KEY
    if EMAIL:
        h["X-Nexa-User-Email"] = EMAIL
    return h


def _post(path: str, body: dict) -> str:
    r = httpx.post(f"{API}{path}", headers=_headers(), json=body, timeout=120)
    try:
        data = r.json()
    except Exception:
        data = {"error": r.text, "status": r.status_code}
    return json.dumps(data, indent=2)


def _get(path: str) -> str:
    r = httpx.get(f"{API}{path}", headers=_headers(), timeout=60)
    try:
        data = r.json()
    except Exception:
        data = {"error": r.text, "status": r.status_code}
    return json.dumps(data, indent=2)


@mcp.tool()
def nexa_status() -> str:
    """Full business snapshot: company, integrations, live metrics, AI provider."""
    return _get("/api/v1/control/status")


@mcp.tool()
def nexa_run(command: str) -> str:
    """Execute any business command across Stripe, Gmail, Slack, HubSpot, ads, etc."""
    return _post("/api/v1/control/run", {"command": command})


@mcp.tool()
def nexa_email(message: str) -> str:
    """Send an intelligent Gmail email. Example: email client@company.com about our agency offer."""
    return _post("/api/v1/control/email", {"message": message})


@mcp.tool()
def nexa_chat(message: str) -> str:
    """Chat with Nexa — auto-executes when the message is an action."""
    return _post("/api/v1/control/chat", {"message": message, "history": []})


@mcp.tool()
def nexa_autopilot(mode: str = "growth") -> str:
    """Run full business autopilot: full | growth | sales | ops."""
    return _post("/api/v1/control/autopilot", {"mode": mode})


@mcp.tool()
def nexa_batch(commands: str) -> str:
    """Run multiple commands separated by newlines."""
    lines = [c.strip() for c in commands.split("\n") if c.strip()]
    return _post("/api/v1/control/batch", {"commands": lines})


@mcp.tool()
def nexa_test_integrations() -> str:
    """Test all connected integrations live."""
    return _post("/api/v1/control/integrations/test-all", {})


if __name__ == "__main__":
    mcp.run()
