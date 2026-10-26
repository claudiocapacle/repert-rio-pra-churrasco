# SambaCifra

Cifras de samba e pagode para cavaquinho: troca de tom, desenho dos acordes, repertórios, rolagem por compasso, batucada, roda ao vivo e envio de cifras com revisão.

- Site estático (um `index.html`), instalável no celular (PWA) e com uso offline.
- Banco: Supabase (região São Paulo).
- Leitura de foto de cifra: função `ler-cifra` no Supabase. Para ativar, cadastre o segredo `ANTHROPIC_API_KEY` em Supabase → Edge Functions → Secrets.
- Área administrativa: abra o site com `#professor` no fim do endereço e digite a chave.

Publicação: Vercel, sem comando de build. Cada push na `main` atualiza o site.
