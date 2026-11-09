// SEO das páginas de música e de artista.
//   /musica/793-maca-do-amor?tom=A  -> o mesmo app, já com título, artista, tom, composição e a cifra
//                                     completa (letra + acordes) no HTML, para o Google ler e para a prévia
//                                     do WhatsApp. O app abre por cima, igual a hoje.
//   /artista/soweto                 -> lista de músicas do artista no HTML.
export const config = { matcher: ["/musica/:path*", "/artista/:path*"] };

const SITE = "https://www.sambacifra.com.br";
const SB_URL = "https://lbspifonlkwnthvohyvv.supabase.co";

const esc = s => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const slugify = t => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
const artistSlug = a => slugify(String(a || "").replace(/^(grupo|banda)\s+/i, ""));
const songPath = s => "/musica/" + s.id + "-" + slugify(s.title);
const ldjson = o => JSON.stringify(o).replace(/</g, "\\u003c");

// "A" -> "Lá maior", "F#m" -> "Fá sustenido menor", "Bb" -> "Si bemol maior"
const NOTA = { C: "Dó", D: "Ré", E: "Mi", F: "Fá", G: "Sol", A: "Lá", B: "Si" };
function tomPt(k) {
  const m = String(k).match(/^([A-Ga-g])(#|b)?(m)?/);
  if (!m) return k;
  return NOTA[m[1].toUpperCase()] + (m[2] === "#" ? " sustenido" : m[2] === "b" ? " bemol" : "") + (m[3] ? " menor" : " maior");
}

// transposição simples (só para o texto da página quando o link pede outro tom)
const SUS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"], BEM = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
const PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const pcOf = n => { const m = String(n).match(/^([A-G])(#|b)?/); return m ? (PC[m[1]] + (m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0) + 12) % 12 : null; };
function transp(ch, d, flats) {
  if (!d) return ch;
  return ch.replace(/(^|\/)([A-G])(#|b)?/g, (_, p, l, a) => p + (flats ? BEM : SUS)[(pcOf(l + (a || "")) + d + 120) % 12]);
}

function cifraTexto(lines, d, flats) {
  const out = [];
  for (const l of lines || []) {
    if (l.t === "gap") { out.push(""); continue; }
    let cl = "";
    for (const [pos, c] of l.ch || []) {
      const cc = transp(c, d, flats);
      if (cl.length > pos) cl += " ";
      cl = cl.padEnd(pos, " ") + cc;
    }
    if (cl.trim()) out.push(cl.replace(/\s+$/, ""));
    if (l.t !== "chords" && l.text != null && String(l.text).trim()) out.push(String(l.text).replace(/\s+$/, ""));
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

function parseSongs(h) {
  const a = h.indexOf("const SONGS = ");
  if (a < 0) return [];
  const b = h.indexOf("];\n", a);
  try { return JSON.parse(h.slice(a + 14, b + 1)); } catch (_) { return []; }
}

function setMeta(h, { title, desc, url, ogType, imgAlt, head }) {
  const rep = (re, v) => { h = h.replace(re, v); };
  rep(/<title>[^<]*<\/title>/, `<title>${esc(title)}</title>`);
  rep(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${esc(desc)}">`);
  rep(/<meta property="og:url" content="[^"]*">/, `<meta property="og:url" content="${esc(url)}">`);
  rep(/<meta property="og:title" content="[^"]*">/, `<meta property="og:title" content="${esc(title.replace(/ \| SambaCifra$/, ""))}">`);
  rep(/<meta property="og:description" content="[^"]*">/, `<meta property="og:description" content="${esc(desc)}">`);
  rep(/<meta property="og:image:alt" content="[^"]*">/, `<meta property="og:image:alt" content="${esc(imgAlt)}">`);
  rep(/<meta property="og:type" content="[^"]*">/, `<meta property="og:type" content="${ogType}">`);
  rep(/<link rel="canonical"[^>]*>\n?/, "");
  rep("</head>", head + "\n</head>");
  return h;
}
const putView = (h, html) => h.replace('<main class="wrap" id="view"></main>', `<main class="wrap" id="view"><article class="seo">${html}</article></main>`);

const SEO_CSS = `<style>.seo{padding:18px 4px 40px}.seo h1{font-size:28px;margin:6px 0}.seo .sub{color:var(--muted,#776)}.seo pre{font:15px/1.5 "JetBrains Mono",monospace;white-space:pre-wrap;overflow-x:auto}.seo ul{padding-left:18px}.seo a{color:inherit}</style>`;

async function composicao(id) {
  try {
    const r = await fetch(`${SB_URL}/rest/v1/musica_info?song_id=eq.s${id}&select=compositores`, { headers: { apikey: KEY }, signal: AbortSignal.timeout(1500) });
    const j = await r.json();
    return (j && j[0] && j[0].compositores) || "";
  } catch (_) { return ""; }
}
let KEY = "";

export default async function middleware(req) {
  const url = new URL(req.url);
  const r = await fetch(new URL("/index.html", url));
  let h = await r.text();
  let status = r.ok ? 200 : r.status;
  try {
    if (r.ok) {
      const km = h.match(/SB_KEY *= *"([^"]+)"/); if (km) KEY = km[1];
      const SONGS = parseSongs(h);
      const mM = url.pathname.match(/^\/musica\/(\d+)(?:-([a-z0-9-]*))?/);
      const mA = url.pathname.match(/^\/artista\/([a-z0-9-]+)/);
      if (mM) {
        let s = SONGS.find(x => String(x.id) === mM[1]);
        if (!s && mM[2]) s = SONGS.find(x => slugify(x.title) === mM[2]);
        if (!s) status = 404;
        else {
          const cm = h.match(/CHUNKS = (\[[^\]]*\])/);
          const chunks = cm ? JSON.parse(cm[1]) : [];
          const [dados, comp] = await Promise.all([
            chunks[s.c] ? fetch(new URL("/data/" + chunks[s.c], url)).then(x => x.json()).then(o => o[String(s.id)]).catch(() => null) : null,
            composicao(s.id),
          ]);
          const tomQ = (url.searchParams.get("tom") || "").replace(/[^A-Ga-g#bm]/g, "").slice(0, 4);
          const base = s.key || "";
          let d = 0;
          if (tomQ && base && pcOf(tomQ.charAt(0).toUpperCase() + tomQ.slice(1)) != null && pcOf(base) != null) d = (pcOf(tomQ.charAt(0).toUpperCase() + tomQ.slice(1)) - pcOf(base) + 12) % 12;
          const tom = d ? tomQ : base;
          const flats = /b/.test(tom.slice(1));
          const temSimp = !!(dados && dados.simplificada && dados.simplificada.length);
          const titulo = `${s.title} – ${s.artist}`;
          const canon = SITE + songPath(s);
          const desc = `Cifra${tom ? ` no tom de ${tomPt(tom)}` : ""}, com desenho dos acordes, troca de tom e batucada. Toque no SambaCifra.`;
          const texto = dados ? cifraTexto(dados.completa, d, flats) : "";
          const simp = temSimp ? cifraTexto(dados.simplificada, d, flats) : "";
          const doMesmo = SONGS.filter(x => x.artist === s.artist && x.id !== s.id).slice(0, 30);
          const aUrl = SITE + "/artista/" + artistSlug(s.artist);
          const ld = [
            { "@context": "https://schema.org", "@type": "MusicComposition", name: s.title, url: canon, inLanguage: "pt-BR",
              ...(comp ? { composer: comp.split(/,\s*|\s+e\s+/).filter(Boolean).map(n => ({ "@type": "Person", name: n.trim() })) } : {}),
              ...(base ? { musicalKey: base } : {}),
              recordedAs: { "@type": "MusicRecording", name: s.title, byArtist: { "@type": "MusicGroup", name: s.artist, url: aUrl } } },
            { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [
              { "@type": "ListItem", position: 1, name: "SambaCifra", item: SITE + "/" },
              { "@type": "ListItem", position: 2, name: s.artist, item: aUrl },
              { "@type": "ListItem", position: 3, name: s.title, item: canon }] },
          ];
          h = setMeta(h, {
            title: `${titulo} | Cifra${temSimp ? " completa e simplificada" : ""} | SambaCifra`,
            desc, url: SITE + url.pathname + url.search, ogType: "music.song", imgAlt: `${titulo} · SambaCifra`,
            head: `<link rel="canonical" href="${esc(canon)}">\n<script type="application/ld+json">${ldjson(ld)}</script>\n${SEO_CSS}`,
          });
          h = putView(h, `<nav class="sub"><a href="/">SambaCifra</a> › <a href="/artista/${esc(artistSlug(s.artist))}">${esc(s.artist)}</a></nav>
<h1>${esc(s.title)}</h1>
<p class="sub">Cifra de <a href="/artista/${esc(artistSlug(s.artist))}">${esc(s.artist)}</a>${tom ? ` · Tom: ${esc(tom)} (${esc(tomPt(tom))})` : ""}${comp ? ` · Composição: ${esc(comp)}` : ""}</p>
${texto ? `<h2>Cifra completa</h2><pre>${esc(texto)}</pre>` : ""}
${simp ? `<h2>Cifra simplificada</h2><pre>${esc(simp)}</pre>` : ""}
${doMesmo.length ? `<h2>Outras cifras de ${esc(s.artist)}</h2><ul>${doMesmo.map(x => `<li><a href="${esc(songPath(x))}">${esc(x.title)}</a></li>`).join("")}</ul>` : ""}`);
        }
      } else if (mA) {
        const lista = SONGS.filter(x => artistSlug(x.artist) === mA[1]);
        if (!lista.length) status = 404;
        else {
          const nome = lista[0].artist;
          const canon = SITE + "/artista/" + mA[1];
          const ord = lista.slice().sort((a, b) => a.title.localeCompare(b.title, "pt"));
          const ld = [
            { "@context": "https://schema.org", "@type": "MusicGroup", name: nome, url: canon },
            { "@context": "https://schema.org", "@type": "ItemList", name: `Cifras de ${nome}`, itemListElement: ord.slice(0, 100).map((x, i) => ({ "@type": "ListItem", position: i + 1, url: SITE + songPath(x), name: x.title })) },
          ];
          h = setMeta(h, {
            title: `${nome} – ${lista.length} cifra${lista.length > 1 ? "s" : ""} | SambaCifra`,
            desc: `Cifras de ${nome}: ${ord.slice(0, 6).map(x => x.title).join(", ")}${lista.length > 6 ? " e mais" : ""}. Com troca de tom, desenho dos acordes e batucada.`,
            url: canon, ogType: "website", imgAlt: `Cifras de ${nome} · SambaCifra`,
            head: `<link rel="canonical" href="${esc(canon)}">\n<script type="application/ld+json">${ldjson(ld)}</script>\n${SEO_CSS}`,
          });
          h = putView(h, `<nav class="sub"><a href="/">SambaCifra</a> › ${esc(nome)}</nav>
<h1>Cifras de ${esc(nome)}</h1>
<p class="sub">${lista.length} música${lista.length > 1 ? "s" : ""} com cifra, troca de tom e desenho dos acordes.</p>
<ul>${ord.map(x => `<li><a href="${esc(songPath(x))}">${esc(x.title)}</a>${x.key ? ` <span class="sub">(${esc(x.key)})</span>` : ""}</li>`).join("")}</ul>`);
        }
      }
    }
  } catch (_) { /* em qualquer erro, devolve o app normal */ }
  const hd = new Headers(r.headers);
  hd.delete("content-length"); hd.delete("content-encoding"); hd.delete("etag");
  hd.set("content-type", "text/html; charset=utf-8");
  hd.set("cache-control", "public, max-age=0, must-revalidate");
  return new Response(h, { status, headers: hd });
}
