# Publicação, recuperação e manutenção

## Pontos de recuperação do código
- `checkpoint/pre-beta-2026-11-18` → `4161efd` (= `main` antes do Beta). Tag `backup/munin-pre-dcs-2026-11-16` → último Munin (`3455efe`).
- Trabalho do Beta na branch `dinamize-cs/finalizacao-beta`. O Lovable sincroniza com `main`: merge só fast-forward, nunca force push (AGENTS.md).

## Banco (já aplicado em 18/11/2026)
| Versão | Migration | Rollback |
|---|---|---|
| 20261118163544 | `dcs_beta_acesso` (convites, permissões, senha provisória, onboarding, feedback) | `supabase/rollback/20261118163544_dcs_beta_acesso.down.sql` |
| 20261118163708 | `dcs_beta_endurecimento` | `..._dcs_beta_endurecimento.down.sql` |
| 20261118163837 | `beta_legado_restrito` | `..._beta_legado_restrito.down.sql` |

Rollback em ordem inversa; antes, exportar `dcs_seguranca_conta`, `dcs_onboarding`, `dcs_feedback`. O rollback reabre o cadastro sem convite.

## Variáveis e segredos
- Front-end: só `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID`.
- Servidor (Lovable Cloud): `SUPABASE_SERVICE_ROLE_KEY` (usada só em `client.server.ts` e `acesso.functions.ts`). Nunca no repositório.
- Commit e data do build entram automaticamente (`vite.config.ts` → "Sobre o sistema").

## Supabase Auth (painel, recomendado)
- Redirect URLs: incluir `<domínio>/definir-senha` e `<domínio>/auth` (link de convite e recuperação).
- Ativar *Leaked password protection* (M-01). API → *Max rows* 1000 (M-03).
- Templates de e-mail de convite/recuperação: assunto "Dinamize CS — acesso", sem senha no corpo.

## n8n
Workflows vigentes em `n8n/sdk/*.sdk.js` (IDs em `n8n/sdk/README.md`); nada mudou no Beta. Registro no Pipedrive (06) só após ativação pelo Master.

## Publicação (após a homologação do Vinícius)
1. `git checkout main && git merge --ff-only dinamize-cs/finalizacao-beta && git push origin main`.
2. Lovable: conferir que o preview atualizou (estado *ready*) e testar login, convite e uma análise.
3. Publish no Lovable (publicação definitiva) — somente com aprovação explícita.
4. Comunicar a equipe e enviar os convites reais.
