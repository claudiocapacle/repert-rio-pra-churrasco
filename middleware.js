// Prévia do link de cada música (WhatsApp, Instagram, etc.): /musica/793-maca-do-amor?tom=A
// devolve o mesmo app, mas com título, artista e tom nas tags da prévia.
export const config = { matcher: "/musica/:path*" };

const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const unjson = s => { try { return JSON.parse('"' + s + '"'); } catch (_) { return s; } };

export default async function middleware(req) {
  const url = new URL(req.url);
  const m = url.pathname.match(/^\/musica\/(\d+)/);
  const r = await fetch(new URL("/index.html", url));
  let h = await r.text();
  if (m && r.ok) {
    const s = h.match(new RegExp('\\{"id":' + m[1] + ',"title":"((?:[^"\\\\]|\\\\.)*)","artist":"((?:[^"\\\\]|\\\\.)*)","key":"([^"]*)"'));
    if (s) {
      const titulo = unjson(s[1]), artista = unjson(s[2]);
      const tomQ = (url.searchParams.get("tom") || "").replace(/[^A-Ga-g#bm]/g, "").slice(0, 4);
      const tom = tomQ || s[3];
      const t = `${titulo} – ${artista}`;
      const d = `Cifra para cavaquinho${tom ? ` no tom de ${tom}` : ""}, com desenho dos acordes, troca de tom e batucada. Toque no SambaCifra.`;
      const set = (re, val) => { h = h.replace(re, val); };
      set(/<title>[^<]*<\/title>/, `<title>${esc(t)} · cifra | SambaCifra</title>`);
      set(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${esc(d)}">`);
      set(/<meta property="og:url" content="[^"]*">/, `<meta property="og:url" content="${esc(url.origin + url.pathname + url.search)}">`);
      set(/<meta property="og:title" content="[^"]*">/, `<meta property="og:title" content="${esc(t)}">`);
      set(/<meta property="og:description" content="[^"]*">/, `<meta property="og:description" content="${esc(d)}">`);
      set(/<meta property="og:image:alt" content="[^"]*">/, `<meta property="og:image:alt" content="${esc(t)} · SambaCifra">`);
      set(/<meta property="og:type" content="[^"]*">/, `<meta property="og:type" content="music.song">`);
    }
  }
  const hd = new Headers(r.headers);
  hd.delete("content-length"); hd.delete("content-encoding"); hd.delete("etag");
  hd.set("content-type", "text/html; charset=utf-8");
  hd.set("cache-control", "public, max-age=0, s-maxage=300, stale-while-revalidate=86400");
  return new Response(h, { status: r.ok ? 200 : r.status, headers: hd });
}
