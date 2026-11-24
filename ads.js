/* SambaCifra — anúncios (só para quem não é Premium).
   - Na cifra: um bloco entre as estrofes (nunca corta uma linha), com chamada para o Premium.
   - Pop-up: ao abrir o app pela tela inicial e, depois, a cada ~5 minutos de uso, sempre na troca de tela
     (abrir uma música ou voltar ao início), nunca no meio de uma música que a pessoa está tocando.
   - Selo flutuante na tela da música, que abre o Premium.
   Nada disso aparece no Premium, no Modo Palco ou nas telas de pré-visualização/edição.
   Tudo é configurável pela chave "ads" da tabela app_cfg (JSON), sem publicar o app de novo:
   {"on":true,"inline_first_rows":12,"inline_every_rows":24,"inline_max":2,"popup_open":true,"popup_every_min":5,
    "badge":true,"itens":[...]}  — os itens de lá substituem a lista padrão. */
(function(){
"use strict";
const ICO_X='<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>';
const ICO_NO='<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="9"/><path d="M5.6 5.6l12.8 12.8"/></svg>';
const ICO_CROWN='<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M3 7l4.5 4L12 4l4.5 7L21 7l-2 11H5z"/></svg>';

/* Itens padrão. tipo: "casa" (abre o Premium), "parceiro" (link próprio), "afiliado" (loja).
   onde: "cifra" (no meio da letra), "popup". Itens com link vazio não aparecem. */
const ITENS_PADRAO=[
  {id:"p-tudo",tipo:"casa",img:"rol",kick:"SambaCifra Premium",titulo:"Toque com tudo liberado",texto:"Rolagem automática, batucada, Roda de Samba, repertórios sem limite e dicionário de acordes, num só plano.",cta:"Seja Premium",peso:4,onde:["cifra","popup"]},
  {id:"p-roda",tipo:"casa",img:"roda",kick:"Só no Premium",titulo:"Abra a Roda de Samba",texto:"A galera entra pelo QR code e acompanha cada troca de música e de tom no próprio celular.",cta:"Quero abrir a roda",why:"roda",peso:3,onde:["cifra","popup"]},
  {id:"p-bt",tipo:"casa",img:"bt",kick:"Só no Premium",titulo:"Estude com a batucada",texto:"Surdo, pandeiro, rebolo, repiques e cuíca, na velocidade da música. Toque só o pandeiro, só o rebolo…",cta:"Liberar a batucada",why:"bt",peso:3,onde:["cifra","popup"]},
  {id:"p-reps",tipo:"casa",img:"reps",kick:"Só no Premium",titulo:"Repertórios sem limite",texto:"Monte quantos quiser, na ordem da roda e com o tom de cada música salvo. E use os repertórios prontos.",cta:"Montar meus repertórios",why:"reps",peso:3,onde:["cifra","popup"]},
  {id:"p-rol",tipo:"casa",img:"rol",kick:"Só no Premium",titulo:"A cifra rola sozinha",texto:"Mão no instrumento, olho na cifra: rolagem automática e Modo Palco com pedal.",cta:"Liberar a rolagem",why:"rol",peso:2,onde:["cifra"]},
  {id:"p-ac",tipo:"casa",img:"ac",kick:"Só no Premium",titulo:"Dicionário de acordes",texto:"Vários desenhos de cada acorde pelo braço, com o grau de cada nota.",cta:"Ver o dicionário",why:"ac",peso:2,onde:["cifra"]}
  /* parceiros e afiliados (desligados por enquanto) entram assim, via app_cfg.ads.itens:
  {id:"escola",tipo:"parceiro",kick:"…",titulo:"…",texto:"…",cta:"…",link:"https://…",peso:2,onde:["cifra","popup"]}
  /* afiliados entram assim (via app_cfg.ads.itens):
  {id:"ml-palheta",tipo:"afiliado",loja:"Mercado Livre",titulo:"Palheta …",texto:"…",preco:"R$ 19,90",img:"https://…",link:"https://meli.la/…",cta:"Ver na loja",peso:2,onde:["cifra"]} */
];
const PADRAO={on:true,inline_first_rows:12,inline_every_rows:24,inline_max:2,popup_open:true,popup_open_delay:2500,popup_every_min:5,badge:true};

const C=()=>{let o={};try{o=(typeof CFG==="object"&&CFG&&CFG.ads)||{};if(typeof o==="string")o=JSON.parse(o)}catch(e){o={}}return Object.assign({},PADRAO,o)};
const itens=()=>{const c=C();const l=Array.isArray(c.itens)&&c.itens.length?c.itens:ITENS_PADRAO;/* no app da Play Store (declarado "sem anúncios") só entra a divulgação do próprio Premium */
  return l.filter(x=>x&&x.id&&(x.tipo==="casa"||(safeUrl(x.link)&&!(typeof APP_LOJA!=="undefined"&&APP_LOJA))))};
function safeUrl(u){try{const x=new URL(u);return x.protocol==="https:"?x.toString():""}catch(e){return""}}
const ss={get(k,d){try{const v=sessionStorage.getItem("sc-ad-"+k);return v==null?d:JSON.parse(v)}catch(e){return d}},set(k,v){try{sessionStorage.setItem("sc-ad-"+k,JSON.stringify(v))}catch(e){}}};
const E=s=>(typeof esc==="function"?esc(s):String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])));

function ligado(){
  try{
    if(!C().on) return false;
    if(isPro()) return false;
    if(typeof cobrando==="function"&&!cobrando()) return false;
    if(st.stage) return false;
    return true;
  }catch(e){return false}
}

/* sorteio por peso, evitando repetir o que já apareceu */
function sorteia(onde,evita=[]){
  let l=itens().filter(x=>(x.onde||["cifra"]).includes(onde)&&!evita.includes(x.id));
  if(!l.length) l=itens().filter(x=>(x.onde||["cifra"]).includes(onde));
  if(!l.length) return null;
  const tot=l.reduce((a,x)=>a+(+x.peso||1),0);let r=Math.random()*tot;
  for(const x of l){r-=(+x.peso||1);if(r<=0)return x}
  return l[l.length-1];
}

/* métricas: impressão, clique, fechar (tabela anuncio_eventos) */
const vistos=new Set();
function evento(tipo,ad,local){
  try{
    const k=tipo+"|"+ad.id+"|"+local+"|"+(st.id||"");
    if(tipo==="imp"){if(vistos.has(k))return;vistos.add(k)}
    if(typeof sb==="object"&&sb&&sb.rpc) sb.rpc("registrar_anuncio",{p_device:typeof DEVICE==="string"?DEVICE:null,p_ad:String(ad.id).slice(0,60),p_tipo:tipo,p_local:local,p_song:st.id?String(st.id):null}).then(()=>{}).catch(()=>{});
  }catch(e){}
}

function arte(ad,cls){
  if(ad.tipo==="casa") return `<img class="${cls}" src="img/premium/${E(ad.img||"roda")}.webp" alt="" loading="lazy">`;
  if(ad.img&&safeUrl(ad.img)) return `<img class="${cls}" src="${E(ad.img)}" alt="" loading="lazy" referrerpolicy="no-referrer">`;
  if(ad.tipo==="parceiro") return `<div class="${cls} adart-escola" aria-hidden="true"><svg viewBox="0 0 64 64" width="52" height="52"><g transform="rotate(35 32 32)" fill="#fff"><rect x="29.5" y="2" width="5" height="9" rx="1.6"/><rect x="30.6" y="10" width="2.8" height="22"/><circle cx="32" cy="38" r="8.2"/><circle cx="32" cy="51" r="10.5"/></g><g transform="rotate(35 32 32)"><circle cx="32" cy="43" r="3.4" fill="#1d4f91"/><rect x="28" y="52" width="8" height="2.2" rx="1" fill="#1d4f91"/></g></svg></div>`;
  return `<div class="${cls} adart-loja" aria-hidden="true">${ICO_CROWN}</div>`;
}
function rotulo(ad){return ad.tipo==="afiliado"?`Publicidade · link de parceiro${ad.loja?" · "+E(ad.loja):""}`:ad.tipo==="parceiro"?"Publicidade":"SambaCifra Premium"}

/* ===== bloco na cifra ===== */
function blocoHTML(ad,i){
  return `<span class="adslot" data-ad="${E(ad.id)}" data-i="${i}" contenteditable="false">`+
    `<span class="adlab">${rotulo(ad)}</span>`+
    `<span class="adcard ${ad.tipo==="casa"?"casa":""}" role="button" tabindex="0" data-adgo="${E(ad.id)}">`+
      arte(ad,"adimg")+
      `<span class="adtx"><span class="adkick">${E(ad.kick||ad.loja||"")}</span><b>${E(ad.titulo)}</b><span class="adtxt">${E(ad.texto||"")}</span>`+
      `${ad.preco?`<span class="adpreco">${E(ad.preco)}</span>`:""}<span class="adcta">${E(ad.cta||"Saiba mais")} ›</span></span>`+
    `</span>`+
    (ad.tipo!=="casa"?`<button class="adrm" type="button" data-adrm="1">${ICO_NO}<span>Remover anúncios</span></button>`:"")+
  `</span>`;
}
const porMusica={}; // mesma propaganda na mesma música ao redesenhar
function injeta(){
  const sh=document.getElementById("sheet");
  if(!sh||st.view!=="song") return;
  sh.querySelectorAll(".adslot").forEach(x=>x.remove());
  if(!ligado()) return;
  const c=C(),kids=[...sh.children],rows=kids.filter(x=>x.classList.contains("r")).length;
  if(rows<16) return; // cifra curta: sem anúncio
  // pontos de quebra: depois de um espaço entre estrofes, ou antes de uma linha de acordes que vem depois de uma linha de letra
  // (nunca separa o acorde da sílaba). Primeiro anúncio depois de ~inline_first estrofes/12 linhas; depois a cada ~inline_every_rows linhas.
  const first=Math.max(8,(+c.inline_first_rows||12)),every=Math.max(14,(+c.inline_every_rows||24)),max=+c.inline_max||2;
  const pos=[];let n=0,alvo=first;
  for(let i=0;i<kids.length&&pos.length<max;i++){
    const k=kids[i];
    if(k.classList.contains("r")){n++;
      const ehCr=k.classList.contains("cr"),ant=kids[i-1];
      if(ehCr&&n-1>=alvo&&ant&&ant.classList.contains("r")&&!ant.classList.contains("cr")&&rows-n>=6){pos.push({el:k,onde:"beforebegin"});alvo=n+every}
    }else if(k.classList.contains("gap")&&n>=alvo&&rows-n>=6){pos.push({el:k,onde:"afterend"});alvo=n+every}
  }
  if(!pos.length) return;
  const key=String(st.id);let esc_=porMusica[key];
  if(!esc_||esc_.length<pos.length){esc_=[];for(let i=0;i<pos.length;i++){const a=sorteia("cifra",esc_);if(a)esc_.push(a.id)}porMusica[key]=esc_}
  pos.forEach((p,i)=>{const ad=itens().find(x=>x.id===esc_[i]);if(!ad)return;p.el.insertAdjacentHTML(p.onde,blocoHTML(ad,i))});
  observa();
}
let io=null;
function observa(){
  if(!("IntersectionObserver" in window)) return;
  if(io) io.disconnect();
  io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){const ad=itens().find(x=>x.id===e.target.dataset.ad);if(ad)evento("imp",ad,"cifra");io.unobserve(e.target)}}),{threshold:.5});
  document.querySelectorAll(".adslot").forEach(x=>io.observe(x));
}

/* ===== ação dos anúncios ===== */
function abrePremium(ad){try{openDrawer("upsell",{why:(ad&&ad.why)||"ads"})}catch(e){}}
function vai(ad,local){
  evento("clique",ad,local);
  if(ad.tipo==="casa") return abrePremium(ad);
  const u=safeUrl(ad.link);if(u) window.open(u,"_blank","noopener");
}
document.addEventListener("click",e=>{
  const t=e.target.closest&&e.target.closest("[data-adgo],[data-adrm],[data-adx],[data-adbadge],[data-adbx]");
  if(!t) return;
  e.preventDefault();e.stopPropagation();
  if(t.dataset.adrm){const s=t.closest(".adslot,.adpop");const ad=s&&itens().find(x=>x.id===s.dataset.ad);if(ad)evento("remover",ad,s.classList.contains("adpop")?"popup":"cifra");fechaPop();return abrePremium({why:"ads"})}
  if(t.dataset.adgo){const ad=itens().find(x=>x.id===t.dataset.adgo);const pop=t.closest(".adpop");if(pop)fechaPop();if(ad)vai(ad,pop?"popup":"cifra");return}
  if(t.dataset.adx){const pop=document.querySelector(".adpop");const ad=pop&&itens().find(x=>x.id===pop.dataset.ad);if(ad)evento("fechar",ad,"popup");return fechaPop()}
  if(t.dataset.adbx){ss.set("badgeoff",1);return badge()}
  if(t.dataset.adbadge){evento("clique",{id:"selo"},"selo");return abrePremium({why:"ads"})}
},true);
document.addEventListener("keydown",e=>{
  if(e.key==="Escape"&&document.querySelector(".adpop")){fechaPop();return}
  if((e.key==="Enter"||e.key===" ")&&e.target.dataset&&e.target.dataset.adgo){e.preventDefault();e.target.click()}
});

/* ===== pop-up ===== */
function abrePop(local){
  if(!ligado()||document.querySelector(".adpop")) return false;
  const dr=document.getElementById("drawer");if(dr&&!dr.hidden) return false;
  try{if(roda.following||roda.host) return false}catch(e){}
  const ad=sorteia("popup",[ss.get("ultpop","")]);if(!ad) return false;
  ss.set("ultpop",ad.id);ss.set("popem",Date.now());
  const d=document.createElement("div");d.className="adpop";d.dataset.ad=ad.id;d.setAttribute("role","dialog");d.setAttribute("aria-modal","true");
  d.innerHTML=`<div class="adpopbox"><button class="adx" type="button" data-adx="1" aria-label="Fechar">${ICO_X}</button>`+
    `<div class="adpopart">${arte(ad,"adpopimg")}</div>`+
    `<div class="adpoptx"><span class="adkick">${E(ad.kick||rotulo(ad))}</span><h3>${E(ad.titulo)}</h3><p>${E(ad.texto||"")}</p>${ad.preco?`<p class="adpreco">${E(ad.preco)}</p>`:""}`+
    `<button class="primary adpopcta" type="button" data-adgo="${E(ad.id)}">${E(ad.cta||"Saiba mais")}</button>`+
    `${ad.tipo!=="casa"?`<button class="adrm" type="button" data-adrm="1">${ICO_NO}<span>Remover anúncios</span></button>`:`<button class="lnk adnao" type="button" data-adx="1">Agora não</button>`}`+
    `${ad.tipo!=="casa"?`<span class="adlab">${rotulo(ad)}</span>`:""}</div></div>`;
  d.addEventListener("click",e=>{if(e.target===d){evento("fechar",ad,"popup");fechaPop()}});
  document.body.appendChild(d);requestAnimationFrame(()=>d.classList.add("on"));
  evento("imp",ad,local);
  return true;
}
function fechaPop(){const d=document.querySelector(".adpop");if(!d)return;d.classList.remove("on");setTimeout(()=>d.remove(),180)}

/* tempo de uso: soma só o tempo com o app visível na tela. Passados ~5 min desde o último pop-up,
   ele aparece na próxima troca de tela (abrir uma música ou voltar ao início), nunca no meio da música.
   Quem chega do Google direto numa música não vê pop-up logo de cara (só o bloco na cifra). */
setInterval(()=>{if(document.visibilityState==="visible")ss.set("ativo",ss.get("ativo",0)+5000)},5000);
let ultimaTela="";
function trocaTela(){
  const tela=st.view==="song"?"song:"+st.id:st.view;
  if(tela===ultimaTela) return;
  const primeira=!ultimaTela;ultimaTela=tela;
  if(primeira||!(st.view==="song"||st.view==="home")) return;
  const c=C(),min=Math.max(2,+c.popup_every_min||5);
  if(ss.get("ativo",0)-ss.get("ativopop",0)<min*60000) return;
  setTimeout(()=>{if(ultimaTela===tela&&abrePop(st.view==="song"?"musica":"inicio"))ss.set("ativopop",ss.get("ativo",0))},1500);
}
function popAbertura(){
  const c=C();if(!c.popup_open||ss.get("abriu",0)) return;
  ss.set("abriu",1);
  setTimeout(()=>{
    // espera o login/assinatura carregar para não mostrar para quem é Premium
    if(st.view==="home"&&!location.hash&&abrePop("abertura")) ss.set("ativopop",ss.get("ativo",0));
  },+c.popup_open_delay||2500);
}

/* ===== selo flutuante ===== */
function badge(){
  let b=document.getElementById("adbadge");
  const mostra=ligado()&&C().badge&&st.view==="song"&&!ss.get("badgeoff",0);
  if(!mostra){if(b)b.remove();return}
  if(b) return;
  b=document.createElement("div");b.id="adbadge";
  b.innerHTML=`<button type="button" class="adbadge" data-adbadge="1" aria-label="Seja Premium">${ICO_CROWN}<span>Seja<br>Premium</span></button><button type="button" class="adbx" data-adbx="1" aria-label="Fechar">${ICO_X}</button>`;
  document.body.appendChild(b);
}

/* ===== ganchos no app ===== */
try{if(typeof PREM_WHY==="object")PREM_WHY.ads="Com o Premium você libera todas as ferramentas do SambaCifra."}catch(e){}
try{if(typeof PREM_IMG==="object"&&!PREM_IMG.ads)PREM_IMG.ads="rol"}catch(e){}
const _drawSong=window.drawSong, _redraw=window.redrawSheet, _draw=window.draw, _open=window.openDrawer;
if(typeof _open==="function") window.openDrawer=function(kind,arg){const r=_open.apply(this,arguments);
  try{if(kind==="upsell"&&arg&&arg.why==="ads"){const B=document.getElementById("dbody"),h=B&&B.querySelector(".pfhero");
    if(h){const k=h.querySelector(".pfkick"),t=h.querySelector("h3"),d=h.querySelector("p.sub");
      if(k)k.textContent="SambaCifra Premium";if(t)t.textContent="Toque com tudo liberado";
      if(d)d.textContent="Rolagem automática, batucada, Roda de Samba, repertórios sem limite, dicionário de acordes e muito mais.";}}}catch(e){}
  return r};
if(typeof _drawSong==="function") window.drawSong=function(){const r=_drawSong.apply(this,arguments);try{injeta()}catch(e){}return r};
if(typeof _redraw==="function") window.redrawSheet=function(){const r=_redraw.apply(this,arguments);try{injeta()}catch(e){}return r};
if(typeof _draw==="function") window.draw=function(){const r=_draw.apply(this,arguments);try{badge();trocaTela();if(st.stage||!ligado())document.querySelectorAll(".adslot").forEach(x=>x.remove())}catch(e){}return r};
window.scAds={abrePop,injeta,ligado,itens}; // para testes
popAbertura();
})();
