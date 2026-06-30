import type { BusinessMetrics, CommandResponse, Task } from "./types";

const INTENT_MAP: Record<string, { intent: string; summary: string; tasks: Omit<Task, "id" | "status">[] }> = {
  sales: {
    intent: "grow_revenue",
    summary: "Launching full sales acceleration pipeline across ads, outreach, and conversion optimization.",
    tasks: [
      { action: "Analyze sales funnel drop-off points", category: "analytics" },
      { action: "Create 3 high-converting ad variants", category: "marketing" },
      { action: "Launch Google & Meta campaigns ($500/day)", category: "marketing" },
      { action: "Send personalized follow-ups to 47 warm leads", category: "sales" },
      { action: "A/B test landing page headline", category: "marketing" },
      { action: "Set up conversion tracking pixels", category: "analytics" },
      { action: "Schedule daily performance report", category: "reporting" },
    ],
  },
  company: {
    intent: "run_company",
    summary: "Executing full company operations review and autonomous management cycle.",
    tasks: [
      { action: "Check revenue vs. forecast ($124K MTD, +12%)", category: "finance" },
      { action: "Review team performance dashboards", category: "hr" },
      { action: "Schedule 3 priority meetings this week", category: "operations" },
      { action: "Flag underperforming vendor contract", category: "finance" },
      { action: "Generate cash flow forecast (90 days)", category: "finance" },
      { action: "Reply to 8 pending Slack messages", category: "communication" },
      { action: "Update project timelines in Asana", category: "operations" },
      { action: "Create executive summary report", category: "reporting" },
    ],
  },
  marketing: {
    intent: "run_marketing",
    summary: "Spinning up multi-channel marketing automation.",
    tasks: [
      { action: "Draft weekly newsletter (2,400 subscribers)", category: "marketing" },
      { action: "Post to LinkedIn, X, and Instagram", category: "marketing" },
      { action: "Optimize SEO for top 5 landing pages", category: "marketing" },
      { action: "Retarget website visitors with display ads", category: "marketing" },
      { action: "Analyze competitor ad spend", category: "analytics" },
    ],
  },
  customers: {
    intent: "customer_success",
    summary: "Handling customer communications and support autonomously.",
    tasks: [
      { action: "Reply to 23 customer emails", category: "support" },
      { action: "Resolve 5 open support tickets", category: "support" },
      { action: "Send onboarding sequence to 12 new signups", category: "sales" },
      { action: "Request reviews from satisfied customers", category: "marketing" },
      { action: "Flag churn-risk accounts for outreach", category: "analytics" },
    ],
  },
  hire: {
    intent: "hiring",
    summary: "Initiating hiring pipeline for open positions.",
    tasks: [
      { action: "Post job listing on LinkedIn & Indeed", category: "hr" },
      { action: "Screen 34 incoming applications", category: "hr" },
      { action: "Schedule interviews with top 5 candidates", category: "hr" },
      { action: "Draft offer letter template", category: "hr" },
      { action: "Update org chart and headcount forecast", category: "operations" },
    ],
  },
  report: {
    intent: "reporting",
    summary: "Generating comprehensive business intelligence report.",
    tasks: [
      { action: "Pull revenue data from Stripe", category: "finance" },
      { action: "Compile marketing ROI by channel", category: "analytics" },
      { action: "Summarize team productivity metrics", category: "hr" },
      { action: "Generate PDF executive dashboard", category: "reporting" },
      { action: "Email report to stakeholders", category: "communication" },
    ],
  },
  default: {
    intent: "general_ops",
    summary: "Analyzing your request and deploying autonomous actions across your business.",
    tasks: [
      { action: "Parse command intent and priority", category: "operations" },
      { action: "Check relevant business data", category: "analytics" },
      { action: "Queue autonomous action plan", category: "operations" },
      { action: "Execute highest-impact tasks first", category: "operations" },
      { action: "Monitor results and self-improve", category: "analytics" },
    ],
  },
};

function detectIntent(command: string): keyof typeof INTENT_MAP {
  const lower = command.toLowerCase();
  if (/sales|revenue|grow|increase|sell/.test(lower)) return "sales";
  if (/company|run my|operate|manage/.test(lower)) return "company";
  if (/market|ads|campaign|newsletter|social/.test(lower)) return "marketing";
  if (/customer|support|reply|email|client/.test(lower)) return "customers";
  if (/hire|recruit|team|employee/.test(lower)) return "hire";
  if (/report|dashboard|summary|analytics/.test(lower)) return "report";
  return "default";
}

export function demoExecuteCommand(command: string): CommandResponse {
  const key = detectIntent(command);
  const template = INTENT_MAP[key];
  const now = Date.now();

  return {
    command,
    intent: template.intent,
    summary: template.summary,
    tasks: template.tasks.map((t, i) => ({
      ...t,
      id: `task-${now}-${i}`,
      status: "pending" as const,
    })),
  };
}

export const DEMO_METRICS: BusinessMetrics = {
  revenue: 124500,
  revenueChange: 12.4,
  customers: 847,
  customersChange: 8.2,
  conversionRate: 3.8,
  conversionChange: 0.6,
  activeCampaigns: 6,
  pendingTasks: 14,
  aiActionsToday: 127,
};
