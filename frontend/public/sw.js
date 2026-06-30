/* Nexa PWA service worker — generated, do not edit */
const BASE = "/operator-os";
const CACHE = "nexa-v1";

const PRECACHE = [
  "/operator-os/",
  "/operator-os/dashboard/",
  "/operator-os/login/",
  "/operator-os/signup/",
  "/operator-os/manifest.webmanifest",
  "/operator-os/nexa-logo.png",
  "/operator-os/icons/icon-192x192.png",
  "/operator-os/icons/icon-512x512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);

  // API calls always go to network
  if (url.pathname.includes("/api/") || url.hostname.includes("railway.app")) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok && url.origin === self.location.origin) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(() =>
        caches.match(event.request).then(
          (cached) => cached || caches.match(BASE + "/") || caches.match(BASE + "/dashboard/")
        )
      )
  );
});
