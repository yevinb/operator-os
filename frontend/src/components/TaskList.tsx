"use client";

import { useEffect, useState } from "react";
import {
  CheckCircle2,
  Circle,
  Loader2,
  XCircle,
  Clock,
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
    case "planned":
      return <Clock size={18} className="text-warning shrink-0" />;
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
  isDemo?: boolean;
}

export function TaskList({ tasks, animate = true, isDemo = false }: TaskListProps) {
  const hasServerStatus = tasks.some((t) => t.status === "completed" || t.status === "planned" || t.status === "failed");
  const shouldAnimate = animate && !hasServerStatus && !isDemo;

  const [displayTasks, setDisplayTasks] = useState<Task[]>(
    shouldAnimate ? tasks.map((t) => ({ ...t, status: "pending" as TaskStatus })) : tasks
  );

  useEffect(() => {
    if (!shouldAnimate) {
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
          if (i < index) return { ...t, status: isDemo ? "planned" : "completed" };
          if (i === index) return { ...t, status: "running" };
          return t;
        })
      );

      setTimeout(() => {
        setDisplayTasks((prev) =>
          prev.map((t, i) =>
            i === index
              ? {
                  ...t,
                  status: isDemo ? "planned" : "completed",
                  detail: isDemo ? "Demo preview — sign up to execute" : t.detail,
                }
              : t
          )
        );
        index++;
      }, 800);
    }, 1000);

    return () => clearInterval(interval);
  }, [tasks, shouldAnimate, isDemo]);

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
              task.status === "completed" && "bg-success/5 border-success/30",
              task.status === "planned" && "bg-warning/5 border-warning/30",
              task.status === "failed" && "bg-danger/5 border-danger/30",
              task.status === "pending" && "bg-surface border-border"
            )}
            style={{ animationDelay: `${i * 50}ms` }}
          >
            <StatusIcon status={task.status} />
            <div className="p-1.5 rounded-lg bg-surface-2">
              <Icon size={14} className="text-text-2" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-text">{task.action}</p>
              {task.detail && (
                <p
                  className={cn(
                    "text-xs mt-0.5",
                    task.status === "completed" && "text-success",
                    task.status === "planned" && "text-warning",
                    task.status === "failed" && "text-danger",
                    task.status !== "completed" && task.status !== "planned" && task.status !== "failed" && "text-text-3"
                  )}
                >
                  {task.detail}
                </p>
              )}
              <div className="flex gap-2 mt-0.5">
                <p className="text-xs text-text-3 capitalize">{task.category}</p>
                {task.integration && (
                  <p className="text-xs text-accent">via {task.integration}</p>
                )}
                {task.status === "completed" && task.verified && (
                  <p className="text-xs text-success">LIVE VERIFIED</p>
                )}
                {task.status === "completed" && !task.verified && (
                  <p className="text-xs text-warning">COMPLETED (UNVERIFIED)</p>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
