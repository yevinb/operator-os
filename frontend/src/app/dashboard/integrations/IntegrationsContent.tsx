"use client";

import { useEffect, useState } from "react";
import { Check, Plug } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { apiFetch, hasApiConfigured } from "@/lib/api";
import { getIntegrations } from "@/lib/store";
import { saveBusinessProfile } from "@/lib/business-context";
import type { Integration } from "@/lib/types";
import { cn } from "@/lib/utils";

type ApiIntegration = {
  id: string;
  name: string;
  category: string;
  description: string;
  connected: boolean;
  needs_key: boolean;
  auth_type: string;
  key_hint: string;
  config_fields: string[];
};

const GOOGLE_OAUTH_IDS = new Set(["gmail", "calendar"]);
const CONFIG_LABELS: Record<string, string> = {
  database_id: "Notion database ID",
  realm_id: "QuickBooks Realm ID",
  ad_account_id: "Meta ad account ID",
  customer_id: "Google Ads customer ID",
  default_to: "Default recipient email",
};

const CATEGORIES = ["all", "marketing", "sales", "finance", "support", "hr", "operations", "automation", "communication"];

export default function IntegrationsContent() {
  const searchParams = useSearchParams();
  const [integrations, setIntegrations] = useState<Integration[]>(getIntegrations);
  const [apiMeta, setApiMeta] = useState<Record<string, ApiIntegration>>({});
  const [filter, setFilter] = useState("all");
  const [keyModal, setKeyModal] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [configFields, setConfigFields] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [googleLoading, setGoogleLoading] = useState(false);
  const [gmailTo, setGmailTo] = useState("");

  const loadFromApi = async () => {
    if (!(await hasApiConfigured())) return;
    try {
      const list = await apiFetch<ApiIntegration[]>("/api/v1/integrations");
      const meta: Record<string, ApiIntegration> = {};
      list.forEach((i) => { meta[i.id] = i; });
      setApiMeta(meta);
      setIntegrations((prev) =>
        prev.map((p) => {
          const api = list.find((i) => i.id === p.id);
          return api ? { ...p, connected: api.connected, description: api.description } : p;
        })
      );
      saveBusinessProfile({ connectedIntegrations: list.filter((i) => i.connected).map((i) => i.id) });
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    loadFromApi();
    if (searchParams.get("connected") === "google") {
      setSuccess("Google connected — Gmail & Calendar ready");
      setTimeout(() => setSuccess(""), 6000);
    }
    if (searchParams.get("error")) {
      setError("Google connection failed — check Railway GOOGLE_CLIENT_ID/SECRET");
    }
  }, [searchParams]);

  const connectGoogle = async () => {
    setGoogleLoading(true);
    setError("");
    try {
      const res = await apiFetch<{ url: string }>("/api/v1/oauth/google/start");
      window.location.href = res.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Google OAuth not configured on server");
      setGoogleLoading(false);
    }
  };

  const openModal = (id: string) => {
    setKeyModal(id);
    setApiKey("");
    setConfigFields({});
    setError("");
  };

  const doConnect = async (id: string, key: string, config: Record<string, string>) => {
    setError("");
    try {
      const res = await apiFetch<{ message?: string }>(`/api/v1/integrations/${id}/connect`, {
        method: "POST",
        body: JSON.stringify({ api_key: key, config }),
      });
      await loadFromApi();
      setKeyModal(null);
      setSuccess(res.message || `${id} connected`);
      setTimeout(() => setSuccess(""), 6000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Connection failed");
    }
  };

  const saveGmailRecipient = async () => {
    if (!gmailTo.trim()) return;
    await doConnect("gmail", "", { default_to: gmailTo.trim() });
  };

  const disconnect = async (id: string) => {
    if (await hasApiConfigured()) {
      try {
        await apiFetch(`/api/v1/integrations/${id}/disconnect`, { method: "POST" });
      } catch { /* ignore */ }
    }
    await loadFromApi();
  };

  const filtered = filter === "all" ? integrations : integrations.filter((i) => i.category === filter);
  const connected = integrations.filter((i) => i.connected).length;
  const modalMeta = keyModal ? apiMeta[keyModal] : null;
  const gmailConnected = integrations.find((i) => i.id === "gmail")?.connected;

  const isGoogleOAuth = (id: string) => {
    const meta = apiMeta[id];
    return meta?.auth_type === "google_oauth" || GOOGLE_OAUTH_IDS.has(id);
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold mb-1">Integrations</h1>
          <p className="text-text-2 text-sm">Connect your keys or Google account — commands run against real APIs.</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-accent">{connected}</p>
          <p className="text-xs text-text-3">connected</p>
        </div>
      </div>

      {success && <div className="mb-4 p-4 rounded-xl bg-success/10 border border-success/30 text-success text-sm">{success}</div>}
      {error && !keyModal && <div className="mb-4 p-4 rounded-xl bg-danger/10 border border-danger/30 text-danger text-sm">{error}</div>}

      <div className="mb-6 p-4 rounded-xl bg-accent/10 border border-accent/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <p className="font-semibold">Gmail + Google Calendar</p>
          <p className="text-sm text-text-2">One Google sign-in connects both</p>
        </div>
        <button
          onClick={connectGoogle}
          disabled={googleLoading}
          className="px-5 py-2.5 rounded-xl bg-white text-black font-medium text-sm hover:bg-zinc-200 disabled:opacity-50"
        >
          {googleLoading ? "Redirecting…" : "Connect with Google"}
        </button>
      </div>

      {gmailConnected && (
        <div className="mb-6 p-4 rounded-xl bg-surface border border-border flex flex-col sm:flex-row gap-3">
          <input
            value={gmailTo}
            onChange={(e) => setGmailTo(e.target.value)}
            placeholder="Gmail recipient for automated emails"
            className="flex-1 px-4 py-2.5 rounded-xl bg-void border border-border text-sm"
          />
          <button onClick={saveGmailRecipient} className="px-4 py-2.5 rounded-xl bg-accent text-white text-sm font-medium">
            Save recipient
          </button>
        </div>
      )}

      <div className="flex flex-wrap gap-2 mb-6">
        {CATEGORIES.map((c) => (
          <button key={c} onClick={() => setFilter(c)} className={cn("px-3 py-1.5 text-xs rounded-full border capitalize", filter === c ? "bg-accent/10 border-accent text-accent" : "border-border text-text-2")}>
            {c}
          </button>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {filtered.map((int) => {
          const isGoogle = isGoogleOAuth(int.id);
          return (
            <div key={int.id} className={cn("p-5 rounded-2xl border", int.connected ? "bg-success/5 border-success/30" : "bg-surface border-border")}>
              <div className="flex items-start gap-4">
                <span className="text-3xl">{int.icon}</span>
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold">{int.name}</h3>
                    {int.connected && <span className="text-xs px-2 py-0.5 rounded-full bg-success/10 text-success"><Check size={10} className="inline" /> Live</span>}
                  </div>
                  <p className="text-sm text-text-2 mt-1">{apiMeta[int.id]?.description || int.description}</p>
                </div>
              </div>
              <button
                onClick={() => (int.connected ? disconnect(int.id) : isGoogle ? connectGoogle() : openModal(int.id))}
                className={cn("mt-4 w-full py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2", int.connected ? "bg-surface-2 text-text-2" : "bg-accent text-white")}
              >
                <Plug size={14} />
                {int.connected ? "Disconnect" : isGoogle ? "Connect with Google" : "Connect"}
              </button>
            </div>
          );
        })}
      </div>

      {keyModal && modalMeta && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
          <div className="w-full max-w-md p-6 rounded-2xl bg-surface border border-border max-h-[90vh] overflow-y-auto">
            <h3 className="font-bold text-lg mb-2">Connect {modalMeta.name}</h3>
            <p className="text-sm text-text-2 mb-4">{modalMeta.key_hint}</p>
            {modalMeta.needs_key && (
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={modalMeta.key_hint}
                className="w-full px-4 py-3 rounded-xl bg-void border border-border mb-3"
              />
            )}
            {modalMeta.config_fields.map((field) => (
              <input
                key={field}
                value={configFields[field] || ""}
                onChange={(e) => setConfigFields((f) => ({ ...f, [field]: e.target.value }))}
                placeholder={CONFIG_LABELS[field] || field}
                className="w-full px-4 py-3 rounded-xl bg-void border border-border mb-3"
              />
            ))}
            {error && <p className="text-danger text-sm mb-2">{error}</p>}
            <div className="flex gap-2 mt-4">
              <button onClick={() => setKeyModal(null)} className="flex-1 py-2 rounded-xl border border-border">Cancel</button>
              <button onClick={() => doConnect(keyModal, apiKey, configFields)} className="flex-1 py-2 rounded-xl bg-accent text-white font-medium">
                Connect & verify
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
