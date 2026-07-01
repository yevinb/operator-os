export type Plan = "starter" | "business" | "enterprise";

export type TaskStatus = "pending" | "running" | "completed" | "failed" | "planned";

export interface Task {
  id: string;
  action: string;
  category: string;
  status: TaskStatus;
  detail?: string;
  integration?: string;
  completedAt?: string;
}

export interface CommandResponse {
  command: string;
  intent: string;
  summary: string;
  tasks: Task[];
  executed_count?: number;
  planned_count?: number;
  failed_count?: number;
  mode?: "live" | "demo";
  metrics?: Record<string, string | number>;
  marketing_plan?: string;
  plan_id?: number;
  outcome?: { kind?: string; target?: string; label?: string };
}

export interface NicheMode {
  id: string;
  label: string;
  emoji: string;
  tagline: string;
  sample_outcomes: string[];
}

export interface BusinessIdea {
  idea: string;
  niche: string;
  niche_label: string;
  suggested_command: string;
  first_steps: string[];
}

export interface CheckIn {
  message: string;
  suggested_command: string;
  niche: string;
  date: string;
}

export interface ActivePlan {
  active: boolean;
  id?: number;
  command?: string;
  summary?: string;
  marketing_plan?: string;
  outcome?: Record<string, string>;
  tasks?: Task[];
  executed_count?: number;
  created_at?: string;
}

export interface BusinessMetrics {
  revenue: number;
  revenueChange: number;
  customers: number;
  customersChange: number;
  conversionRate: number;
  conversionChange: number;
  activeCampaigns: number;
  pendingTasks: number;
  aiActionsToday: number;
  stripeConnected?: boolean;
  dataSource?: "stripe" | "commands" | "none";
}

export interface ActivityItem {
  id: string;
  type: "command" | "action" | "alert" | "success" | "integration";
  message: string;
  timestamp: string;
  category?: string;
  command?: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  company: string;
  plan: Plan;
  onboarded: boolean;
  createdAt: string;
  industry?: string;
  goal?: string;
  market?: string;
  description?: string;
  website?: string;
  niche_mode?: string;
}

export interface BusinessContext {
  company: string;
  industry: string;
  goal: string;
  market: string;
  description?: string;
  website?: string;
  connectedIntegrations?: string[];
  niche_mode?: string;
}

export interface Integration {
  id: string;
  name: string;
  description: string;
  category: string;
  connected: boolean;
  icon: string;
}

export interface PlanDetails {
  id: Plan;
  name: string;
  price: number;
  desc: string;
  features: string[];
}
