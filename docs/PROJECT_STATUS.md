# Status do projeto

**Fase atual:** 0 concluída; 1–4 parcialmente (back-end, motor, integrações). Interface ainda não iniciada.
**Branch:** `dinamize-cs/fase-0` (local; push aguardando permissão). **Base:** `main@3455efe` (tag `backup/munin-pre-dcs-2026-11-16`).

## Concluído (implementado + testado)
- Porte 1:1 da metodologia (`src/lib/dcs/artefato-v1.ts`) e motor com correções C1–C5 (`src/lib/dcs/motor.ts`): 28 testes.
- Migrations `dcs_*` (acesso, regras versionadas, carteira + financeiro isolado, cobertura, diagnósticos/ciclos/eventos, plano de ação,
  outbox, logs, alertas, config, mensagens, preferências) + rollback: 32 cenários pglite aprovados.
- 10 workflows n8n importáveis + código compartilhado testado contra o motor: 3 testes.
- Repositório: tsc 0 erros, eslint ok, 219 testes aprovados.
- IDs do Pipedrive validados por leitura (funil, etapas, campos, opção 360).

## Implementado, não homologado
- Migrations não aplicadas em nenhum Supabase real. Workflows não importados no n8n.

## Pendente
- Interface completa (todas as telas), renomear projeto no Lovable, identidade visual.
- Validação com dados reais em leitura; homologação; produção.

## Situação dos bloqueios (17/11/2026)
1. GitHub: branch `dinamize-cs/fase-0` publicada. A tag `backup/munin-pre-dcs-2026-11-16` não sobe (o proxy derruba o push de tags); o ponto de recuperação continua sendo o commit `3455efe` (`main`).
2. Lovable e Supabase: acesso liberado. Banco auditado (3 usuários ativos). Migration 1 aplicada; migration 2 aguardando a confirmação pedida pelo conector do Supabase.
3. Cobertura (D5): aguardando confirmação; campo do Pipedrive localizado. D13 (tipos novos de atividade) também.
4. Dados do artefato: o artefato não aparece entre os artefatos da conta (pertence a outra conta ou link compartilhado) → exportação CSV pelo próprio artefato.
5. n8n: existe a credencial "Pipedrive account" (dá para reaproveitar); faltam a de service role do Supabase e o segredo dos webhooks (o conector não cria credenciais).

## Próxima ação objetiva
Confirmar e aplicar a migration 2; depois interface (navegação, carteira, diagnóstico com autosave).
