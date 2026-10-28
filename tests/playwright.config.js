// Testes do SambaCifra em vários aparelhos (rodam no GitHub Actions 2x por semana e a cada atualização).
const { defineConfig, devices } = require("@playwright/test");
const so = process.env.SO_CHROMIUM === "1";
const todos = [
  { name: "iPhone", use: { ...devices["iPhone 13"] } },
  { name: "iPad (tablet)", use: { ...devices["iPad (gen 7)"] } },
  { name: "Android", use: { ...devices["Pixel 7"] } },
  { name: "Tablet Android", use: { ...devices["Galaxy Tab S4"] } },
  { name: "Notebook Chrome", use: { ...devices["Desktop Chrome"], viewport: { width: 1366, height: 768 } } },
  { name: "Notebook Safari", use: { ...devices["Desktop Safari"], viewport: { width: 1440, height: 900 } } },
];
module.exports = defineConfig({
  testDir: ".",
  timeout: 90_000,
  retries: 1,
  workers: 2,
  reporter: [["list"], ["html", { open: "never", outputFolder: "../relatorio-testes" }]],
  use: { baseURL: process.env.BASE || "https://www.sambacifra.com.br", serviceWorkers: "block", screenshot: "only-on-failure", trace: "retain-on-failure", locale: "pt-BR" },
  projects: so ? todos.filter(p => !/iPhone|iPad|Safari/.test(p.name)) : todos,
});
