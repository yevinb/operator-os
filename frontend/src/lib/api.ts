import type { BusinessMetrics, CommandResponse } from "./types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const FETCH_TIMEOUT_MS = 2000;

export function isLocalBackend(): boolean {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname;
  return host === "localhost" || host === "127.0.0.1";
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
  const res = await fetchWithTimeout(`${API_URL}/api/v1/command`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ command }),
  });

  if (!res.ok) throw new Error("Failed to execute command");
  return res.json();
}

export async function getMetrics(): Promise<BusinessMetrics> {
  const res = await fetchWithTimeout(`${API_URL}/api/v1/metrics`);
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
}

export async function getHealth(): Promise<{ status: string; ai_provider: string }> {
  const res = await fetchWithTimeout(`${API_URL}/api/v1/health`);
  if (!res.ok) throw new Error("Backend unavailable");
  return res.json();
}

/** Run command — uses backend only on localhost, demo everywhere else (GitHub Pages). */
export async function runCommand(command: string): Promise<CommandResponse> {
  const { demoExecuteCommand } = await import("./demo");

  if (!isLocalBackend()) {
    return demoExecuteCommand(command);
  }

  try {
    await getHealth();
    return await executeCommand(command);
  } catch {
    return demoExecuteCommand(command);
  }
}
