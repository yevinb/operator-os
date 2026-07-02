"use client";

import { useEffect, useState } from "react";
import { Check, Plug } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiFetch, hasApiConfigured } from "@/lib/api";
import { getToken } from "@/lib/auth";
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
  server_ready?: boolean;
};

type IntegrationTestResult = {
  id: string;
  connected: boolean;
  ok: boolean;
  message: string;
};

const GOOGLE_OAUTH_IDS = new Set(["gmail", "calendar"]);
const GOOGLE_ADS_OAUTH = "google-ads";
const SHOPIFY_OAUTH_IDS = new Set(["shopify"]);
const QUICKBOOKS_OAUTH_IDS = new Set(["quickbooks"]);
const CONFIG_LABELS: Record<string, string> = {
  database_id: "Notion database ID",
  realm_id: "QuickBooks Realm ID",
  ad_account_id: "Meta ad account ID",
  customer_id: "Google Ads customer ID",
  shop_domain: "Shopify store domain",
};

const CATEGORIES = ["all", "marketing", "sales", "finance", "support", "hr", "operations", "automation", "communication"];
const FALLBACK_META: Record<string, ApiIntegration> = {
  stripe: { id: "stripe", name: "Stripe", category: "finance", description: "Live revenue, balance & customers", connected: false, needs_key: true, auth_type: "api_key", key_hint: "sk_test_... or sk_live_...", config_fields: [] },
  slack: { id: "slack", name: "Slack", category: "communication", description: "Post COO updates to Slack", connected: false, needs_key: true, auth_type: "webhook", key_hint: "https://hooks.slack.com/services/...", config_fields: [] },
  n8n: { id: "n8n", name: "n8n", category: "automation", description: "Trigger workflows on commands", connected: false, needs_key: true, auth_type: "webhook", key_hint: "https://your-n8n.app/webhook/...", config_fields: [] },
  gmail: { id: "gmail", name: "Gmail", category: "support", description: "Send customer emails via Gmail API", connected: false, needs_key: false, auth_type: "google_oauth", key_hint: "", config_fields: ["default_to"] },
  calendar: { id: "calendar", name: "Google Calendar", category: "operations", description: "Book meetings on your calendar", connected: false, needs_key: false, auth_type: "google_oauth", key_hint: "", config_fields: [] },
  "google-ads": { id: "google-ads", name: "Google Ads", category: "marketing", description: "Connect with Google + developer token & customer ID", connected: false, needs_key: true, auth_type: "google_ads", key_hint: "Google Ads developer token", config_fields: ["customer_id"] },
  meta: { id: "meta", name: "Meta Ads", category: "marketing", description: "Facebook & Instagram ads", connected: false, needs_key: true, auth_type: "api_key", key_hint: "Long-lived access token", config_fields: ["ad_account_id"] },
  hubspot: { id: "hubspot", name: "HubSpot", category: "sales", description: "CRM contacts & pipeline", connected: false, needs_key: true, auth_type: "api_key", key_hint: "Private app token (pat-...)", config_fields: [] },
  notion: { id: "notion", name: "Notion", category: "operations", description: "Create pages & docs", connected: false, needs_key: true, auth_type: "api_key", key_hint: "Integration token (secret_...)", config_fields: ["database_id"] },
  quickbooks: { id: "quickbooks", name: "QuickBooks", category: "finance", description: "One-click Intuit connect — live P&L and expenses", connected: false, needs_key: false, auth_type: "quickbooks_oauth", key_hint: "", config_fields: [] },
  linkedin: { id: "linkedin", name: "LinkedIn", category: "hr", description: "Hiring & B2B outreach", connected: false, needs_key: true, auth_type: "api_key", key_hint: "LinkedIn access token", config_fields: [] },
  shopify: { id: "shopify", name: "Shopify", category: "finance", description: "Sync orders, customers, and store revenue", connected: false, needs_key: false, auth_type: "shopify_hybrid", key_hint: "Connection key from Shopify", config_fields: ["shop_domain"] },
  mcp: { id: "mcp", name: "MCP Servers", category: "automation", description: "Model Context Protocol tools", connected: false, needs_key: true, auth_type: "webhook", key_hint: "MCP server URL", config_fields: [] },
};

const OAUTH_ERROR_MESSAGES: Record<string, string> = {
  oauth_failed: "Sign-in was cancelled or expired. Please try connecting again.",
  oauth_state_invalid: "Connection expired. Please try connecting again.",
  token_exchange_failed: "Token exchange failed. Check server OAuth redirect URI settings.",
};

const WORKS_WITH: Record<string, string[]> = {
  stripe: ["Slack", "Notion", "HubSpot", "n8n", "Gmail"],
  hubspot: ["Gmail", "Slack", "Notion", "n8n", "Stripe"],
  gmail: ["HubSpot", "Calendar", "Notion", "Slack"],
  slack: ["Stripe", "HubSpot", "Notion", "n8n", "Meta"],
  notion: ["Stripe", "HubSpot", "Slack", "Gmail", "n8n"],
  n8n: ["Stripe", "HubSpot", "Slack", "Gmail", "Notion"],
  meta: ["Slack", "Notion", "n8n", "Google Ads"],
  "google-ads": ["Slack", "Notion", "n8n", "Meta"],
  calendar: ["Gmail", "Slack", "HubSpot"],
  quickbooks: ["Stripe", "Slack", "Notion"],
  linkedin: ["Gmail", "Notion", "Calendar"],
  shopify: ["Stripe", "Slack", "Gmail", "Notion"],
  mcp: ["n8n", "Notion"],
};

const INTEGRATION_ICONS: Record<string, string> = {
  stripe: "💳", slack: "💬", "google-ads": "📢", meta: "📱", gmail: "✉️", calendar: "📅",
  n8n: "⚡", mcp: "🔌", notion: "📝", hubspot: "🎯", quickbooks: "📊", linkedin: "👔",
  shopify: "🛒",
};

export default function IntegrationsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [integrations, setIntegrations] = useState<Integration[]>(getIntegrations);
  const [apiMeta, setApiMeta] = useState<Record<string, ApiIntegration>>(FALLBACK_META);
  const [filter, setFilter] = useState("all");
  const [keyModal, setKeyModal] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [configFields, setConfigFields] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [oauthLoadingId, setOauthLoadingId] = useState<string | null>(null);
  const [gmailTo, setGmailTo] = useState("");
  const [shopDomain, setShopDomain] = useState("");
  const [googleAdsDevToken, setGoogleAdsDevToken] = useState("");
  const [googleAdsCustomerId, setGoogleAdsCustomerId] = useState("");
  const [shopifyModal, setShopifyModal] = useState(false);
  const [shopifyModalError, setShopifyModalError] = useState("");
  const [testingMap, setTestingMap] = useState<Record<string, boolean>>({});
  const [testResults, setTestResults] = useState<Record<string, IntegrationTestResult>>({});
  const [testAllLoading, setTestAllLoading] = useState(false);
  const [oauthServerStatus, setOauthServerStatus] = useState<{
    shopify: boolean;
    google: boolean;
    quickbooks: boolean;
  } | null>(null);

  const loadFromApi = async () => {
    if (!(await hasApiConfigured())) return;
    try {
      const status = await apiFetch<{
        shopify: boolean;
        google: boolean;
        quickbooks: boolean;
      }>("/api/v1/integrations/oauth-server-status");
      setOauthServerStatus(status);
    } catch {
      setOauthServerStatus(null);
    }
    try {
      const list = await apiFetch<ApiIntegration[]>("/api/v1/integrations");
      const meta: Record<string, ApiIntegration> = { ...FALLBACK_META };
      list.forEach((i) => { meta[i.id] = i; });
      setApiMeta(meta);
      setIntegrations(
        list.map((api) => {
          const prev = integrations.find((p) => p.id === api.id);
          return {
            id: api.id,
            name: api.name,
            description: api.description,
            category: api.category,
            connected: api.connected,
            icon: prev?.icon || INTEGRATION_ICONS[api.id] || "🔌",
          };
        })
      );
      saveBusinessProfile({ connectedIntegrations: list.filter((i) => i.connected).map((i) => i.id) });
      await loadSavedConfigs(list.filter((i) => i.connected).map((i) => i.id));
    } catch {
      setApiMeta(FALLBACK_META);
    }
  };

  const loadSavedConfigs = async (connectedIds: string[]) => {
    for (const id of connectedIds) {
      try {
        const row = await apiFetch<{ config: Record<string, string> }>(`/api/v1/integrations/${id}/config`);
        const cfg = row.config || {};
        if (id === "gmail" && cfg.default_to) setGmailTo(cfg.default_to);
        if (id === "google-ads" && cfg.customer_id) setGoogleAdsCustomerId(cfg.customer_id);
        if (id === "shopify" && cfg.shop_domain) setShopDomain(cfg.shop_domain);
      } catch {
        /* ignore */
      }
    }
  };

  useEffect(() => {
    loadFromApi();
    const connected = searchParams.get("connected");
    if (connected === "gmail") {
      setSuccess("Gmail connected — add a recipient below if you want emails sent elsewhere");
      setTimeout(() => setSuccess(""), 8000);
      void loadFromApi();
    } else if (connected === "calendar") {
      setSuccess("Google Calendar connected");
      setTimeout(() => setSuccess(""), 6000);
      void loadFromApi();
    } else if (connected === "shopify") {
      setSuccess("Shopify store connected");
      setTimeout(() => setSuccess(""), 6000);
      void loadFromApi();
    } else if (connected === "quickbooks") {
      setSuccess("QuickBooks connected");
      setTimeout(() => setSuccess(""), 6000);
      void loadFromApi();
    } else if (connected === "google-ads") {
      setSuccess("Google Ads authorized — add your developer token and customer ID below");
      setTimeout(() => setSuccess(""), 8000);
      void loadFromApi();
    }
    const oauthError = searchParams.get("error");
    const oauthDetail = searchParams.get("detail");
    if (oauthError) {
      const base = OAUTH_ERROR_MESSAGES[oauthError] || "Connection failed — check server OAuth settings";
      setError(oauthDetail ? `${base} (${oauthDetail})` : base);
    }
  }, [searchParams]);

  const connectGoogle = async (integrationId: "gmail" | "calendar" | "google-ads") => {
    if (!getToken()) {
      setError("Please sign in first, then connect Gmail.");
      router.push("/login");
      return;
    }
    setOauthLoadingId(integrationId);
    setError("");
    try {
      const res = await apiFetch<{ url: string }>(`/api/v1/oauth/google/start?integration_id=${integrationId}`);
      if (!res.url) throw new Error("No Google OAuth URL returned from server");
      window.location.href = res.url;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Google OAuth not configured on server";
      setError(msg.includes("401") || msg.toLowerCase().includes("credentials")
        ? "Session expired — sign in again, then connect Gmail."
        : msg);
      setOauthLoadingId(null);
    }
  };

  const connectShopifyOAuth = async () => {
    if (!getToken()) {
      router.push("/login");
      return;
    }
    const shop = shopDomain.trim();
    if (!shop) {
      setShopifyModalError("Enter your store URL.");
      return;
    }
    setOauthLoadingId("shopify");
    setShopifyModalError("");
    try {
      const res = await apiFetch<{ url: string }>(
        `/api/v1/oauth/shopify/start?shop=${encodeURIComponent(shop)}`
      );
      if (!res.url) throw new Error("Could not connect to Shopify.");
      window.location.href = res.url;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not connect to Shopify.";
      setShopifyModalError(
        msg.toLowerCase().includes("sign in") || msg.toLowerCase().includes("session")
          ? "Please sign in again, then try connecting."
          : "Could not connect right now. Check your store URL and try again."
      );
      if (msg.toLowerCase().includes("sign in")) {
        setTimeout(() => router.push("/login"), 2000);
      }
      setOauthLoadingId(null);
    }
  };

  const connectShopifySimple = async () => {
    if (!getToken()) {
      router.push("/login");
      return;
    }
    const shop = shopDomain.trim();
    if (!shop) {
      setShopifyModalError("Enter your store URL.");
      return;
    }
    await connectShopifyOAuth();
  };

  const openShopifyModal = () => {
    setShopifyModal(true);
    setShopifyModalError("");
    setError("");
  };

  const closeShopifyModal = () => {
    setShopifyModal(false);
    setShopifyModalError("");
  };

  const connectQuickBooks = async () => {
    if (!getToken()) {
      router.push("/login");
      return;
    }
    setOauthLoadingId("quickbooks");
    setError("");
    try {
      const res = await apiFetch<{ url: string }>("/api/v1/oauth/quickbooks/start");
      if (!res.url) throw new Error("No QuickBooks OAuth URL returned");
      window.location.href = res.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "QuickBooks OAuth not configured on server");
      setOauthLoadingId(null);
    }
  };

  const saveGoogleAdsSettings = async () => {
    if (!googleAdsDevToken.trim() || !googleAdsCustomerId.trim()) return;
    await doConnect("google-ads", googleAdsDevToken.trim(), { customer_id: googleAdsCustomerId.trim() });
  };

  const openModal = (id: string) => {
    if (!apiMeta[id] && !FALLBACK_META[id]) {
      setError("Integration details unavailable. Refresh and try again.");
      return;
    }
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

  const testOne = async (id: string) => {
    setError("");
    setTestingMap((m) => ({ ...m, [id]: true }));
    try {
      const r = await apiFetch<IntegrationTestResult>(`/api/v1/integrations/${id}/test`, { method: "POST" });
      setTestResults((p) => ({ ...p, [id]: r }));
      if (r.ok) {
        setSuccess(`${apiMeta[id]?.name || id}: ${r.message}`);
        setTimeout(() => setSuccess(""), 5000);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Integration test failed");
    } finally {
      setTestingMap((m) => ({ ...m, [id]: false }));
    }
  };

  const testAll = async () => {
    setError("");
    setTestAllLoading(true);
    try {
      const rows = await apiFetch<IntegrationTestResult[]>("/api/v1/integrations/test-all", { method: "POST" });
      const byId: Record<string, IntegrationTestResult> = {};
      rows.forEach((r) => { byId[r.id] = r; });
      setTestResults(byId);
      const ok = rows.filter((r) => r.ok).length;
      setSuccess(`Tested ${rows.length} connected integration(s): ${ok} passing`);
      setTimeout(() => setSuccess(""), 6000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Test all failed");
    } finally {
      setTestAllLoading(false);
    }
  };

  const filtered = filter === "all" ? integrations : integrations.filter((i) => i.category === filter);
  const connected = integrations.filter((i) => i.connected).length;
  const modalMeta = keyModal ? (apiMeta[keyModal] || FALLBACK_META[keyModal]) : null;
  const gmailConnected = integrations.find((i) => i.id === "gmail")?.connected;
  const googleAdsConnected = integrations.find((i) => i.id === "google-ads")?.connected;

  const isGoogleOAuth = (id: string) => {
    const meta = apiMeta[id];
    return meta?.auth_type === "google_oauth" || GOOGLE_OAUTH_IDS.has(id);
  };

  const isGoogleAdsOAuth = (id: string) => id === GOOGLE_ADS_OAUTH;

  const isShopifyConnect = (id: string) => {
    const meta = apiMeta[id];
    return meta?.auth_type === "shopify_hybrid" || meta?.auth_type === "shopify_oauth" || SHOPIFY_OAUTH_IDS.has(id);
  };

  const isQuickBooksOAuth = (id: string) => {
    const meta = apiMeta[id];
    return meta?.auth_type === "quickbooks_oauth" || QUICKBOOKS_OAUTH_IDS.has(id);
  };

  const isServerReady = (id: string) => apiMeta[id]?.server_ready !== false;

  const connectLabel = (id: string) => {
    if (!isServerReady(id) && (isGoogleOAuth(id) || isGoogleAdsOAuth(id) || isQuickBooksOAuth(id))) {
      return "Not on server";
    }
    if (isGoogleOAuth(id)) return "Connect with Google";
    if (isGoogleAdsOAuth(id)) return "Connect with Google";
    if (isShopifyConnect(id)) return "Connect store";
    if (isQuickBooksOAuth(id)) return "Connect with QuickBooks";
    return "Connect";
  };

  const handleConnect = (id: string) => {
    if (isGoogleOAuth(id)) return connectGoogle(id === "calendar" ? "calendar" : "gmail");
    if (isGoogleAdsOAuth(id)) return connectGoogle("google-ads");
    if (isShopifyConnect(id)) return openShopifyModal();
    if (isQuickBooksOAuth(id)) return connectQuickBooks();
    return openModal(id);
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold mb-1">Integrations</h1>
          <p className="text-text-2 text-sm">Connect your tools — Stripe, Slack, Shopify, Gmail, and more.</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-accent">{connected}</p>
          <p className="text-xs text-text-3">connected</p>
          <button
            onClick={testAll}
            disabled={testAllLoading || connected === 0}
            className="mt-2 px-3 py-1.5 text-xs rounded-lg border border-border hover:border-accent/40 disabled:opacity-50"
          >
            {testAllLoading ? "Testing..." : "Test all connected"}
          </button>
        </div>
      </div>

      {success && <div className="mb-4 p-4 rounded-xl bg-success/10 border border-success/30 text-success text-sm">{success}</div>}
      {error && !keyModal && !shopifyModal && <div className="mb-4 p-4 rounded-xl bg-danger/10 border border-danger/30 text-danger text-sm">{error}</div>}

      {!gmailConnected && (
        <div className="mb-6 p-4 rounded-xl bg-warning/10 border border-warning/30 text-sm text-text-2">
          <p className="font-medium text-warning mb-1">Gmail connect requires Google approval</p>
          <p>
            Anyone can <strong>sign in</strong> with Google. Connecting <strong>Gmail</strong> uses sensitive permissions —
            until Google verifies this app, only <strong>test users</strong> added in Google Cloud Console can connect.
            Add their email under Google Auth Platform → Audience → Test users, or submit for verification before a public launch.
          </p>
        </div>
      )}

      {googleAdsConnected && (
        <div className="mb-6 p-4 rounded-xl bg-surface border border-border space-y-3">
          <p className="text-sm text-text-2">Google Ads: add your developer token and customer ID to pull live campaign data.</p>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              value={googleAdsDevToken}
              onChange={(e) => setGoogleAdsDevToken(e.target.value)}
              placeholder="Google Ads developer token"
              className="flex-1 px-4 py-2.5 rounded-xl bg-void border border-border text-sm"
            />
            <input
              value={googleAdsCustomerId}
              onChange={(e) => setGoogleAdsCustomerId(e.target.value)}
              placeholder="Customer ID (e.g. 123-456-7890)"
              className="flex-1 px-4 py-2.5 rounded-xl bg-void border border-border text-sm"
            />
            <button onClick={saveGoogleAdsSettings} className="px-4 py-2.5 rounded-xl bg-accent text-white text-sm font-medium">
              Save Ads settings
            </button>
          </div>
        </div>
      )}

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
          return (
            <div key={int.id} className={cn("p-5 rounded-2xl border", int.connected ? "bg-success/5 border-success/30" : "bg-surface border-border")}>
              <div className="flex items-start gap-4">
                <span className="text-3xl">{int.icon}</span>
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold">{int.name}</h3>
                    {int.connected && <span className="text-xs px-2 py-0.5 rounded-full bg-success/10 text-success"><Check size={10} className="inline" /> Live</span>}
                    {!int.connected && apiMeta[int.id]?.server_ready === false && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-warning/10 text-warning">Railway setup needed</span>
                    )}
                    {testResults[int.id] && (
                      <span
                        className={cn(
                          "text-xs px-2 py-0.5 rounded-full",
                          testResults[int.id].ok ? "bg-success/10 text-success" : "bg-danger/10 text-danger"
                        )}
                      >
                        {testResults[int.id].ok ? "Verified" : "Failed"}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-text-2 mt-1">{apiMeta[int.id]?.description || int.description}</p>
                  {WORKS_WITH[int.id] && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      <span className="text-xs text-text-3">Works with:</span>
                      {WORKS_WITH[int.id].slice(0, 4).map((w) => (
                        <span key={w} className="text-xs px-1.5 py-0.5 rounded bg-white/5 text-text-3">
                          {w}
                        </span>
                      ))}
                    </div>
                  )}
                  {testResults[int.id] && (
                    <p className={cn("text-xs mt-1", testResults[int.id].ok ? "text-success" : "text-danger")}>
                      {testResults[int.id].message}
                    </p>
                  )}
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button
                  onClick={() => (int.connected ? disconnect(int.id) : handleConnect(int.id))}
                  disabled={
                    oauthLoadingId === int.id
                    || (!int.connected && apiMeta[int.id]?.server_ready === false && !isShopifyConnect(int.id))
                  }
                  className={cn("py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2", int.connected ? "bg-surface-2 text-text-2" : "bg-accent text-white disabled:opacity-60")}
                >
                  <Plug size={14} />
                  {oauthLoadingId === int.id
                    ? "Redirecting…"
                    : int.connected
                      ? "Disconnect"
                      : connectLabel(int.id)}
                </button>
                <button
                  onClick={() => testOne(int.id)}
                  disabled={!int.connected || testingMap[int.id]}
                  className="py-2.5 rounded-xl text-sm font-medium border border-border text-text-2 disabled:opacity-40"
                >
                  {testingMap[int.id] ? "Testing..." : "Test"}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {shopifyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
          <div className="w-full max-w-md p-6 rounded-2xl bg-surface border border-border">
            <h3 className="font-bold text-lg mb-4">Connect your Shopify store</h3>
            <input
              value={shopDomain}
              onChange={(e) => setShopDomain(e.target.value)}
              placeholder="yourstore.myshopify.com"
              className="w-full px-4 py-3 rounded-xl bg-void border border-border mb-3"
              autoFocus
            />
            {shopifyModalError && (
              <p className="text-sm text-danger mb-3">{shopifyModalError}</p>
            )}
            <div className="flex gap-2">
              <button onClick={closeShopifyModal} className="flex-1 py-2.5 rounded-xl border border-border text-text-2">
                Cancel
              </button>
              <button
                onClick={() => void connectShopifySimple()}
                disabled={oauthLoadingId === "shopify"}
                className="flex-1 py-2.5 rounded-xl bg-accent text-white font-medium disabled:opacity-60"
              >
                {oauthLoadingId === "shopify" ? "Connecting…" : "Connect"}
              </button>
            </div>
          </div>
        </div>
      )}

      {keyModal && modalMeta && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
          <div className="w-full max-w-md p-6 rounded-2xl bg-surface border border-border max-h-[90vh] overflow-y-auto">
            <h3 className="font-bold text-lg mb-2">Connect {modalMeta.name}</h3>
            {modalMeta.key_hint ? <p className="text-sm text-text-2 mb-4">{modalMeta.key_hint}</p> : null}
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
