"use client";

import { useCallback, useEffect, useState } from "react";
import { Activity, Zap, CheckCircle2, AlertCircle, Plug, RefreshCw } from "lucide-react";
import { getActivity, type ActivityItem } from "@/lib/api";
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setError("");
      const data = await getActivity(50);
      setItems(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load activity");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, [load]);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold mb-1">Activity Log</h1>
          <p className="text-text-2 text-sm">Every command and autonomous action Nexa takes — synced from your account.</p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-1.5 text-xs rounded-lg border border-border hover:border-accent/40 disabled:opacity-50"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="mb-4 p-4 rounded-xl bg-danger/10 border border-danger/30 text-danger text-sm">{error}</div>
      )}

      {loading && items.length === 0 ? (
        <div className="text-center py-16 text-text-2">Loading activity…</div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 rounded-2xl bg-surface border border-border">
          <Activity size={40} className="mx-auto text-text-3 mb-4" />
          <p className="text-text-2">No activity yet.</p>
          <p className="text-text-3 text-sm mt-1">Run a command in Nexa Chat or Command Center.</p>
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
                  {item.command && item.command !== item.message && (
                    <p className="text-xs text-text-3 mb-1 truncate">&ldquo;{item.command}&rdquo;</p>
                  )}
                  <p className="text-sm text-text">{item.message}</p>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {item.category && (
                      <span className="text-xs text-text-3 capitalize">{item.category}</span>
                    )}
                    {typeof item.completed === "number" && item.completed > 0 && (
                      <span className="text-xs text-success">{item.completed} verified</span>
                    )}
                    {typeof item.failed === "number" && item.failed > 0 && (
                      <span className="text-xs text-danger">{item.failed} failed</span>
                    )}
                    <span className="text-xs text-text-3">
                      {item.timestamp ? new Date(item.timestamp).toLocaleString() : ""}
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
