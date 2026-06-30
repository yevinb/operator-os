"use client";

import { useEffect, useState } from "react";
import {
  CheckCircle2,
  Circle,
  Loader2,
  XCircle,
  Megaphone,
  Headphones,
  BarChart3,
  Users,
  DollarSign,
  MessageSquare,
  Settings,
  FileText,
} from "lucide-react";
import type { Task, TaskStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  marketing: Megaphone,
  support: Headphones,
  analytics: BarChart3,
  hr: Users,
  finance: DollarSign,
  communication: MessageSquare,
  operations: Settings,
  reporting: FileText,
  sales: TrendingUpIcon,
};

function TrendingUpIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} {...props}>
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
      <polyline points="17 6 23 6 23 12" />
    </svg>
  );
}

function StatusIcon({ status }: { status: TaskStatus }) {
  switch (status) {
    case "completed":
      return <CheckCircle2 size={18} className="text-success shrink-0" />;
    case "running":
      return <Loader2 size={18} className="text-accent animate-spin shrink-0" />;
    case "failed":
      return <XCircle size={18} className="text-danger shrink-0" />;
    default:
      return <Circle size={18} className="text-text-3 shrink-0" />;
  }
}

interface TaskListProps {
  tasks: Task[];
  animate?: boolean;
}

export function TaskList({ tasks, animate = true }: TaskListProps) {
  const [displayTasks, setDisplayTasks] = useState<Task[]>(
    animate ? tasks.map((t) => ({ ...t, status: "pending" as TaskStatus })) : tasks
  );

  useEffect(() => {
    if (!animate) {
      setDisplayTasks(tasks);
      return;
    }

    setDisplayTasks(tasks.map((t) => ({ ...t, status: "pending" as TaskStatus })));

    let index = 0;
    const interval = setInterval(() => {
      if (index >= tasks.length) {
        clearInterval(interval);
        return;
      }

      setDisplayTasks((prev) =>
        prev.map((t, i) => {
          if (i < index) return { ...t, status: "completed" };
          if (i === index) return { ...t, status: "running" };
          return t;
        })
      );

      setTimeout(() => {
        setDisplayTasks((prev) =>
          prev.map((t, i) => (i === index ? { ...t, status: "completed" } : t))
        );
        index++;
      }, 800);
    }, 1000);

    return () => clearInterval(interval);
  }, [tasks, animate]);

  if (displayTasks.length === 0) return null;

  return (
    <div className="space-y-2">
      {displayTasks.map((task, i) => {
        const Icon = CATEGORY_ICONS[task.category] || Settings;
        return (
          <div
            key={task.id}
            className={cn(
              "flex items-center gap-3 p-4 rounded-xl border transition-all duration-300 activity-slide-in",
              task.status === "running" && "bg-accent/5 border-accent/30",
              task.status === "completed" && "bg-surface border-border opacity-80",
              task.status === "pending" && "bg-surface border-border"
            )}
            style={{ animationDelay: `${i * 50}ms` }}
          >
            <StatusIcon status={task.status} />
            <div className="p-1.5 rounded-lg bg-surface-2">
              <Icon size={14} className="text-text-2" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-text truncate">{task.action}</p>
              <p className="text-xs text-text-3 capitalize">{task.category}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
