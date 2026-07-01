#!/usr/bin/env node
/**
 * Generates PWA manifest + service worker with correct GitHub Pages base path.
 * Run automatically via npm prebuild.
 */
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { execSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const publicDir = path.join(root, "public");
const iconsDir = path.join(publicDir, "icons");
const base = (process.env.NEXT_PUBLIC_BASE_PATH || "").replace(/\/$/, "");

mkdirSync(iconsDir, { recursive: true });

const logo = path.join(publicDir, "nexa-logo.png");
const sizes = [
  { name: "icon-192x192.png", size: 192 },
  { name: "icon-512x512.png", size: 512 },
  { name: "apple-touch-icon.png", size: 180 },
];

if (existsSync(logo)) {
  for (const { name, size } of sizes) {
    const out = path.join(iconsDir, name);
    try {
      execSync(`sips -z ${size} ${size} "${logo}" --out "${out}"`, { stdio: "ignore" });
    } catch {
      // CI/Linux: keep committed icons if sips unavailable
    }
  }
}

const icon = (file) => `${base}/icons/${file}`;

const manifest = {
  name: "Nexa — Your AI Operating System",
  short_name: "Nexa",
  description: "Command your business. Nexa runs real API actions across Stripe, Slack, Gmail, and more.",
  start_url: `${base}/dashboard/`,
  scope: `${base}/`,
  id: `${base}/`,
  display: "standalone",
  background_color: "#000000",
  theme_color: "#000000",
  orientation: "portrait-primary",
  categories: ["business", "productivity"],
  icons: [
    {
      src: icon("icon-192x192.png"),
      sizes: "192x192",
      type: "image/png",
      purpose: "any",
    },
    {
      src: icon("icon-512x512.png"),
      sizes: "512x512",
      type: "image/png",
      purpose: "any",
    },
    {
      src: icon("icon-512x512.png"),
      sizes: "512x512",
      type: "image/png",
      purpose: "maskable",
    },
  ],
};

writeFileSync(
  path.join(publicDir, "manifest.webmanifest"),
  JSON.stringify(manifest, null, 2) + "\n"
);

const precache = [
  `${base}/`,
  `${base}/dashboard/`,
  `${base}/login/`,
  `${base}/signup/`,
  `${base}/manifest.webmanifest`,
  `${base}/nexa-logo.png`,
  icon("icon-192x192.png"),
  icon("icon-512x512.png"),
].filter(Boolean);

const sw = `/* Nexa PWA service worker — generated, do not edit */
const BASE = ${JSON.stringify(base)};
const CACHE = "nexa-v8";

const PRECACHE = ${JSON.stringify([
  ...precache,
  `${base}/dashboard/chat/`,
  `${base}/dashboard/command/`,
].filter(Boolean), null, 2)};

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
`;

writeFileSync(path.join(publicDir, "sw.js"), sw);

console.log(`PWA assets generated (base: "${base || "/"}")`);
