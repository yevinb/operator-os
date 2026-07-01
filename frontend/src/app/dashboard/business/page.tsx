"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Activity,
  ArrowRight,
  Building2,
  Loader2,
  Network,
  Sparkles,
  Zap,
} from "lucide-react";
import {
  getBusinessGraph,
  getBusinessSnapshot,
  getLatestExecution,
  type BusinessGraph,
  type BusinessSnapshot,
  type LatestExecution,
} from "@/lib/api";
import { cn } from "@/lib/utils";

const METRIC_LABELS: Record<string, string> = {
  stripe_balance_usd: "Stripe balance",
  stripe_customers: "Customers",
  hubspot_contacts: "CRM contacts",
  meta_spend: "Meta spend (30d)",
  google_ads_spend: "Google Ads spend",
  quickbooks_income: "QuickBooks income",
  linkedin_name: "LinkedIn",
};

const INTEGRATION_LABELS: Record<string, string> = {
  stripe: "Stripe",
  hubspot: "HubSpot",
  gmail: "Gmail",
  slack: "Slack",
  notion: "Notion",
  n8n: "n8n",
  meta: "Meta Ads",
  "google-ads": "Google Ads",
  calendar: "Calendar",
  quickbooks: "QuickBooks",
  linkedin: "LinkedIn",
  mcp: "MCP",
};

export default function BusinessHubPage() {
  const [snapshot, setSnapshot] = useState<BusinessSnapshot | null>(null);
  const [graph, setGraph] = useState<BusinessGraph | null>(null);
  const [execution, setExecution] = useState<LatestExecution | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const [snap, g, ex] = await Promise.all([
          getBusinessSnapshot(),
          getBusinessGraph(),
          getLatestExecution(),
        ]);
        setSnapshot(snap);
        setGraph(g);
        setExecution(ex);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load business hub");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[40vh] text-text-2">
        <Loader2 className="animate-spin mr-2" size={20} />
        Loading business pulse…
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 max-w-4xl mx-auto text-center text-text-2">
        <p>{error}</p>
        <Link href="/dashboard/integrations" className="text-gold mt-4 inline-block">
          Open Integrations →
        </Link>
      </div>
    );
  }

  const metrics = snapshot?.metrics || {};
  const connected = snapshot?.connected_integrations || [];
  const metricEntries = Object.entries(metrics).filter(([k]) => METRIC_LABELS[k]);

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-8">
      <div>
        <p className="text-xs font-bold text-gold uppercase tracking-wider mb-1">Business Hub</p>
        <h1 className="text-2xl font-black flex items-center gap-2">
          <Building2 size={24} className="text-gold" />
          {snapshot?.company || "Your business"}
        </h1>
        <p className="text-text-2 text-sm mt-1">
          {snapshot?.business_narrative || snapshot?.narrative || "Connect integrations for live pulse."}
        </p>
        {snapshot?.goal && (
          <p className="text-xs text-text-3 mt-2">Goal: {snapshot.goal}</p>
        )}
      </div>

      <section>
        <h2 className="text-sm font-bold text-text-2 uppercase mb-3 flex items-center gap-2">
          <Activity size={16} /> Company pulse
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {metricEntries.length > 0 ? (
            metricEntries.map(([key, val]) => (
              <div key={key} className="card-premium rounded-xl p-4 border border-white/10">
                <p className="text-xs text-text-3">{METRIC_LABELS[key] || key}</p>
                <p className="text-lg font-bold text-white mt-1">
                  {key.includes("spend") || key.includes("balance") ? `$${val}` : String(val)}
                </p>
              </div>
            ))
          ) : (
            <div className="col-span-full card-premium rounded-xl p-6 border border-dashed border-white/20 text-center text-text-2 text-sm">
              {connected.length
                ? `${connected.length} tool(s) connected — run a command in Nexa Chat for live metrics`
                : "Connect Stripe, HubSpot, or Gmail in Integrations"}
            </div>
          )}
          <div className="card-premium rounded-xl p-4 border border-gold/20">
            <p className="text-xs text-text-3">Connected tools</p>
            <p className="text-lg font-bold text-gold mt-1">{connected.length}</p>
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-sm font-bold text-text-2 uppercase mb-3 flex items-center gap-2">
          <Network size={16} /> Integration graph
        </h2>
        <div className="card-premium rounded-2xl p-5 border border-white/10">
          <div className="flex flex-wrap gap-2 mb-4">
            {(graph?.nodes || []).map((node) => (
              <div
                key={node.id}
                className={cn(
                  "px-3 py-2 rounded-xl text-xs font-medium border",
                  node.connected
                    ? "bg-success/10 border-success/30 text-success"
                    : "bg-surface border-white/10 text-text-3"
                )}
              >
                {node.label}
              </div>
            ))}
          </div>
          <p className="text-xs text-text-3 mb-3">
            Active links between connected tools:
          </p>
          <div className="space-y-1">
            {(graph?.edges || [])
              .filter((e) => e.active)
              .slice(0, 12)
              .map((e, i) => (
                <p key={i} className="text-sm text-text-2">
                  {INTEGRATION_LABELS[e.from] || e.from} ↔ {INTEGRATION_LABELS[e.to] || e.to}
                </p>
              ))}
            {!(graph?.edges || []).some((e) => e.active) && (
              <p className="text-sm text-text-3">Connect 2+ tools to activate workflow links.</p>
            )}
          </div>
          <Link
            href="/dashboard/integrations"
            className="inline-flex items-center gap-1 text-gold text-sm mt-4 hover:underline"
          >
            Manage integrations <ArrowRight size={14} />
          </Link>
        </div>
      </section>

      {execution?.active && (
        <section>
          <h2 className="text-sm font-bold text-text-2 uppercase mb-3 flex items-center gap-2">
            <Zap size={16} /> Last execution chain
          </h2>
          <div className="card-premium rounded-2xl p-5 border border-white/10 space-y-3">
            <p className="text-sm font-semibold text-white">&ldquo;{execution.command}&rdquo;</p>
            <p className="text-xs text-success">
              {execution.verified_count} verified action(s)
              {execution.created_at && ` · ${new Date(execution.created_at).toLocaleString()}`}
            </p>
            <div className="space-y-2 border-l-2 border-gold/30 pl-4">
              {(execution.bundle?.proofs || []).map((p, i) => (
                <div key={i} className="text-sm">
                  <span className="text-gold text-xs uppercase">
                    {p.integration || "nexa"}
                  </span>
                  <p className="text-text-2">{p.detail}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      <section>
        <h2 className="text-sm font-bold text-text-2 uppercase mb-3 flex items-center gap-2">
          <Sparkles size={16} /> Suggested commands
        </h2>
        <div className="flex flex-wrap gap-2">
          {(graph?.suggested_commands || []).map((cmd) => (
            <Link
              key={cmd}
              href={`/dashboard?cmd=${encodeURIComponent(cmd)}`}
              className="px-3 py-2 rounded-full text-xs border border-white/10 text-text-2 hover:border-gold/40 hover:text-gold transition-colors"
            >
              {cmd}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
