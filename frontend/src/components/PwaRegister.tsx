"use client";

import { useEffect } from "react";

function resolveBase(): string {
  const built = process.env.NEXT_PUBLIC_BASE_PATH || "";
  if (built) return built.replace(/\/$/, "");
  if (typeof window !== "undefined" && window.location.pathname.startsWith("/operator-os")) {
    return "/operator-os";
  }
  return "";
}

export function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const base = resolveBase();
    navigator.serviceWorker
      .register(`${base}/sw.js`, { scope: `${base}/` })
      .catch(() => {});
  }, []);

  return null;
}
