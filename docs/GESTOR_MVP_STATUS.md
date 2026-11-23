# Dinamize CS — Gestão Operacional MVP (status)

Frente nova, aditiva, sobre o produto Dinamize CS já publicado (Beta 1.1). Não mexe no artefato Gestor
(outro projeto, repo/VPS separados) nem no motor de diagnóstico (`src/lib/dcs/motor.ts`, `artefato-v1.ts`).

## Checkpoint
- Branch: `dinamize-cs/gestor-operacional-mvp`, criada a partir de `main@3008d74` (23/11/2026).
- Push ao GitHub confirmado nesta sessão (acesso liberado por admin da org). Repo foi transferido/renomeado para
  `vinicius814/omunim` — **continua público, com `.env` commitado na raiz** (pendência de segurança já registrada
  nos docs antigos como A-08; só o dono resolve via GitHub settings).

## Módulos implementados (confirmados por módulo entre `dcs_*`/`src/components/dcs`)
Visão geral, Carteira de clientes, Minhas análises, Planos de ação, Cobertura de CS, Alertas e pendências,
Inteligência gerencial, Histórico de diagnósticos, Usuários e permissões, Configurações, Integrações,
Diagnóstico detalhado (motor completo, testado). Onboarding guiado do app (tours) também existe, mas é
funcionalidade diferente do onboarding operacional de clientes.

## Gaps confirmados (pedidos no spec, ausentes no módulo `dcs_*`)
- Cancelamentos e retenção — só existe em `cs_cancelamentos` (sistema Munim legado), não portado.
- Onboarding operacional de clientes (pipeline Pipedrive id 1, 8 etapas) — não existe no `dcs_*`.
- Gestão da equipe (visão por responsável) — só existe como `/carteiras-cs` no sistema legado.
- Radar de inteligência — hoje é "Alertas e pendências", sem estrutura motivo/evidência/prioridade/ação.
- Metas — não existe.
- Assistente gerencial — não existe.
- Relatórios gerenciais — "Inteligência gerencial" cobre parte, não a amplitude pedida.

## Arquivos principais
- Navegação: `src/components/dcs/navegacao.ts`, `src/components/dcs/Shell.tsx`.
- Pipedrive: pipeline Onboarding id 1 (8 etapas, validado via API em 23/11/2026).
- Supabase: projeto "Munim V2" (`dknywurmzgrkxiytvncp`). Achados do advisor de segurança: 8 tabelas legadas
  `cs_*`/`google_tokens`/`registros` com RLS habilitado e sem política (achado, não corrigido ainda);
  leaked password protection desativada (pendência já conhecida).

## Feito (23/11/2026)
- Lovable (commit `8855377`, ainda não sincronizado com o GitHub): menu reorganizado em
  Início/Operação/Acompanhamento/Inteligência/Diagnósticos/Administração; itens novos (Assistente, Onboarding,
  Gestão da equipe, Atividades e pendências, Cancelamentos e retenção, Metas) como "Em breve", sem alterar rotas
  nem lógica existente. tsc/vitest(293)/lint/build ok.
- GitHub (branch `dinamize-cs/gestor-operacional-mvp`): commits `9d216e0`→`f7eab44`.
- Supabase: tabela `dcs_pipeline_onboarding` (funil Onboarding, pipeline_id=1; aditiva, RLS igual a `dcs_clientes`)
  + função `dcs_publicar_pipeline_onboarding` (espelha `dcs_publicar_carteira`, reusa `dcs_iniciar_sync`/`dcs_falhar_sync`
  com `p_tipo='onboarding'`). Migrations aplicadas no banco real e commitadas no repo.
- n8n: workflow `Dinamize CS | 13 — Sincronização do funil Onboarding` (ID `07ed9XQEH6Fw5Qnm`, validado, **inativo**)
  lê o funil 1 do Pipedrive (paginado) e publica em `dcs_pipeline_onboarding`. Fonte em `n8n/sdk/13-onboarding.sdk.js`.

## Feito (23/11/2026, continuação)
- Prioridade 1 (Carteira consolidada / Cliente 360): ficha do cliente (`dcs/cliente.$key`)
  ganhou Negócios relacionados (todos os `deal_ids`), Riscos (alertas do próprio cliente,
  reaproveitando `alertas.tsx`), Situação de onboarding (liga a `dcs_pipeline_onboarding` por
  `org_id`) e detalhe (subject) dos registros de contato. Carteira de clientes ganhou coluna
  "Onboarding" (etapa do funil id 1, quando a mesma org tem negócio lá). Commits `71f461e`,
  `c7a6c2e`.
- Prioridade 2 (Onboarding): rota `/dcs/onboarding` nova e real (não "Em breve") — lista,
  filtra por etapa/responsável/busca, mostra dias na etapa, liga à ficha CS quando existe e
  ao negócio no Pipedrive. Módulo "onboarding" em `MODULOS_POR_PERFIL` (admin/cs) + nav.
  Não implementado (precisa do artefato Gestor ou de regra de prazo validada, e da sincronização
  de atividades do funil Onboarding, nenhuma das duas disponível ainda): clientes atrasados,
  atividades relacionadas, próximos contatos. Commit `9ea2832`.
- Todas as mudanças com tsc/vitest(293)/eslint/build limpos a cada commit.

## Bloqueio aberto
- **Credenciais do workflow 13 não foram anexadas automaticamente** (5 nós HTTP: Abrir sincronização, Usuários
  Pipedrive, Negócios do funil Onboarding, Publicar onboarding, Registrar falha). As credenciais existem no n8n
  com os IDs corretos (`TqXGYCOmVGd2AvKp` Supabase, `RLiF1ChIGaWvWg1f` Pipedrive) mas precisam ser selecionadas
  manualmente em cada nó na UI do n8n (n8n.dinamize.com.br/workflow/07ed9XQEH6Fw5Qnm) antes de ativar. Até lá o
  workflow fica inativo — não vou ativá-lo sem credencial confirmada.
- Lovable (commit `8855377`) ainda não apareceu em nenhuma branch do GitHub via `git ls-remote` — sincronização
  pendente do lado do Lovable; acompanhar antes de mesclar com o trabalho feito direto no GitHub.

## Pendências antigas (independentes desta frente)
- Repo público + `.env` commitado (agora em `vinicius814/omunim`): ação do dono no GitHub.
- RLS sem política em 8 tabelas legadas (`cs_*`/`google_tokens`/`registros`): avaliar antes de criar política ou remover.
- Transferência de Master, Supabase Auth (leaked password protection), usuário de integração dedicado no Pipedrive:
  já registradas em `docs/PROJECT_STATUS.md`.

## Próxima etapa
1. Você (ou alguém com acesso ao n8n) anexar as credenciais no workflow 13 (ver Bloqueio aberto);
   eu ativo e testo com uma execução manual. Enquanto isso as telas de onboarding mostram
   corretamente "sem negócio sincronizado" (não é bug).
2. Seguir para Prioridade 3 — Gestão da equipe (visão por responsável/colaborador).
