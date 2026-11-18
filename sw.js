/* IWP service worker.
   BUMP THIS NAME ON EVERY RELEASE, and upload sw.js together with index.html.
   A phone only installs a new worker when this file itself changes; forget it
   and some devices keep serving the old build for days.
   Keep the "iwp-" prefix: other apps live on the same GitHub origin and each
   worker must delete only its own caches. */
const CACHE = "iwp-v11";
const SHELL = ["./", "./index.html", "./manifest.json",
               "./icon-192.png", "./icon-512.png", "./apple-touch-icon.png"];

self.addEventListener("install", e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).catch(() => {}));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(
        ks.filter(k => k.startsWith("iwp-") && k !== CACHE)   // only ours
          .map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Firebase library files and the two webfonts: keep them after the first
  // visit so the app opens offline, looking the way it should, without
  // waiting on anything. Cache-first, because none of them change.
  if ((url.hostname === "www.gstatic.com" && url.pathname.includes("firebasejs"))
      || url.hostname === "fonts.googleapis.com"
      || url.hostname === "fonts.gstatic.com") {
    e.respondWith(
      caches.open(CACHE).then(c =>
        c.match(req).then(hit => hit || fetch(req).then(r => { c.put(req, r.clone()); return r; })))
    );
    return;
  }
  // Never cache the sync traffic itself.
  if (url.hostname.endsWith("googleapis.com") || url.hostname.endsWith("firebaseio.com")) return;
  // Our own files: try the network so updates arrive, fall back to the copy.
  if (url.origin !== location.origin) return;
  e.respondWith(
    fetch(req)
      .then(r => { const copy = r.clone();
                   caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
                   return r; })
      .catch(() => caches.match(req).then(hit => hit || caches.match("./index.html")))
  );
});
