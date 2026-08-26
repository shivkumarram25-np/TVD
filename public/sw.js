// Nepal TVD Service Worker - basic cache for app shell (static assets only)
const CACHE_NAME = "nepal-tvd-v3";
const ASSETS = [
  "/",
  "/index.html",
  "/style.css",
  "/app.js",
  "/manifest.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/widgets/quick-download-template.json",
  "/widgets/quick-download-data.json",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ---------- PWA Widgets (Windows 11 Widgets Board) ----------
async function updateWidgets() {
  if (!self.widgets) return;
  try {
    const widget = await self.widgets.getByTag("nepaltvd-quick-download");
    if (!widget) return;
    const templateRes = await fetch(widget.definition.msAcTemplate || "/widgets/quick-download-template.json");
    const dataRes = await fetch(widget.definition.data || "/widgets/quick-download-data.json");
    const template = await templateRes.text();
    const data = await dataRes.text();
    await self.widgets.updateByTag(widget.definition.tag, { template, data });
  } catch (e) {
    /* ignore */
  }
}

self.addEventListener("widgetinstall", (event) => {
  event.waitUntil(updateWidgets());
});

self.addEventListener("widgetresume", (event) => {
  event.waitUntil(updateWidgets());
});

self.addEventListener("widgetclick", (event) => {
  if (event.action === "quick-download") {
    const pastedUrl = (event.data && event.data.videoUrl) || "";
    const target = pastedUrl
      ? "/?url=" + encodeURIComponent(pastedUrl)
      : "/?widget=open";
    event.waitUntil(self.clients.openWindow(target));
  }
});

self.addEventListener("widgetuninstall", () => {
  /* nothing to clean up */
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Never cache API calls (download/proxy must always be fresh)
  if (url.pathname.startsWith("/api/")) return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      return (
        cached ||
        fetch(event.request).then((response) => {
          if (response.ok && event.request.method === "GET") {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        }).catch(() => cached)
      );
    })
  );
});
