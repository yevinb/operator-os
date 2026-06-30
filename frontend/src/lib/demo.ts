import type { BusinessMetrics, CommandResponse, Task, BusinessContext } from "./types";

const INTENT_MAP: Record<string, { intent: string; summary: string; tasks: Omit<Task, "id" | "status" | "detail">[] }> = {
  sales: {
    intent: "grow_revenue",
    summary: "Preview: sales plan — sign up and connect Stripe, Slack, or n8n to run this for real.",
    tasks: [
      { action: "Pull live revenue from Stripe", category: "finance" },
      { action: "Post sales update to Slack", category: "communication" },
      { action: "Trigger sales workflow in n8n", category: "operations" },
    ],
  },
  company: {
    intent: "run_company",
    summary: "Preview: company ops — connect integrations to execute live.",
    tasks: [
      { action: "Check Stripe balance", category: "finance" },
      { action: "Post ops summary to Slack", category: "communication" },
      { action: "Schedule meetings on Calendar", category: "operations" },
    ],
  },
  marketing: {
    intent: "run_marketing",
    summary: "Preview: marketing — connect Meta, Google Ads, or n8n.",
    tasks: [
      { action: "Check Meta ad account", category: "marketing" },
      { action: "Post campaign update to Slack", category: "communication" },
    ],
  },
  customers: {
    intent: "customer_success",
    summary: "Preview: customer support — connect Gmail or HubSpot.",
    tasks: [
      { action: "Send customer email via Gmail", category: "support" },
      { action: "Pull CRM from HubSpot", category: "sales" },
    ],
  },
  hire: {
    intent: "hiring",
    summary: "Preview: hiring — connect LinkedIn and Calendar.",
    tasks: [
      { action: "Verify LinkedIn for hiring", category: "hr" },
      { action: "Schedule interviews on Calendar", category: "operations" },
    ],
  },
  report: {
    intent: "reporting",
    summary: "Preview: reporting — connect Stripe and Notion.",
    tasks: [
      { action: "Pull revenue from Stripe", category: "finance" },
      { action: "Create report in Notion", category: "reporting" },
    ],
  },
  cashflow: {
    intent: "cash_flow",
    summary: "Preview: cash flow — connect Stripe or QuickBooks.",
    tasks: [
      { action: "Pull Stripe balance", category: "finance" },
      { action: "Sync QuickBooks data", category: "finance" },
    ],
  },
  vendor: {
    intent: "vendor_management",
    summary: "Preview: vendor ops — connect Notion and Slack.",
    tasks: [
      { action: "Log vendor audit in Notion", category: "operations" },
      { action: "Post update to Slack", category: "communication" },
    ],
  },
  meetings: {
    intent: "scheduling",
    summary: "Preview: scheduling — connect Google Calendar.",
    tasks: [
      { action: "Book meeting on Calendar", category: "operations" },
      { action: "Send invite via Gmail", category: "communication" },
    ],
  },
  slack: {
    intent: "communication",
    summary: "Preview: Slack — connect your webhook to post live.",
    tasks: [
      { action: "Post update to Slack", category: "communication" },
    ],
  },
  default: {
    intent: "general_ops",
    summary: "Preview: sign up free, connect tools, then commands run on real APIs.",
    tasks: [
      { action: "Check live business data", category: "analytics" },
      { action: "Run via n8n automation", category: "operations" },
    ],
  },
};

function detectIntent(command: string): keyof typeof INTENT_MAP {
  const lower = command.toLowerCase();
  if (/sales|revenue|grow|increase|sell/.test(lower)) return "sales";
  if (/company|run my|operate|manage/.test(lower)) return "company";
  if (/market|ads|campaign|newsletter|social/.test(lower)) return "marketing";
  if (/customer|support|reply|email|client/.test(lower)) return "customers";
  if (/hire|recruit|employee|developer|salesperson/.test(lower)) return "hire";
  if (/report|dashboard|summary/.test(lower)) return "report";
  if (/cash|flow|runway|forecast/.test(lower)) return "cashflow";
  if (/vendor|fire|terminate|contract/.test(lower)) return "vendor";
  if (/meeting|schedule|calendar|book/.test(lower)) return "meetings";
  if (/slack|message|team/.test(lower)) return "slack";
  return "default";
}

export function demoExecuteCommand(command: string, context?: BusinessContext): CommandResponse {
  const key = detectIntent(command);
  const template = INTENT_MAP[key];
  const now = Date.now();

  const tasks: Task[] = template.tasks.map((t, i) => ({
    ...t,
    id: `task-${now}-${i}`,
    status: "planned" as const,
    detail: "Demo preview — sign up & connect integrations to execute",
  }));

  return {
    command,
    intent: template.intent,
    summary: template.summary,
    tasks,
    executed_count: 0,
    planned_count: tasks.length,
    failed_count: 0,
    mode: "demo",
  };
}

export const EMPTY_METRICS: BusinessMetrics = {
  revenue: 0,
  revenueChange: 0,
  customers: 0,
  customersChange: 0,
  conversionRate: 0,
  conversionChange: 0,
  activeCampaigns: 0,
  pendingTasks: 0,
  aiActionsToday: 0,
  stripeConnected: false,
  dataSource: "none",
};

/** @deprecated use EMPTY_METRICS */
export const DEMO_METRICS = EMPTY_METRICS;
