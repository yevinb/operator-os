"""Cross-tool execution state — passes live data between integration steps."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from app.services.business_snapshot import BusinessSnapshot


@dataclass
class ExecutionBundle:
    command: str
    company: str
    snapshot: BusinessSnapshot
    metrics: dict[str, str | float | int] = field(default_factory=dict)
    proofs: list[dict[str, Any]] = field(default_factory=list)
    narrative_lines: list[str] = field(default_factory=list)
    run_id: int | None = None

    @classmethod
    def from_snapshot(cls, command: str, company: str, snapshot: BusinessSnapshot) -> "ExecutionBundle":
        bundle = cls(
            command=command,
            company=company,
            snapshot=snapshot,
            metrics=dict(snapshot.metrics),
        )
        if snapshot.narrative:
            bundle.narrative_lines.append(snapshot.narrative)
        return bundle

    def absorb(self, integration: str | None, detail: str, proof: dict | None, verified: bool) -> None:
        if not verified:
            return
        entry = {
            "integration": integration,
            "detail": detail,
            "proof": proof or {},
        }
        self.proofs.append(entry)
        if detail:
            self.narrative_lines.append(detail)
        if proof:
            for k, v in proof.items():
                if k not in ("source",) and v is not None:
                    self.metrics[f"{integration}_{k}" if integration else k] = v

    def metrics_summary(self) -> str:
        lines: list[str] = []
        for key in (
            "stripe_balance_usd",
            "stripe_customers",
            "hubspot_contacts",
            "meta_spend",
            "google_ads_spend",
            "quickbooks_income",
        ):
            if key in self.metrics:
                label = key.replace("_", " ")
                lines.append(f"{label}: {self.metrics[key]}")
        return " · ".join(lines) if lines else ""

    def enrich_message(self, task_action: str = "") -> str:
        header = f"Nexa | {self.company}"
        metrics = self.metrics_summary()
        body_parts = [f"Command: {self.command}"]
        if task_action:
            body_parts.append(f"Action: {task_action}")
        if metrics:
            body_parts.append(f"Live metrics: {metrics}")
        if len(self.proofs) > 1:
            prior = [p["detail"] for p in self.proofs[:-1] if p.get("detail")][-3:]
            if prior:
                body_parts.append("Prior steps: " + " | ".join(prior))
        if self.narrative_lines:
            body_parts.append(self.narrative_lines[-1])
        return header + "\n" + "\n".join(body_parts)

    def hubspot_body(self, task_action: str) -> str:
        lines = [
            f"Nexa execution — {self.company}",
            f"Command: {self.command}",
            f"Task: {task_action}",
        ]
        if self.metrics_summary():
            lines.append(f"Metrics: {self.metrics_summary()}")
        for p in self.proofs:
            if p.get("detail"):
                lines.append(f"• {p['detail']}")
        return "\n".join(lines)

    def notion_body(self, task_action: str) -> str:
        lines = [
            self.snapshot.narrative or f"Update for {self.company}",
            f"Command: {self.command}",
            f"Action: {task_action}",
        ]
        if self.metrics_summary():
            lines.append(f"Metrics: {self.metrics_summary()}")
        for p in self.proofs:
            if p.get("detail"):
                lines.append(f"- {p['detail']}")
        return "\n".join(lines)

    def email_context(self) -> str:
        parts = [self.snapshot.narrative or ""]
        if self.metrics_summary():
            parts.append(f"Current business metrics: {self.metrics_summary()}")
        if self.proofs:
            parts.append("Recent Nexa actions: " + "; ".join(
                p["detail"] for p in self.proofs[-3:] if p.get("detail")
            ))
        return "\n".join(p for p in parts if p)

    def n8n_payload(self, task_action: str, category: str) -> dict:
        return {
            "event": "nexa.task",
            "company": self.company,
            "command": self.command,
            "task": task_action,
            "category": category,
            "metrics": self.metrics,
            "narrative": self.narrative_lines,
            "proofs": self.proofs,
            "bundle": self.to_dict(),
        }

    def to_dict(self) -> dict:
        return {
            "command": self.command,
            "company": self.company,
            "metrics": self.metrics,
            "narrative_lines": self.narrative_lines,
            "proofs": self.proofs,
            "snapshot": self.snapshot.to_dict(),
            "run_id": self.run_id,
        }

    def verified_integrations(self) -> list[str]:
        seen: list[str] = []
        for p in self.proofs:
            iid = p.get("integration")
            if iid and iid not in seen:
                seen.append(iid)
        return seen

    def summary_line(self) -> str:
        integrations = self.verified_integrations()
        if not integrations:
            return ""
        parts = []
        for iid in integrations:
            if iid == "stripe" and "stripe_balance_usd" in self.metrics:
                parts.append(f"Stripe (${self.metrics['stripe_balance_usd']})")
            elif iid == "hubspot" and "hubspot_contacts" in self.metrics:
                parts.append(f"HubSpot ({self.metrics['hubspot_contacts']} contacts)")
            else:
                parts.append(iid.title())
        return "Verified using " + ", ".join(parts)
