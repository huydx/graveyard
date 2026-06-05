/**
 * Service Worker — offline fallback for PWA.
 *
 * v1: Minimal caching. Shows the error illustration when offline.
 * v2: Proper cache-first strategy for static assets.
 */

const CACHE_NAME = "kuma-sensei-v1";

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  // Network-first with offline fallback
  event.respondWith(
    fetch(event.request).catch(() => {
      // For navigation requests, return the app shell
      if (event.request.mode === "navigate") {
        return caches.match(event.request);
      }
      // For API requests, fail gracefully
      return new Response(
        JSON.stringify({
          error: "offline",
          content: "ネットに つながらないよ。もうすこし まったら ためしてみてね 🐻",
          responseType: "chat",
        }),
        {
          status: 503,
          headers: { "Content-Type": "application/json" },
        }
      );
    })
  );
});
