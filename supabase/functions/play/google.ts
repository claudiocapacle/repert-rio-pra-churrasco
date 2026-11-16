// Acesso à API do Google Play (Android Publisher) com a conta de serviço guardada no segredo GOOGLE_PLAY_SA (JSON).
export const PACOTE = Deno.env.get("PLAY_PACOTE") || "br.com.sambacifra.app";
const API = "https://androidpublisher.googleapis.com/androidpublisher/v3/applications/" + PACOTE;

let cache: { tok: string; ate: number } | null = null;

function b64url(b: ArrayBuffer | Uint8Array | string): string {
  const bytes = typeof b === "string" ? new TextEncoder().encode(b) : new Uint8Array(b);
  let s = "";
  for (const x of bytes) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function tokenGoogle(): Promise<string> {
  if (cache && cache.ate > Date.now() + 60_000) return cache.tok;
  const raw = Deno.env.get("GOOGLE_PLAY_SA");
  if (!raw) throw new Error("sem conta de serviço (GOOGLE_PLAY_SA)");
  const sa = JSON.parse(raw);
  const agora = Math.floor(Date.now() / 1000);
  const cab = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const corpo = b64url(JSON.stringify({
    iss: sa.client_email, scope: "https://www.googleapis.com/auth/androidpublisher",
    aud: "https://oauth2.googleapis.com/token", iat: agora, exp: agora + 3600,
  }));
  const pem = String(sa.private_key).replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const chave = await crypto.subtle.importKey("pkcs8", der, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const ass = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", chave, new TextEncoder().encode(cab + "." + corpo));
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: cab + "." + corpo + "." + b64url(ass) }),
  });
  const j = await r.json();
  if (!r.ok || !j.access_token) throw new Error("google auth: " + (j.error_description || j.error || r.status));
  cache = { tok: j.access_token, ate: Date.now() + (j.expires_in || 3600) * 1000 };
  return cache.tok;
}

export type Assinatura = { estado: string; expira: string | null; produto: string | null; reconhecida: boolean; vinculado: string | null; bruto: unknown };

/** Estado atual de uma assinatura pelo token de compra (subscriptionsv2) */
export async function lerAssinatura(token: string): Promise<Assinatura> {
  const r = await fetch(API + "/purchases/subscriptionsv2/tokens/" + encodeURIComponent(token), {
    headers: { Authorization: "Bearer " + (await tokenGoogle()) },
  });
  const j = await r.json();
  if (!r.ok) throw new Error("google: " + (j.error?.message || r.status));
  const item = (j.lineItems || [])[0] || {};
  return {
    estado: String(j.subscriptionState || ""),
    expira: item.expiryTime || null,
    produto: item.productId || null,
    reconhecida: j.acknowledgementState === "ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED",
    vinculado: j.linkedPurchaseToken || null,
    bruto: { estado: j.subscriptionState, expira: item.expiryTime, produto: item.productId, pedido: j.latestOrderId, teste: !!j.testPurchase },
  };
}

/** Confirma a compra no Google (sem isso, o Google devolve o dinheiro em 3 dias) */
export async function reconhecer(produto: string, token: string): Promise<void> {
  const r = await fetch(API + "/purchases/subscriptions/" + encodeURIComponent(produto) + "/tokens/" + encodeURIComponent(token) + ":acknowledge", {
    method: "POST",
    headers: { Authorization: "Bearer " + (await tokenGoogle()), "content-type": "application/json" },
    body: "{}",
  });
  if (!r.ok && r.status !== 400) throw new Error("google acknowledge: " + r.status);
}

/** Grava no banco (função play_aplicar), com a service role */
export async function aplicar(email: string, user: string | null, token: string, a: Assinatura): Promise<string> {
  const URL_ = Deno.env.get("SUPABASE_URL")!, KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const r = await fetch(URL_ + "/rest/v1/rpc/play_aplicar", {
    method: "POST",
    headers: { "content-type": "application/json", apikey: KEY, Authorization: "Bearer " + KEY },
    body: JSON.stringify({ p_email: email, p_user: user, p_token: token, p_produto: a.produto, p_estado: a.estado, p_expira: a.expira, p_resumo: a.bruto }),
  });
  if (!r.ok) throw new Error("banco: " + r.status);
  return await r.json();
}
