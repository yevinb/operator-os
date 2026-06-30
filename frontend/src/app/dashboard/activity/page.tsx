"use client";

import { useEffect, useState } from "react";
import { Activity, Zap, CheckCircle2, AlertCircle, Plug } from "lucide-react";
import { getActivity } from "@/lib/store";
import type { ActivityItem } from "@/lib/types";
import { cn } from "@/lib/utils";

const ICONS = {
  command: Zap,
  action: Activity,
  success: CheckCircle2,
  alert: AlertCircle,
  integration: Plug,
};

export default function ActivityPage() {
  const [items, setItems] = useState<ActivityItem[]>([]);

  useEffect(() => {
    setItems(getActivity());
    const interval = setInterval(() => setItems(getActivity()), 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-1">Activity Log</h1>
      <p className="text-text-2 text-sm mb-8">Every command and autonomous action your AI COO takes.</p>

      {items.length === 0 ? (
        <div className="text-center py-16 rounded-2xl bg-surface border border-border">
          <Activity size={40} className="mx-auto text-text-3 mb-4" />
          <p className="text-text-2">No activity yet.</p>
          <p className="text-text-3 text-sm mt-1">Go to Command Center and say &ldquo;Increase sales.&rdquo;</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => {
            const Icon = ICONS[item.type] || Activity;
            return (
              <div
                key={item.id}
                className="flex items-start gap-4 p-4 rounded-xl bg-surface border border-border"
              >
                <div
                  className={cn(
                    "p-2 rounded-lg shrink-0",
                    item.type === "success" && "bg-success/10 text-success",
                    item.type === "command" && "bg-accent/10 text-accent",
                    item.type === "action" && "bg-surface-2 text-text-2",
                    item.type === "alert" && "bg-danger/10 text-danger",
                    item.type === "integration" && "bg-warning/10 text-warning"
                  )}
                >
                  <Icon size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-text">{item.message}</p>
                  <div className="flex gap-2 mt-1">
                    {item.category && (
                      <span className="text-xs text-text-3 capitalize">{item.category}</span>
                    )}
                    <span className="text-xs text-text-3">
                      {new Date(item.timestamp).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
