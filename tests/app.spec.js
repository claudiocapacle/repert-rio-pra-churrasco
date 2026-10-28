// O que precisa estar sempre funcionando no SambaCifra.
const { test, expect } = require("@playwright/test");

async function abrir(page) {
  const erros = [];
  page.on("pageerror", e => erros.push(e.message));
  await page.goto("/");
  await page.waitForFunction(() => typeof SONGS !== "undefined" && SONGS.length > 1000 && typeof go === "function", null, { timeout: 30_000 });
  await page.waitForFunction(() => typeof AUTH_OK !== "undefined" && AUTH_OK, null, { timeout: 30_000 }).catch(() => {});
  return erros;
}

test("tela inicial abre sem erros", async ({ page }) => {
  const erros = await abrir(page);
  await expect(page.locator(".brand")).toBeVisible();
  await expect(page.locator(".sec", { hasText: "Músicas em alta" })).toBeVisible();
  await expect(page.locator(".appfoot")).toContainText("versão");
  expect(await page.evaluate(() => SONGS.length)).toBeGreaterThan(2500);
  expect(erros).toEqual([]);
});

test("abre cifras de todos os pacotes do acervo", async ({ page }) => {
  const erros = await abrir(page);
  const ids = await page.evaluate(() => { const r = []; for (let c = 0; c < CHUNKS.length; c++) { const s = SONGS.filter(x => x.c === c); r.push(s[0].id, s[s.length - 1].id); } return r; });
  const falhas = [];
  for (const id of ids) {
    await page.evaluate(id => go("song", { id }), id);
    try {
      await page.waitForFunction(() => document.querySelectorAll("#sheet .r").length > 2 && document.querySelector("#shead h2"), null, { timeout: 15_000 });
    } catch { falhas.push(id + ": " + (await page.locator(".errbox b").textContent().catch(() => "sem resposta"))); }
  }
  expect(falhas, "cifras que não abriram").toEqual([]);
  expect(erros).toEqual([]);
});

test("busca encontra músicas e artistas", async ({ page }) => {
  await abrir(page);
  await page.locator("#q").fill("zeca pagodinho");
  await expect(page.locator("#tabbody").getByText("Zeca Pagodinho").first()).toBeVisible();
});

test("tela da música: tom, tamanho da letra, quebrar linhas", async ({ page }) => {
  const erros = await abrir(page);
  await page.evaluate(() => go("song", { id: SONGS.find(s => s.title === "Iracema")?.id || SONGS[0].id }));
  await page.waitForSelector("#sheet .r");
  const fs0 = await page.evaluate(() => st.fs);
  await page.locator('[data-fs="1"]').click();
  expect(await page.evaluate(() => st.fs)).toBe(fs0 + 1);
  await page.locator('[data-fs="-1"]').click();
  await page.locator("[data-fit]").click();
  await page.locator("[data-fit]").click();
  await page.locator('#tools [data-tool="tom"]').click();
  await expect(page.locator("#drawer")).toBeVisible();
  expect(erros).toEqual([]);
});

test("visitante vê o convite do Premium nas ferramentas (com a cobrança ligada)", async ({ page }) => {
  await abrir(page);
  const cobrando = await page.evaluate(() => CFG.cobranca === true);
  test.skip(!cobrando, "cobrança desligada no painel");
  await expect(page.locator("#pTag")).toContainText("Seja Premium");
  await page.evaluate(() => { T.aba = "afinador"; go("tools", {}); });
  await expect(page.locator("#drawer .prembrand")).toBeVisible();
  await expect(page.locator("#drawer")).toContainText("Premium");
});

test("ferramentas funcionam para assinante", async ({ page }) => {
  const erros = await abrir(page);
  await page.evaluate(() => { PREMIUM = true; closeDrawer(); T.aba = "afinador"; go("tools", {}); });
  await expect(page.locator(".cvneck")).toBeVisible();
  await page.locator('.cordas.cv [data-corda="1"]').click();
  await expect(page.locator(".cvstr.vib")).toHaveCount(1);
  for (const aba of ["metronomo", "batucadas", "tom"]) { await page.evaluate(a => { T.aba = a; drawTools(); }, aba); await page.waitForTimeout(400); }
  await expect(page.locator(".roda")).toBeVisible();
  expect(erros).toEqual([]);
});

test("checkout da Hotmart configurado e no ar", async ({ page, request }) => {
  await abrir(page);
  const cfg = await page.evaluate(() => ({ m: CFG.checkout_mensal, a: CFG.checkout_anual, pm: CFG.preco_mensal, pa: CFG.preco_anual }));
  for (const u of [cfg.m, cfg.a]) {
    expect(u).toMatch(/^https:\/\/pay\.hotmart\.com\//);
    const r = await request.get(u);
    expect(r.status(), u).toBeLessThan(400);
  }
  expect(cfg.pm).toBeTruthy();
  expect(cfg.pa).toBeTruthy();
});

test("arquivos do app existem no servidor", async ({ page, request }) => {
  await abrir(page);
  const arquivos = await page.evaluate(() => CHUNKS.map(c => "data/" + c).concat(["sw.js", "manifest.webmanifest", "privacidade.html", "vendor/supabase.js", "img/premium/af.webp"]));
  const faltando = [];
  for (const a of arquivos) { const r = await request.head("/" + a); if (r.status() >= 400) faltando.push(a + " " + r.status()); }
  expect(faltando).toEqual([]);
});

test("link do painel pede login", async ({ page }) => {
  await page.goto("/#painel");
  await page.waitForFunction(() => typeof dr !== "undefined" && dr && dr.kind === "conta", null, { timeout: 30_000 });
});
