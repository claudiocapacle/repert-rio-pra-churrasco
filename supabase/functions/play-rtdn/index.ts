// SambaCifra: avisos do Google Play (Real-time developer notifications, via Pub/Sub push).
// Renovação, cancelamento, reembolso, suspensão... Relê a assinatura no Google e atualiza o Premium.
// Autenticação: o Pub/Sub envia um token OIDC assinado pelo Google (conta de serviço PLAY_RTDN_SA).
// Alternativa antiga: ?k=<PLAY_RTDN_SEGREDO>, se esse secret existir.
import { aplicar, lerAssinatura } from "./google.ts";

const SA_ESPERADA = (Deno.env.get("PLAY_RTDN_SA") || "play-servidor@sambacifra-play.iam.gserviceaccount.com").trim();
const AUD = "https://lbspifonlkwnthvohyvv.supabase.co/functions/v1/play-rtdn";

function b64url(s: string): Uint8Array {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
}

let certs: { at: number; keys: any[] } | null = null;
async function chavesGoogle(): Promise<any[]> {
  if (certs && Date.now() - certs.at < 3600_000) return certs.keys;
  const r = await fetch("https://www.googleapis.com/oauth2/v3/certs");
  const j = await r.json();
  certs = { at: Date.now(), keys: j.keys || [] };
  return certs.keys;
}

async function tokenGoogleValido(auth: string | null): Promise<boolean> {
  if (!auth?.startsWith("Bearer ")) return false;
  const [h, p, s] = auth.slice(7).split(".");
  if (!h || !p || !s) return false;
  try {
    const head = JSON.parse(new TextDecoder().decode(b64url(h)));
    const body = JSON.parse(new TextDecoder().decode(b64url(p)));
    if (head.alg !== "RS256") return false;
    const jwk = (await chavesGoogle()).find((k) => k.kid === head.kid);
    if (!jwk) return false;
    const key = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
    const ok = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, b64url(s), new TextEncoder().encode(h + "." + p));
    if (!ok) return false;
    const agora = Date.now() / 1000;
    return (
      ["https://accounts.google.com", "accounts.google.com"].includes(body.iss) &&
      body.aud === AUD &&
      body.email === SA_ESPERADA &&
      body.email_verified === true &&
      body.exp > agora - 60
    );
  } catch {
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("ok");
  const segredo = (Deno.env.get("PLAY_RTDN_SEGREDO") || "").trim();
  const porSegredo = !!segredo && new URL(req.url).searchParams.get("k") === segredo;
  if (!porSegredo && !(await tokenGoogleValido(req.headers.get("authorization")))) {
    return new Response("não autorizado", { status: 401 });
  }

  let msg: any = {};
  try {
    const body = await req.json();
    msg = JSON.parse(atob(body?.message?.data || ""));
  } catch {
    return new Response("ok"); // mensagem que não entendemos: confirma para o Pub/Sub não reenviar sem fim
  }
  if (msg?.testNotification) {
    console.log("rtdn: teste do Console recebido");
    return new Response("ok");
  }
  const token = msg?.subscriptionNotification?.purchaseToken;
  if (!token) return new Response("ok");

  const URL_ = Deno.env.get("SUPABASE_URL")!, KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  try {
    const r = await fetch(URL_ + "/rest/v1/rpc/play_dono", {
      method: "POST",
      headers: { "content-type": "application/json", apikey: KEY, Authorization: "Bearer " + KEY },
      body: JSON.stringify({ p_token: token }),
    });
    const dono = r.ok ? await r.json() : null;
    if (!dono?.email) {
      // compra ainda não confirmada pelo app (o app confirma ao abrir): nada a fazer agora
      console.log("rtdn: token sem dono", msg?.subscriptionNotification?.notificationType);
      return new Response("ok");
    }
    const a = await lerAssinatura(token);
    const res = await aplicar(dono.email, dono.user_id || null, token, a);
    console.log("rtdn", msg?.subscriptionNotification?.notificationType, res);
    return new Response("ok");
  } catch (e) {
    console.log("rtdn erro", String(e));
    return new Response("tente de novo", { status: 500 }); // o Pub/Sub reenvia depois
  }
});
