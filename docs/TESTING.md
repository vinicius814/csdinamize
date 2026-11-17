# Testes

| Suíte | Comando | Cobre |
|---|---|---|
| Motor | `npx vitest run src/test/dcs-motor.test.ts` | índice, pesos, N/A, parcial, dependências, faixas, matriz, janela 1 dia, recomendações, prioridades, reincidência, consolidação, e-commerce, C1–C5, cobertura, mensagens, permissões |
| n8n ≡ motor | `npx vitest run src/test/dcs-n8n.test.ts` | código dos workflows igual ao motor; sem segredos |
| Banco | `cd <pasta com @electric-sql/pglite> && node supabase/tests/dcs_fundacao.pglite.mjs supabase/migrations/*_dcs_*.sql` | RLS por carteira, financeiro, conta suspensa, concorrência de análise e de sync, versão otimista, histórico, idempotência, fila, alertas |
| Repositório | `npx tsc --noEmit`, `npx eslint .`, `npx vitest run` | — |

Resultados em 16/11/2026: 31 testes novos + 188 existentes aprovados (219); 32 cenários de banco aprovados; tsc 0 erros.
Homologação (a fazer): comparar índice/recomendações de 5 clientes reais com o artefato; operações simultâneas reais; falha de n8n/Pipedrive.

## 17/11/2026 — transformação completa
- `src/test/dcs-indicadores.test.ts` (8): KPIs, adesão sem N/A, aproveitamento pelo índice do motor, planos, séries semanais, críticos, evolução.
- `src/test/dcs-config.test.ts` (4): validação de pesos, faixas e metas antes de publicar regras.
- Banco: 47 cenários pglite (master, edição, elevação de privilégio, último master, pedidos idempotentes).
- Visual: `scripts/visual/` (ver README) — 13 telas autenticadas + 4 públicas × 5 resoluções sem rolagem horizontal da página e sem marca antiga.
- Repositório: tsc 0 erros; vitest 234 aprovados; build ok. Lint: código novo sem erros; arquivos legados mantêm avisos de formatação pré-existentes.
