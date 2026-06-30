import type { BusinessMetrics, CommandResponse } from "./types";
import { demoExecuteCommand } from "./demo";
import { getBusinessContext } from "./business-context";
import { getToken } from "./auth";
import { getApiUrlSync, initApiConfig } from "./api-config";

const FETCH_TIMEOUT_MS = 15000;

async function apiUrl(): Promise<string> {
  await initApiConfig();
  return getApiUrlSync();
}

export function getApiUrl(): string {
  return getApiUrlSync();
}

export function hasApiConfigured(): boolean {
  const url = getApiUrlSync();
  return Boolean(url) && url !== "http://localhost:8000" || typeof window !== "undefined" && window.location.hostname === "localhost";
}

export function isLocalBackend(): boolean {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname;
  return host === "localhost" || host === "127.0.0.1";
}

export function shouldUseBackend(): boolean {
  const url = getApiUrlSync();
  if (!url) return false;
  if (url === "http://localhost:8000" && typeof window !== "undefined" && !isLocalBackend()) {
    return false;
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

  if (res.status === 401) throw new Error("Unauthorized");
  if (!res.ok) throw new Error("Failed to execute command");
  return res.json();
}

export async function getMetrics(): Promise<BusinessMetrics> {
  await initApiConfig();
  if (!shouldUseBackend() || !getToken()) {
    return (await import("./demo")).DEMO_METRICS;
  }

  try {
    const base = await apiUrl();
    const res = await fetchWithTimeout(`${base}/api/v1/metrics`, {
      headers: authHeaders(),
    });
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
    };
  } catch {
    return (await import("./demo")).DEMO_METRICS;
  }
}

export async function getHealth(): Promise<{ status: string; ai_provider: string; version?: string }> {
  const base = await apiUrl();
  const res = await fetchWithTimeout(`${base}/api/v1/health`);
  if (!res.ok) throw new Error("Backend unavailable");
  return res.json();
}

export async function runCommand(command: string): Promise<CommandResponse> {
  await initApiConfig();
  const context = getBusinessContext();

  if (shouldUseBackend() && getToken()) {
    try {
      return await executeCommand(command);
    } catch {
      // fall through to demo
    }
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
