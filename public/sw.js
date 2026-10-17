// Service Worker for Offline Classroom Support - Math Lessons Platform
const CACHE_NAME = "math-eloued-v3";
const OFFLINE_PAGES = ["/", "/t/search", "/t/schools", "/assessment"];

// نقاط النهاية العامة التي يمكن حفظها لتصفح الدروس بدون إنترنت (بيانات الأولياء فقط)
const CACHEABLE_PUBLIC_API = ["/api/lessons", "/api/honors"];

function isCacheablePublicApi(url) {
  return url.searchParams.has("teacher") && CACHEABLE_PUBLIC_API.some((p) => url.pathname.startsWith(p));
}

// Install Event: pre-cache key pages
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(OFFLINE_PAGES).catch((err) => {
        console.warn("Some offline pages could not be pre-cached during install:", err);
      });
    })
  );
  self.skipWaiting();
});

// Activate Event: clean up older caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// Fetch Event: Network-first for navigation & pages, fallback to cache when offline
self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Skip non-GET and chrome extensions
  if (req.method !== "GET" || !url.protocol.startsWith("http")) return;

  // For API calls: let fetch proceed, or fallback to cache if available
  if (url.pathname.startsWith("/api/")) {
    const cacheable = isCacheablePublicApi(url);
    // مفتاح الحفظ بدون معامل منع التخزين المؤقت (_t / t)
    const cacheKey = new URL(url);
    cacheKey.searchParams.delete("_t");
    cacheKey.searchParams.delete("t");
    event.respondWith(
      fetch(req)
        .then((response) => {
          if (cacheable && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(cacheKey.toString(), clone));
          }
          return response;
        })
        .catch(async () => {
        const cached = cacheable ? await caches.match(cacheKey.toString()) : null;
        if (cached) return cached;
        return new Response(JSON.stringify({ error: "أوفلاين (غير متصل بالإنترنت)", offline: true }), {
          status: 503,
          headers: { "Content-Type": "application/json" },
        });
      })
    );
    return;
  }

  // For HTML page navigations: Network first, cache fallback
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((response) => {
          if (response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(req);
          if (cached) return cached;
          // Fallback to /eval if trying to access eval offline
          if (url.pathname.startsWith("/eval")) {
            return (await caches.match("/eval")) || Response.error();
          }
          return (await caches.match("/")) || Response.error();
        })
    );
    return;
  }

  // For static assets (JS, CSS, images, icons): Stale-while-revalidate
  event.respondWith(
    caches.match(req).then((cachedResponse) => {
      const fetchPromise = fetch(req)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          }
          return networkResponse;
        })
        .catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});
