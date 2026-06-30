let cachedApiUrl = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/$/, "");
let loadPromise: Promise<string> | null = null;

function basePath(): string {
  return process.env.NEXT_PUBLIC_BASE_PATH || "";
}

/** Load api-config.json on GitHub Pages (no rebuild needed when URL changes). */
export async function initApiConfig(): Promise<string> {
  if (cachedApiUrl) return cachedApiUrl;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    if (typeof window === "undefined") return "";
    try {
      const res = await fetch(`${basePath()}/api-config.json`, { cache: "no-store" });
      if (!res.ok) return "";
      const data = (await res.json()) as { apiUrl?: string };
      const url = (data.apiUrl || "").trim().replace(/\/$/, "");
      if (url) cachedApiUrl = url;
      return cachedApiUrl;
    } catch {
      return "";
    }
  })();

  return loadPromise;
}

export function getApiUrlSync(): string {
  return cachedApiUrl || "http://localhost:8000";
}

export function setApiUrl(url: string) {
  cachedApiUrl = url.replace(/\/$/, "");
}
