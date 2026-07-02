import { apiFetch } from "./api";

export type BrainSource = {
  id: string;
  label: string;
  type: string;
};

export type BrainAgent = {
  id: string;
  tag: string;
  name: string;
  description: string;
  outcome: string;
  integrations: string[];
  status: "active" | "needs_setup";
  schedule?: string;
};

export type BrainStatus = {
  company: string;
  goal: string;
  tagline: string;
  days_learned: number;
  memory_entries: number;
  learned_today: boolean;
  agents_active: number;
  agents_total: number;
  agents_run_today: number;
  sources: BrainSource[];
  connected_integrations: string[];
  narrative: string;
  autopilot_24_7: boolean;
  model: string;
  competitors?: string[];
  brand_keywords?: string[];
};

export type DailyBrief = {
  headline: string;
  action: string;
  why: string;
  insights: string[];
  day_key: string;
  generated_at?: string;
};

export type WeeklyReport = {
  week_key: string;
  title: string;
  summary?: string;
  highlights: string[];
  top_deliverables: string[];
  next_week_focus: string;
  wins?: string[];
  risks?: string[];
  next_week_priorities?: string[];
};

export type BrainFeedItem = {
  id: number;
  agent_id: string;
  asset_type: string;
  title: string;
  body: Record<string, unknown>;
  created_at: string;
};

export type AgentRunResult = {
  ok: boolean;
  error?: string;
  needs_integrations?: string[];
  agent_id?: string;
  agent_name?: string;
  summary?: string;
  deliverable?: Record<string, unknown>;
  executions?: { channel: string; ok: boolean; message?: string }[];
  intel_used?: Record<string, number | boolean>;
};

export type RunAllResult = {
  ok: boolean;
  ran: number;
  skipped: number;
  results: { agent_id: string; name: string; summary?: string }[];
  errors: { agent_id: string; error?: string }[];
};

export async function getBrainStatus(): Promise<BrainStatus> {
  return apiFetch<BrainStatus>("/api/v1/brain/status");
}

export async function getBrainAgents(): Promise<{ agents: BrainAgent[] }> {
  return apiFetch<{ agents: BrainAgent[] }>("/api/v1/brain/agents");
}

export async function getDailyBrief(refresh = false): Promise<DailyBrief> {
  return apiFetch<DailyBrief>(`/api/v1/brain/daily-brief?refresh=${refresh}`);
}

export async function getWeeklyReport(refresh = false): Promise<WeeklyReport> {
  return apiFetch<WeeklyReport>(`/api/v1/brain/weekly-report?refresh=${refresh}`);
}

export async function getBrainFeed(limit = 30): Promise<{ items: BrainFeedItem[] }> {
  return apiFetch<{ items: BrainFeedItem[] }>(`/api/v1/brain/feed?limit=${limit}`);
}

export async function triggerBrainLearn(force = false): Promise<{ ok: boolean }> {
  return apiFetch<{ ok: boolean }>(`/api/v1/brain/learn?force=${force}`, { method: "POST" });
}

export async function runBrainAgent(agentId: string): Promise<AgentRunResult> {
  return apiFetch<AgentRunResult>(`/api/v1/brain/agents/${agentId}/run`, { method: "POST" });
}

export async function runAllBrainAgents(): Promise<RunAllResult> {
  return apiFetch<RunAllResult>("/api/v1/brain/run-all", { method: "POST" });
}

export async function runMorningCycle(): Promise<Record<string, unknown>> {
  return apiFetch<Record<string, unknown>>("/api/v1/brain/morning-cycle", { method: "POST" });
}

export type BrainConfig = {
  competitors: string[];
  brand_keywords: string[];
  auto_run_daily: boolean;
  last_auto_run_key: string;
  enabled_agents: string[];
};

export async function getBrainConfig(): Promise<BrainConfig> {
  return apiFetch<BrainConfig>("/api/v1/brain/config");
}

export async function updateBrainConfig(patch: Partial<BrainConfig>): Promise<BrainConfig> {
  return apiFetch<BrainConfig>("/api/v1/brain/config", {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export async function ingestBrainUrl(url: string): Promise<{ ok: boolean; summary: string }> {
  return apiFetch<{ ok: boolean; summary: string }>("/api/v1/brain/ingest-url", {
    method: "POST",
    body: JSON.stringify({ url }),
  });
}
