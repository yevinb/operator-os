#!/usr/bin/env python3
"""Nexa CLI — control your business from Cursor terminal."""

import argparse
import json
import os
import sys

import httpx

API = os.environ.get("NEXA_API_URL", "https://operator-os-production-2a8a.up.railway.app").rstrip("/")
KEY = os.environ.get("NEXA_CONTROL_KEY", "")
EMAIL = os.environ.get("NEXA_CONTROL_EMAIL", "")


def headers() -> dict:
    h = {"Content-Type": "application/json"}
    if KEY:
        h["X-Nexa-Control-Key"] = KEY
    if EMAIL:
        h["X-Nexa-User-Email"] = EMAIL
    return h


def main() -> None:
    if not KEY:
        print("Set NEXA_CONTROL_KEY (and NEXA_CONTROL_EMAIL)", file=sys.stderr)
        sys.exit(1)

    p = argparse.ArgumentParser(description="Control Nexa from Cursor")
    sub = p.add_subparsers(dest="cmd", required=True)

    sub.add_parser("status", help="Business snapshot")
    r = sub.add_parser("run", help="Run a command")
    r.add_argument("command")
    e = sub.add_parser("email", help="Send email")
    e.add_argument("message")
    c = sub.add_parser("chat", help="Chat with Nexa")
    c.add_argument("message")
    a = sub.add_parser("autopilot", help="Run autopilot")
    a.add_argument("mode", nargs="?", default="growth")
    t = sub.add_parser("test", help="Test integrations")

    args = p.parse_args()
    client = httpx.Client(timeout=120)

    if args.cmd == "status":
        r = client.get(f"{API}/api/v1/control/status", headers=headers())
    elif args.cmd == "run":
        r = client.post(f"{API}/api/v1/control/run", headers=headers(), json={"command": args.command})
    elif args.cmd == "email":
        r = client.post(f"{API}/api/v1/control/email", headers=headers(), json={"message": args.message})
    elif args.cmd == "chat":
        r = client.post(f"{API}/api/v1/control/chat", headers=headers(), json={"message": args.message, "history": []})
    elif args.cmd == "autopilot":
        r = client.post(f"{API}/api/v1/control/autopilot", headers=headers(), json={"mode": args.mode})
    elif args.cmd == "test":
        r = client.post(f"{API}/api/v1/control/integrations/test-all", headers=headers())

    print(json.dumps(r.json(), indent=2))
    r.raise_for_status()


if __name__ == "__main__":
    main()
