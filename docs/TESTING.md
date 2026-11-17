# Testes

| Suíte | Comando | Cobre |
|---|---|---|
| Motor | `npx vitest run src/test/dcs-motor.test.ts` | índice, pesos, N/A, parcial, dependências, faixas, matriz, janela 1 dia, recomendações, prioridades, reincidência, consolidação, e-commerce, C1–C5, cobertura, mensagens, permissões |
| n8n ≡ motor | `npx vitest run src/test/dcs-n8n.test.ts` | código dos workflows igual ao motor; sem segredos |
| Banco | `cd <pasta com @electric-sql/pglite> && node supabase/tests/dcs_fundacao.pglite.mjs supabase/migrations/*_dcs_*.sql` | RLS por carteira, financeiro, conta suspensa, concorrência de análise e de sync, versão otimista, histórico, idempotência, fila, alertas |
| Repositório | `npx tsc --noEmit`, `npx eslint .`, `npx vitest run` | — |

Resultados em 16/11/2026: 31 testes novos + 188 existentes aprovados (219); 32 cenários de banco aprovados; tsc 0 erros.
Homologação (a fazer): comparar índice/recomendações de 5 clientes reais com o artefato; operações simultâneas reais; falha de n8n/Pipedrive.
