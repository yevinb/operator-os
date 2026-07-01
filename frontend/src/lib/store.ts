import type { ActivityItem, CommandResponse, Integration } from "./types";

const ACTIVITY_KEY = "operatoros_activity";
const INTEGRATIONS_KEY = "operatoros_integrations";

export const DEFAULT_INTEGRATIONS: Integration[] = [
  { id: "stripe", name: "Stripe", description: "Revenue, payments, subscriptions", category: "finance", connected: false, icon: "💳" },
  { id: "slack", name: "Slack", description: "Team messages & alerts", category: "communication", connected: false, icon: "💬" },
  { id: "google-ads", name: "Google Ads", description: "Create & manage ad campaigns", category: "marketing", connected: false, icon: "📢" },
  { id: "meta", name: "Meta Ads", description: "Facebook & Instagram campaigns", category: "marketing", connected: false, icon: "📱" },
  { id: "gmail", name: "Gmail", description: "Customer email automation", category: "support", connected: false, icon: "✉️" },
  { id: "calendar", name: "Google Calendar", description: "Book meetings autonomously", category: "operations", connected: false, icon: "📅" },
  { id: "n8n", name: "n8n", description: "Workflow automation engine", category: "automation", connected: false, icon: "⚡" },
  { id: "mcp", name: "MCP Servers", description: "Model Context Protocol tools", category: "automation", connected: false, icon: "🔌" },
  { id: "notion", name: "Notion", description: "Docs, wikis, project tracking", category: "operations", connected: false, icon: "📝" },
  { id: "hubspot", name: "HubSpot", description: "CRM & sales pipeline", category: "sales", connected: false, icon: "🎯" },
  { id: "quickbooks", name: "QuickBooks", description: "Accounting & expenses", category: "finance", connected: false, icon: "📊" },
  { id: "linkedin", name: "LinkedIn", description: "Hiring & B2B outreach", category: "hr", connected: false, icon: "👔" },
  { id: "shopify", name: "Shopify", description: "Full store — orders, products, fulfillments", category: "finance", connected: false, icon: "🛒" },
];

export function getActivity(): ActivityItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(ACTIVITY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function addActivity(item: Omit<ActivityItem, "id" | "timestamp">) {
  const list = getActivity();
  const entry: ActivityItem = {
    ...item,
    id: `act_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    timestamp: new Date().toISOString(),
  };
  list.unshift(entry);
  localStorage.setItem(ACTIVITY_KEY, JSON.stringify(list.slice(0, 200)));
  return entry;
}

export function logCommand(response: CommandResponse) {
  const executed = response.executed_count ?? response.tasks.filter((t) => t.status === "completed").length;
  const planned = response.planned_count ?? response.tasks.filter((t) => t.status === "planned").length;

  addActivity({
    type: "command",
    message: response.summary,
    category: response.intent,
    command: response.command,
  });
  response.tasks.forEach((t) => {
    addActivity({
      type: t.status === "completed" ? "action" : "alert",
      message: t.detail ? `${t.action} — ${t.detail}` : t.action,
      category: t.category,
      command: response.command,
    });
  });
  addActivity({
    type: executed > 0 ? "success" : "alert",
    message: executed > 0
      ? `${executed} live action(s) executed, ${planned} planned`
      : `${planned} action(s) planned — connect integrations to execute`,
    category: response.intent,
    command: response.command,
  });
}

export function getIntegrations(): Integration[] {
  if (typeof window === "undefined") return DEFAULT_INTEGRATIONS;
  try {
    const raw = localStorage.getItem(INTEGRATIONS_KEY);
    if (!raw) return DEFAULT_INTEGRATIONS;
    return JSON.parse(raw);
  } catch {
    return DEFAULT_INTEGRATIONS;
  }
}

export function toggleIntegration(id: string): Integration[] {
  const list = getIntegrations().map((i) =>
    i.id === id ? { ...i, connected: !i.connected } : i
  );
  localStorage.setItem(INTEGRATIONS_KEY, JSON.stringify(list));
  if (list.find((i) => i.id === id)?.connected) {
    addActivity({
      type: "integration",
      message: `Connected ${list.find((i) => i.id === id)?.name}`,
      category: "integrations",
    });
  }
  return list;
}

export function connectedCount(): number {
  return getIntegrations().filter((i) => i.connected).length;
}
