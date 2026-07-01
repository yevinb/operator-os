import type { BusinessMetrics, CommandResponse } from "./types";
import { demoExecuteCommand } from "./demo";
import { getBusinessContext } from "./business-context";
import { getToken } from "./auth";
import { getApiUrlSync, initApiConfig } from "./api-config";

const FETCH_TIMEOUT_MS = 20000;

async function apiUrl(): Promise<string> {
  await initApiConfig();
  return getApiUrlSync();
}

export function getApiUrl(): string {
  return getApiUrlSync();
}

export async function hasApiConfigured(): Promise<boolean> {
  await initApiConfig();
  const url = getApiUrlSync();
  if (!url) return false;
  if (url === "http://localhost:8000" && typeof window !== "undefined") {
    const host = window.location.hostname;
    if (host !== "localhost" && host !== "127.0.0.1") return false;
  }
  return true;
}

function authHeaders(): HeadersInit {
  const token = getToken();
  const headers: HeadersInit = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs = FETCH_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function executeCommand(command: string): Promise<CommandResponse> {
  const base = await apiUrl();
  const res = await fetchWithTimeout(`${base}/api/v1/command`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ command }),
  });

  if (res.status === 401) throw new Error("Session expired — please sign in again.");
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { detail?: string }).detail || "Command failed");
  }
  return res.json();
}

export async function getMetrics(): Promise<BusinessMetrics> {
  if (!(await hasApiConfigured()) || !getToken()) {
    return (await import("./demo")).EMPTY_METRICS;
  }

  try {
    const base = await apiUrl();
    const res = await fetchWithTimeout(`${base}/api/v1/metrics`, { headers: authHeaders() });
    if (!res.ok) throw new Error("Failed to fetch metrics");
    const data = await res.json();
    return {
      revenue: data.revenue,
      revenueChange: data.revenue_change,
      customers: data.customers,
      customersChange: data.customers_change,
      conversionRate: data.conversion_rate,
      conversionChange: data.conversion_change,
      activeCampaigns: data.active_campaigns,
      pendingTasks: data.pending_tasks,
      aiActionsToday: data.ai_actions_today,
      stripeConnected: data.stripe_connected,
      dataSource: data.data_source,
    };
  } catch {
    return (await import("./demo")).EMPTY_METRICS;
  }
}

export async function getHealth(): Promise<{ status: string; ai_provider: string; version?: string }> {
  const base = await apiUrl();
  const res = await fetchWithTimeout(`${base}/api/v1/health`);
  if (!res.ok) throw new Error("Backend unavailable");
  return res.json();
}

/** Run command on Railway when logged in; demo on homepage only. */
export async function runCommand(command: string, options?: { forceDemo?: boolean }): Promise<CommandResponse> {
  await initApiConfig();
  const context = getBusinessContext();
  const token = getToken();

  if (!options?.forceDemo && token && (await hasApiConfigured())) {
    return executeCommand(command);
  }

  return demoExecuteCommand(command, context);
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const base = await apiUrl();
  const res = await fetchWithTimeout(`${base}${path}`, {
    ...options,
    headers: { ...authHeaders(), ...options.headers },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { detail?: string }).detail || `API error ${res.status}`);
  }
  return res.json();
}

export { initApiConfig };

export async function getNiches() {
  return apiFetch<import("./types").NicheMode[]>("/api/v1/nexa/niches");
}

export async function rollBusinessIdea() {
  return apiFetch<import("./types").BusinessIdea>("/api/v1/nexa/business-idea");
}

export async function getCheckIn() {
  return apiFetch<import("./types").CheckIn>("/api/v1/nexa/check-in");
}

export async function getActivePlan() {
  return apiFetch<import("./types").ActivePlan>("/api/v1/nexa/plan");
}

export async function setNicheMode(nicheId: string) {
  return apiFetch<{ niche_mode: string; label: string }>(`/api/v1/nexa/niche/${nicheId}`, {
    method: "PATCH",
  });
}

export async function coachChat(message: string, step: number) {
  return apiFetch<{ reply: string; next_step: number; done?: boolean; suggested_command?: string; niche_mode?: string; hint?: string }>(
    "/api/v1/nexa/coach",
    { method: "POST", body: JSON.stringify({ message, step }) }
  );
}

export async function nexaChat(message: string, history: { role: string; content: string }[]) {
  const data = await apiFetch<{
    reply: string;
    executed: boolean;
    command_response?: Record<string, unknown>;
  }>("/api/v1/nexa/chat", {
    method: "POST",
    body: JSON.stringify({ message, history }),
  });

  return {
    reply: data.reply,
    executed: data.executed,
    command_response: data.command_response
      ? {
          command: String(data.command_response.command || ""),
          intent: String(data.command_response.intent || ""),
          summary: String(data.command_response.summary || ""),
          tasks: (data.command_response.tasks as import("./types").Task[]) || [],
          executed_count: Number(data.command_response.executed_count || 0),
          planned_count: Number(data.command_response.planned_count || 0),
          failed_count: Number(data.command_response.failed_count || 0),
          mode: data.command_response.mode as import("./types").CommandResponse["mode"],
          marketing_plan: data.command_response.marketing_plan as string | undefined,
          plan_id: data.command_response.plan_id as number | undefined,
          outcome: data.command_response.outcome as import("./types").CommandResponse["outcome"],
        }
      : undefined,
  };
}
