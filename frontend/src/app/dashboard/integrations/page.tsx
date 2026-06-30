"use client";

import { useEffect, useState } from "react";
import { Check, Plug, Key } from "lucide-react";
import { apiFetch, hasApiConfigured } from "@/lib/api";
import { getIntegrations, toggleIntegration } from "@/lib/store";
import { saveBusinessProfile } from "@/lib/business-context";
import type { Integration } from "@/lib/types";
import { cn } from "@/lib/utils";

const NEEDS_KEY = new Set(["stripe", "n8n"]);

type ApiIntegration = {
  id: string;
  name: string;
  category: string;
  description: string;
  connected: boolean;
  needs_key: boolean;
};

const CATEGORIES = ["all", "marketing", "sales", "finance", "support", "hr", "operations", "automation", "communication"];

export default function IntegrationsPage() {
  const [integrations, setIntegrations] = useState<Integration[]>(getIntegrations);
  const [filter, setFilter] = useState("all");
  const [keyModal, setKeyModal] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      if (!(await hasApiConfigured())) return;
      try {
        const list = await apiFetch<ApiIntegration[]>("/api/v1/integrations");
        setIntegrations((prev) =>
          prev.map((p) => {
            const api = list.find((i) => i.id === p.id);
            return api ? { ...p, connected: api.connected } : p;
          })
        );
        saveBusinessProfile({
          connectedIntegrations: list.filter((i) => i.connected).map((i) => i.id),
        });
      } catch {
        // use local
      }
    })();
  }, []);

  const connect = async (id: string) => {
    if (NEEDS_KEY.has(id)) {
      setKeyModal(id);
      setApiKey("");
      setError("");
      return;
    }
    await doConnect(id, "");
  };

  const doConnect = async (id: string, key: string) => {
    if (await hasApiConfigured()) {
      try {
        await apiFetch(`/api/v1/integrations/${id}/connect`, {
          method: "POST",
          body: JSON.stringify({ api_key: key }),
        });
        const list = await apiFetch<ApiIntegration[]>("/api/v1/integrations");
        setIntegrations((prev) =>
          prev.map((p) => {
            const api = list.find((i) => i.id === p.id);
            return api ? { ...p, connected: api.connected } : p;
          })
        );
        saveBusinessProfile({
          connectedIntegrations: list.filter((i) => i.connected).map((i) => i.id),
        });
        setKeyModal(null);
        return;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Connection failed");
        return;
      }
    }
    toggleIntegration(id);
    setIntegrations(getIntegrations());
    saveBusinessProfile({
      connectedIntegrations: getIntegrations().filter((i) => i.connected).map((i) => i.id),
    });
    setKeyModal(null);
  };

  const disconnect = async (id: string) => {
    if (await hasApiConfigured()) {
      try {
        await apiFetch(`/api/v1/integrations/${id}/disconnect`, { method: "POST" });
      } catch {
        // local fallback
      }
    }
    const list = getIntegrations().map((i) => (i.id === id ? { ...i, connected: false } : i));
    localStorage.setItem("operatoros_integrations", JSON.stringify(list));
    setIntegrations(list);
    saveBusinessProfile({ connectedIntegrations: list.filter((i) => i.connected).map((i) => i.id) });
  };

  const filtered = filter === "all" ? integrations : integrations.filter((i) => i.category === filter);
  const connected = integrations.filter((i) => i.connected).length;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold mb-1">Integrations</h1>
          <p className="text-text-2 text-sm">
            Connect your business tools. Your AI COO reads live data and executes through these.
          </p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-accent">{connected}</p>
          <p className="text-xs text-text-3">connected</p>
        </div>
      </div>

      <div className="mb-6 p-4 rounded-xl bg-gold/10 border border-gold/30 text-sm text-text-2">
        <strong className="text-gold">Start with Stripe:</strong> Add your secret key (sk_test_...) so commands use your real revenue and customer data.
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        {CATEGORIES.map((c) => (
          <button
            key={c}
            onClick={() => setFilter(c)}
            className={cn(
              "px-3 py-1.5 text-xs rounded-full border capitalize transition-colors",
              filter === c ? "bg-accent/10 border-accent text-accent" : "border-border text-text-2 hover:border-accent/30"
            )}
          >
            {c}
          </button>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {filtered.map((int) => (
          <div
            key={int.id}
            className={cn(
              "p-5 rounded-2xl border transition-colors",
              int.connected ? "bg-success/5 border-success/30" : "bg-surface border-border hover:border-accent/20"
            )}
          >
            <div className="flex items-start gap-4">
              <span className="text-3xl">{int.icon}</span>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold">{int.name}</h3>
                  {int.connected && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-success/10 text-success flex items-center gap-1">
                      <Check size={10} /> Connected
                    </span>
                  )}
                  {NEEDS_KEY.has(int.id) && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-gold/10 text-gold flex items-center gap-1">
                      <Key size={10} /> API key
                    </span>
                  )}
                </div>
                <p className="text-sm text-text-2 mt-1">{int.description}</p>
              </div>
            </div>
            <button
              onClick={() => (int.connected ? disconnect(int.id) : connect(int.id))}
              className={cn(
                "mt-4 w-full py-2.5 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2",
                int.connected ? "bg-surface-2 text-text-2 hover:bg-surface-3" : "bg-accent text-white hover:bg-accent-bright"
              )}
            >
              <Plug size={14} />
              {int.connected ? "Disconnect" : "Connect"}
            </button>
          </div>
        ))}
      </div>

      {keyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
          <div className="w-full max-w-md p-6 rounded-2xl bg-surface border border-border">
            <h3 className="font-bold text-lg mb-2">Connect {keyModal}</h3>
            <p className="text-sm text-text-2 mb-4">Paste your API key. Stored securely on the server when backend is running.</p>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={keyModal === "stripe" ? "sk_test_..." : "API key"}
              className="w-full px-4 py-3 rounded-xl bg-void border border-border mb-2"
            />
            {error && <p className="text-danger text-sm mb-2">{error}</p>}
            <div className="flex gap-2 mt-4">
              <button onClick={() => setKeyModal(null)} className="flex-1 py-2 rounded-xl border border-border">
                Cancel
              </button>
              <button
                onClick={() => doConnect(keyModal, apiKey)}
                className="flex-1 py-2 rounded-xl bg-accent text-white font-medium"
              >
                Connect
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
