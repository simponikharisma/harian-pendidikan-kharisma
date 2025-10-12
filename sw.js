// ===============================================
// Service Worker - Khudama' Kharisma (Auto Version)
// ===============================================

// 🕒 Versi otomatis berdasarkan tanggal build
const today = new Date();
const VERSION = `v${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}`;
const CACHE_NAME = `kharisma-cache-${VERSION}`;

const FILES_TO_CACHE = [
  "/",
  "/index.html",
  "/style.css",
  "/script.js",
  "/icons/icon-152.png",
  "/icons/icon-192.png",
  "/icons/logo.png"
];

self.addEventListener("install", (event) => {
  console.log(`[SW] Installing ${CACHE_NAME}...`);
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(FILES_TO_CACHE))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  console.log("[SW] Activating new service worker...");
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key.startsWith("kharisma-cache-") && key !== CACHE_NAME) {
            console.log("[SW] Hapus cache lama:", key);
            return caches.delete(key);
          }
        })
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // 🚫 Jangan cache Supabase (biar data real-time)
  if (url.origin.includes("supabase.co")) return;

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;

      return fetch(req)
        .then((res) => {
          if (!res || res.status !== 200 || res.type !== "basic") return res;
          const resClone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
          return res;
        })
        .catch(() => {
          if (req.mode === "navigate") return caches.match("/index.html");
        });
    })
  );
});

// 🧠 Auto-activate tanpa reload manual
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
