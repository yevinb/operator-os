const PRODUCTION_API = "https://operator-os-production-2a8a.up.railway.app";

let cachedApiUrl = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/$/, "");
let loadPromise: Promise<string> | null = null;

function basePath(): string {
  return process.env.NEXT_PUBLIC_BASE_PATH || "";
}

function isGitHubPages(): boolean {
  if (typeof window === "undefined") return false;
  return window.location.hostname === "yevinb.github.io";
}

/** Load API URL — env, api-config.json, or production fallback. */
export async function initApiConfig(): Promise<string> {
  if (cachedApiUrl && cachedApiUrl !== "http://localhost:8000") return cachedApiUrl;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    const fromEnv = (process.env.NEXT_PUBLIC_API_URL || "").trim().replace(/\/$/, "");
    if (fromEnv) {
      cachedApiUrl = fromEnv;
      return cachedApiUrl;
    }

    if (typeof window === "undefined") return "";

    try {
      const res = await fetch(`${basePath()}/api-config.json`, { cache: "no-store" });
      if (res.ok) {
        const data = (await res.json()) as { apiUrl?: string };
        const url = (data.apiUrl || "").trim().replace(/\/$/, "");
        if (url) {
          cachedApiUrl = url;
          return cachedApiUrl;
        }
      }
    } catch {
      // fall through
    }

    if (isGitHubPages()) {
      cachedApiUrl = PRODUCTION_API;
    }

    return cachedApiUrl;
  })();

  return loadPromise;
}

export function getApiUrlSync(): string {
  if (cachedApiUrl) return cachedApiUrl;
  if (typeof window !== "undefined" && isGitHubPages()) return PRODUCTION_API;
  return "http://localhost:8000";
}

export function setApiUrl(url: string) {
  cachedApiUrl = url.replace(/\/$/, "");
}
