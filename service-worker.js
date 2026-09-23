const CACHE = "checkpoint-v1";
const APP_SHELL = [
  "./", "index.html", "manifest.webmanifest",
  "shared/tokens.css", "shared/app.js", "shared/icon.svg",
  "roomguide/index.html", "roomguide/style.css", "roomguide/app.js",
  "departures/index.html", "departures/css/app.css",
  "departures/js/store.js", "departures/js/departures.js", "departures/js/checkouts.js",
  "departures/js/finder.js", "departures/js/tools.js", "departures/js/daylist.js", "departures/js/app.js",
  "email/module.js", "email/style.css"
];
// Data files: prefer a fresh copy, fall back to cache when offline.
const NETWORK_FIRST = ["roomguide/data.js", "email/templates.json"];

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
  if (url.origin !== location.origin) return; // leave GitHub API / fonts to the network

  const isNetworkFirst = NETWORK_FIRST.some(p => url.pathname.endsWith(p));

  if (isNetworkFirst) {
    e.respondWith(
      fetch(e.request).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
        return res;
      }).catch(() => caches.match(e.request))
    );
    return;
  }

  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, copy));
      return res;
    }).catch(() => cached))
  );
});
