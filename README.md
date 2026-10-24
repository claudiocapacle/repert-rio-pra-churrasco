# Repertório pra Churrasco

App de cifras do Claudio Capacle: cifras corrigidas com tempo de troca, troca de tom, repertórios, rolagem por compasso, roda ao vivo e envio de cifras com revisão.

- Site estático (um `index.html`), instalável no celular (PWA) e com uso offline.
- Banco: Supabase (projeto `repertorio-pra-churrasco`, região São Paulo).
- Leitura de foto de cifra: função `ler-cifra` no Supabase. Para ativar, cadastre o segredo `ANTHROPIC_API_KEY` em Supabase → Edge Functions → Secrets.
- Área do professor: abra o site com `#professor` no fim do endereço e digite a chave.

Publicação: importe este repositório na Vercel (Framework: Other, sem comando de build). Cada push na `main` atualiza o site.
