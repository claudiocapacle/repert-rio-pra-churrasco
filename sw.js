// Offline: guarda o app e as bibliotecas; a página principal busca primeiro na rede para pegar atualizações.
// Três caches: o núcleo do app (muda a cada publicação), as cifras (arquivos com hash, nunca mudam)
// e a mídia (batucada, imagens, fontes). Uma publicação nova só troca o núcleo: o offline do aluno continua.
const CACHE = "sambacifra-v105";
const DADOS = "sambacifra-dados", MIDIA = "sambacifra-midia";
const CORE = ["./", "index.html", "manifest.webmanifest", "vendor/supabase.js", "vendor/591.supabase.js", "vendor/qrcode.min.js", "icon-192.png", "icon-512.png", "favicon.png", "apple-touch-icon.png", "icon.svg"];
const qual = url => url.pathname.startsWith("/data/") ? DADOS : (url.pathname.startsWith("/batucada/") || url.pathname.startsWith("/img/") || /fonts\.(gstatic|googleapis)\.com$/.test(url.hostname)) ? MIDIA : CACHE;
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => { e.waitUntil((async () => {
  const ks = await caches.keys();
  for (const k of ks) {
    if (k === CACHE || k === DADOS || k === MIDIA) continue;
    if (k.startsWith("sambacifra-v")) { // caches antigos: aproveita cifras e mídia antes de apagar
      try { const old = await caches.open(k), reqs = await old.keys();
        for (const r of reqs) { const u = new URL(r.url), alvo = qual(u); if (alvo === CACHE) continue; const res = await old.match(r); if (res) await (await caches.open(alvo)).put(r, res); } } catch (_) {}
    }
    await caches.delete(k);
  }
  await self.clients.claim();
})()); });
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
  // só guarda no cache o que é do próprio site ou das origens conhecidas (fontes e bibliotecas); nada de respostas opacas
  const conhecida = url.origin === location.origin || url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com" || url.hostname === "cdnjs.cloudflare.com";
  if (!conhecida) return;
  e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => {
    if (r.ok && (r.type === "basic" || r.type === "cors")) { const cp = r.clone(); caches.open(qual(url)).then(c => c.put(req, cp)); }
    return r;
  })));
});
