/* Excalidrive service worker — makes the app installable and usable offline.
 * - Page loads: network first, falls back to the cached app when offline.
 * - Built assets (/assets/*, hashed filenames): cache first.
 * - Excalidraw fonts from public CDNs: cache first.
 * - Google sign-in and Drive API calls are never cached.
 * Bump VERSION to force old caches to be cleared. */
const VERSION = "v1";
const CACHE = `excalidrive-${VERSION}`;
const SHELL = ["./", "./index.html", "./manifest.webmanifest", "./favicon.svg", "./icon-192.png"];
const FONT_HOSTS = ["esm.sh", "unpkg.com", "cdn.jsdelivr.net"];

// Precache the page plus the JS/CSS it references (hashed names change every build,
// so read them from index.html instead of hard-coding them).
async function precache() {
  const cache = await caches.open(CACHE);
  await cache.addAll(SHELL);
  const html = await (await cache.match("./index.html")).text();
  const assets = [...html.matchAll(/(?:src|href)="(\.\/assets\/[^"]+)"/g)].map((m) => m[1]);
  await cache.addAll(assets);
}

self.addEventListener("install", (event) => {
  event.waitUntil(precache().then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("excalidrive-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function cacheFirst(request) {
  const cached = await caches.match(request, { ignoreVary: true });
  if (cached) return cached;
  const res = await fetch(request);
  if (res.ok) (await caches.open(CACHE)).put(request, res.clone());
  return res;
}

async function networkFirst(request) {
  try {
    const res = await fetch(request);
    if (res.ok) (await caches.open(CACHE)).put("./index.html", res.clone());
    return res;
  } catch {
    return (await caches.match("./index.html", { ignoreVary: true })) || (await caches.match("./", { ignoreVary: true })) || Response.error();
  }
}

async function staleWhileRevalidate(request) {
  const cached = await caches.match(request, { ignoreVary: true });
  const network = fetch(request)
    .then(async (res) => {
      if (res.ok) (await caches.open(CACHE)).put(request, res.clone());
      return res;
    })
    .catch(() => cached);
  return cached || network;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  if (url.origin === self.location.origin) {
    if (request.mode === "navigate") {
      // Only the app page itself; privacy/terms pages just go to the network.
      if (url.pathname.endsWith(".html") && !url.pathname.endsWith("index.html")) return;
      event.respondWith(networkFirst(request));
    } else if (url.pathname.includes("/assets/")) {
      event.respondWith(cacheFirst(request));
    } else {
      event.respondWith(staleWhileRevalidate(request));
    }
    return;
  }

  if (FONT_HOSTS.includes(url.hostname) && /\.(woff2?|ttf|otf)$/i.test(url.pathname)) {
    event.respondWith(cacheFirst(request));
  }
  // Everything else (Google sign-in, Drive API) goes straight to the network.
});
