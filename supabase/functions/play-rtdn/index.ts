// SambaCifra: avisos do Google Play (Real-time developer notifications, via Pub/Sub push).
// Renovação, cancelamento, reembolso, suspensão... Relê a assinatura no Google e atualiza o Premium.
// A URL de push do Pub/Sub leva ?k=<PLAY_RTDN_SEGREDO>.
import { aplicar, lerAssinatura } from "./google.ts";

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("ok");
  const segredo = (Deno.env.get("PLAY_RTDN_SEGREDO") || "").trim();
  if (!segredo || new URL(req.url).searchParams.get("k") !== segredo) return new Response("não autorizado", { status: 401 });

  let msg: any = {};
  try {
    const body = await req.json();
    msg = JSON.parse(atob(body?.message?.data || ""));
  } catch {
    return new Response("ok"); // mensagem que não entendemos: confirma para o Pub/Sub não reenviar sem fim
  }
  const token = msg?.subscriptionNotification?.purchaseToken;
  if (!token) return new Response("ok"); // teste do Console ou outro tipo de aviso

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
