// While this app is under active development, code files (HTML/CSS/JS) are
// network-first: always try the live version first, fall back to cache only
// when offline. Only large static assets (room photos, fonts) are cache-first,
// since those don't change and are worth saving data on.
const CACHE = "checkpoint-v7";
const APP_SHELL = [
  "./", "index.html", "manifest.webmanifest",
  "shared/tokens.css", "shared/app.js",
  "shared/assets/favicon-16.png", "shared/assets/favicon-32.png", "shared/assets/apple-touch-icon.png",
  "shared/assets/rixos-logo.png", "shared/assets/icon-192.png", "shared/assets/icon-512.png",
  "roomguide/index.html", "roomguide/style.css", "roomguide/app.js",
  "departures/index.html", "departures/css/app.css",
  "departures/js/store.js", "departures/js/departures.js", "departures/js/checkouts.js",
  "departures/js/finder.js", "departures/js/tools.js", "departures/js/daylist.js", "departures/js/app.js",
  "allocation/module.js", "allocation/style.css", "allocation/parse.js", "allocation/rules.js", "allocation/match.js",
  "allocation/compare.js", "allocation/group.js"
];
const CODE_EXTENSIONS = [".html", ".css", ".js", ".json", ".webmanifest"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return; // leave GitHub API / fonts / CDN libs to the network

  const isCode = CODE_EXTENSIONS.some(ext => url.pathname.endsWith(ext)) || url.pathname.endsWith("/");

  if (isCode) {
    // Network-first: always get the latest code when online.
    e.respondWith(
      fetch(e.request, { cache: "no-store" }).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
        return res;
      }).catch(() => caches.match(e.request))
    );
    return;
  }

  // Static assets (images, etc.): cache-first, since they don't change.
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, copy));
      return res;
    }).catch(() => cached))
  );
});
