// Offline: guarda o app e as bibliotecas; a página principal busca primeiro na rede para pegar atualizações.
const CACHE = "sambacifra-v37";
const CORE = ["./", "index.html", "manifest.webmanifest", "vendor/supabase.js", "vendor/591.supabase.js", "vendor/qrcode.min.js", "icon-192.png", "icon-512.png", "favicon.png", "apple-touch-icon.png", "icon.svg"];
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", e => {
  const req = e.request; if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.hostname.endsWith("supabase.co")) return; // dados ao vivo não entram no cache
  if (req.mode === "navigate") {
    const raiz = url.pathname === "/" || url.pathname === "/index.html";
    e.respondWith(fetch(req).then(r => { if (raiz && r.ok) { const cp = r.clone(); caches.open(CACHE).then(c => c.put("index.html", cp)); } return r; })
      .catch(() => caches.match("index.html")));
    return;
  }
  e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => {
    if (r.ok || r.type === "opaque") { const cp = r.clone(); caches.open(CACHE).then(c => c.put(req, cp)); }
    return r;
  })));
});
