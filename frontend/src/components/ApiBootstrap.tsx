"use client";

import { useEffect, useState } from "react";
import { initApiConfig, getApiUrlSync } from "@/lib/api-config";
import { getHealth } from "@/lib/api";

export function ApiBootstrap({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    initApiConfig();
  }, []);
  return <>{children}</>;
}

export function BackendStatus() {
  const [status, setStatus] = useState<"loading" | "online" | "offline">("loading");
  const [detail, setDetail] = useState("");

  useEffect(() => {
    (async () => {
      await initApiConfig();
      const url = getApiUrlSync();
      if (!url || (url === "http://localhost:8000" && typeof window !== "undefined" && !window.location.hostname.includes("localhost"))) {
        setStatus("offline");
        setDetail("Set your Railway URL in api-config.json");
        return;
      }
      try {
        const h = await getHealth();
        setStatus("online");
        setDetail(`${url} · AI: ${h.ai_provider}`);
      } catch {
        setStatus("offline");
        setDetail(url);
      }
    })();
  }, []);

  const colors = {
    loading: "bg-surface-2 text-text-3 border-border",
    online: "bg-success/10 text-success border-success/30",
    offline: "bg-danger/10 text-danger border-danger/30",
  };

  return (
    <span className={`text-xs px-2 py-1 rounded-full border ${colors[status]}`}>
      {status === "loading" ? "Checking API…" : status === "online" ? "Backend online" : "Backend offline"}
      {detail && status !== "loading" && (
        <span className="hidden md:inline text-text-3 ml-1">· {detail}</span>
      )}
    </span>
  );
}
