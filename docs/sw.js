const CACHE_NAME = "storylife-offline-f83f412ad89f94f9";
const PRECACHE_URLS = [
  "./",
  "./assets/canvas-decor-balloon.png",
  "./assets/canvas-decor-foliage.png",
  "./assets/canvas-decor-mountains-film.png",
  "./assets/canvas-story-decor-source.png",
  "./assets/canvas-story-decor.png",
  "./assets/main-CgubaCC8.js",
  "./assets/main-Dh-E4hEq.css",
  "./icons/storylife-180.png",
  "./icons/storylife-192.png",
  "./icons/storylife-512.png",
  "./index.html",
  "./manifest.webmanifest"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => key.startsWith("storylife-offline-") && key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const requestUrl = new URL(request.url);
  if (requestUrl.origin !== self.location.origin) return;

  event.respondWith((async () => {
    const cached = await caches.match(request, { ignoreSearch: true });
    if (cached) return cached;

    if (request.mode === "navigate") {
      const appShell = await caches.match(new URL("./index.html", self.registration.scope));
      if (appShell) return appShell;
    }

    return fetch(request);
  })());
});
const CACHE_NAME = "storylife-offline-github-v1";
const PRECACHE_URLS = [
  "./",
  "./assets/main-Dh-E4hEq.css",
  "./assets/main-lzIctbbC.js",
  "./icons/storylife.svg",
  "./index.html",
  "./manifest.webmanifest"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith("storylife-offline-") && key !== CACHE_NAME).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const requestUrl = new URL(request.url);
  if (requestUrl.origin !== self.location.origin) return;
  event.respondWith((async () => {
    const cached = await caches.match(request, { ignoreSearch: true });
    if (cached) return cached;
    if (request.mode === "navigate") {
      const appShell = await caches.match(new URL("./index.html", self.registration.scope));
      if (appShell) return appShell;
    }
    return fetch(request);
  })());
});
