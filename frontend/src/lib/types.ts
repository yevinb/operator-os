export type Plan = "starter" | "business" | "enterprise";

export type TaskStatus = "pending" | "running" | "completed" | "failed";

export interface Task {
  id: string;
  action: string;
  category: string;
  status: TaskStatus;
  detail?: string;
  startedAt?: string;
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
  type: "command" | "action" | "alert" | "success";
  message: string;
  timestamp: string;
  category?: string;
}
