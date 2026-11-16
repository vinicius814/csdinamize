# Plano de implementação

## Fase 0 — Auditoria (16/11/2026)
Ferramentas: GitHub (leitura; push pendente de permissão), Lovable (**bloqueado**: 403 "connections used by this project"),
Supabase (sem acesso direto; só via Lovable, bloqueado), Pipedrive (leitura ok), n8n (leitura/escrita ok).

Classificação do Munin:
1. **Preservar integralmente**: Supabase Auth/Google + trigger de e-mails; `profiles`, `user_roles`, `account_access`, `convites`, `audit_log`, `admin_settings`;
   sincronização central `cs_*` (snapshot, métricas, cancelamentos, auditoria, histórico, sync_runs) e `cs_pode_ver`; `integration_cache`, cripto, `conexoes_pipedrive`; `docs/regras-operacao-cs.md`; workflows n8n de onboarding.
2. **Reaproveitar com ajustes**: `AppShell`/`nav.ts` (nova navegação DCS), `auth.tsx`/AuthProvider, rotas `carteira`, `carteiras-cs`, `cliente.$dealId`, `configuracoes`, `admin`, `analise-gerencial`, componentes shadcn/ui, `reliability.ts`, `cs-rules.ts`.
3. **Substituir**: tela inicial pessoal (`index.tsx`), identidade "Munim", tema escuro padrão → marca Dinamize (#EA5456, fundo claro).
4. **Descontinuar após validação** (com backup): assistente pessoal — `itens`, `areas`, `ligacoes`, `conversas`, `item_embeddings`, Telegram (`telegram_*`, rotas `/api/public/telegram/*`), rotinas/briefings, telas `conversa`, `memoria`, `notas`, `projetos`, `mapa`, `retornos`, `agenda-atividades`, dependências `@ai-sdk/anthropic`, `@anthropic-ai/sdk`, `ai`.
   Não excluir antes de: exportar dados, confirmar que nenhum usuário/integração depende (Telegram V1 pessoal roda no Make e não usa este banco — confirmar).

## Fases
- [x] 0 — auditoria, mapeamento, docs, ponto de recuperação (tag), branch.
- [~] 1 — fundação: migrations (feito, testado em pglite), permissões (feito no banco), renomear projeto/identidade/navegação (pendente: UI).
- [~] 2 — carteira e Pipedrive: workflows 01–05 prontos (não importados); validação com dados reais em leitura (pendente); tela de carteira (pendente).
- [~] 3 — motor de diagnóstico: regras portadas e testadas; autosave/concorrência/histórico no banco; telas pendentes.
- [~] 4 — planos de ação: mesclagem e banco prontos; mensagens por template prontas; telas pendentes.
- [ ] 5 — visão geral, cobertura, inteligência, alertas (alertas no banco prontos), configurações.
- [ ] 6 — validação e segurança (advisor Supabase, testes de permissão com usuários reais, simultaneidade).
- [ ] 7 — homologação e publicação.

## Próximos lotes (ordem)
1. Liberar acesso (push GitHub; Lovable/Supabase) → aplicar migrations em homologação.
2. Criar credenciais DCS no n8n, importar 04 e 01 em modo leitura, conferir contagens com o artefato.
3. UI Fase 1–3 diretamente no repositório: rotas `src/routes/_authenticated/dcs/*`, nav, tema Dinamize; diagnóstico com autosave (debounce 1,5 s, `dcs_salvar_diagnostico`, conflito 40001 → recarregar e mesclar).
4. Planos, cobertura, visão geral, inteligência, usuários, configurações.
