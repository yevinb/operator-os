export type Plan = "starter" | "business" | "enterprise";

export type TaskStatus = "pending" | "running" | "completed" | "failed";

export interface Task {
  id: string;
  action: string;
  category: string;
  status: TaskStatus;
  detail?: string;
  completedAt?: string;
}

export interface CommandResponse {
  command: string;
  intent: string;
  summary: string;
  tasks: Task[];
  metrics?: Record<string, string | number>;
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
}

export interface BusinessContext {
  company: string;
  industry: string;
  goal: string;
  market: string;
  description?: string;
  website?: string;
  connectedIntegrations?: string[];
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
