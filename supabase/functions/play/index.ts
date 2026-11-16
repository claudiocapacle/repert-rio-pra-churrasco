// SambaCifra: confirma no Google Play a assinatura comprada dentro do app Android e libera o Premium na conta logada.
import { aplicar, lerAssinatura, reconhecer } from "./google.ts";

const PRODUTOS = (Deno.env.get("PLAY_PRODUTOS") || "premium_mensal,premium_anual").split(",").map((s) => s.trim());
const CORS = {
  "Access-Control-Allow-Origin": "https://www.sambacifra.com.br",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const resp = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...CORS, "content-type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return resp({ ok: false }, 405);

  // quem está logado (o JWT do Supabase já foi validado pela plataforma)
  const URL_ = Deno.env.get("SUPABASE_URL")!, ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
  const u = await fetch(URL_ + "/auth/v1/user", { headers: { apikey: ANON, Authorization: req.headers.get("Authorization") || "" } });
  if (!u.ok) return resp({ ok: false, erro: "entre na sua conta" }, 401);
  const user = await u.json();
  const email = String(user.email || "").toLowerCase();
  if (!email) return resp({ ok: false, erro: "conta sem e-mail" }, 400);

  let body: any = {};
  try { body = await req.json(); } catch { return resp({ ok: false, erro: "json inválido" }, 400); }
  const token = String(body.token || "");
  if (body.acao !== "verificar" || !token || token.length > 1000) return resp({ ok: false, erro: "pedido inválido" }, 400);

  try {
    const a = await lerAssinatura(token);
    if (!a.produto || !PRODUTOS.includes(a.produto)) return resp({ ok: false, erro: "produto desconhecido" }, 400);
    if (!a.reconhecida && (a.estado === "SUBSCRIPTION_STATE_ACTIVE" || a.estado === "SUBSCRIPTION_STATE_IN_GRACE_PERIOD")) {
      await reconhecer(a.produto, token);
    }
    const resultado = await aplicar(email, user.id || null, token, a);
    const premium = resultado.startsWith("premium ativo") || resultado.startsWith("cancelado") || resultado.startsWith("mantido");
    return resp({ ok: premium, resultado, estado: a.estado, expira: a.expira });
  } catch (e) {
    console.log("play verificar", String(e));
    return resp({ ok: false, erro: "não foi possível confirmar agora" }, 502);
  }
});
