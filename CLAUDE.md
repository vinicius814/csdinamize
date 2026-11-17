# Dinamize CS — instruções permanentes para o Claude

Produto: **Dinamize CS — Plano de Ação e Diagnóstico de Contas** (nome curto: Dinamize CS), reconstruído a partir do
projeto Lovable "Munin" (este repositório, `omunim`). Regras de sincronização com o Lovable: ver AGENTS.md
(nunca reescrever histórico publicado; `main` sincroniza com o editor e precisa estar sempre funcional).

## Ao retomar uma sessão
1. Leia `docs/PROJECT_STATUS.md` (fase atual, bloqueios, próxima ação). Só depois abra arquivos da tarefa.
2. Regras de negócio: `docs/BUSINESS_RULES.md`. Mapa artefato → app: `docs/ARTIFACT_MAPPING.md`.
3. Decisões já tomadas: `docs/DECISIONS.md` (não reabrir sem motivo novo).

## Onde fica cada coisa
- Metodologia original (porte 1:1, não editar): `src/lib/dcs/artefato-v1.ts`.
- Motor com correções C1–C5 (único ponto de regra no app): `src/lib/dcs/motor.ts` + `src/test/dcs-motor.test.ts`.
- Banco: `supabase/migrations/20261117142211_dcs_fundacao.sql`, `..._dcs_integracoes_alertas.sql`; rollback em `supabase/rollback/`;
  cenários de RLS/concorrência em `supabase/tests/dcs_fundacao.pglite.mjs` (rodar: ver docs/TESTING.md).
- n8n: workflows vigentes em `n8n/sdk/*.sdk.js` (IDs em `n8n/sdk/README.md`), atualizados pelo conector; lógica compartilhada em `n8n/src/*.js` (equivalência testada). `n8n/workflows/*.json` é referência histórica.

## Regras de trabalho
- Mudanças aditivas no banco (prefixo `dcs_`); nada do Munin é removido sem backup e item em DECISIONS.
- Toda escrita passa por função SECURITY DEFINER com checagem de permissão; tabelas só têm SELECT para `authenticated`.
- Financeiro só em `dcs_clientes_financeiro` (RLS por `dcs_ve_financeiro()`); ocultar na interface não é segurança.
- Nenhuma gravação real no Pipedrive sem autorização: `dcs_config.pipedrive_escrita.ativa=false` e jobs em `aguardando_autorizacao`.
- Segredos só em credenciais do n8n / secrets do Supabase. Nunca no repositório, front-end ou chat.
- Regra nova ou alterada = teste novo. Funcionalidade só é "concluída" com dados reais, permissão e teste.
- Commits pequenos; atualizar `docs/PROJECT_STATUS.md` ao fim de cada etapa.
