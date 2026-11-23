# Dinamize CS — Gestão Operacional MVP (status)

Frente nova, aditiva, sobre o produto Dinamize CS já publicado (Beta 1.1). Não mexe no artefato Gestor
(outro projeto, repo/VPS separados) nem no motor de diagnóstico (`src/lib/dcs/motor.ts`, `artefato-v1.ts`).

## Checkpoint
- Branch: `dinamize-cs/gestor-operacional-mvp`, criada a partir de `main@3008d74` (23/11/2026).
- Repo transferido/renomeado para `vinicius814/omunim` — **continua público, com `.env` commitado na raiz**
  (pendência de segurança A-08; dono decidiu "registrar e seguir depois").

## Módulos implementados (confirmados por módulo entre `dcs_*`/`src/components/dcs`)
Visão geral, Carteira de clientes (+ Cliente 360 ampliado), Minhas análises, Planos de ação,
Cobertura de CS, **Onboarding** (novo), **Gestão da equipe** (novo), **Atividades e pendências**
(novo), **Cancelamentos e retenção** (novo), **Radar de inteligência** (evolução de "Alertas e
pendências"), Inteligência gerencial, Histórico de diagnósticos, Usuários e permissões,
Configurações, Integrações, Diagnóstico detalhado (motor completo, testado). Onboarding guiado
do app (tours) também existe, mas é funcionalidade diferente do onboarding operacional de
clientes (pipeline Pipedrive id 1).

## Gaps confirmados (pedidos no spec, ainda ausentes)
- Relatórios gerenciais (Prioridade 8) — "Inteligência gerencial" cobre parte, não a amplitude pedida.
- Assistente e Metas (Prioridade 9) — não existem.
- Onboarding (Prioridade 2): sem "clientes atrasados" (falta regra de prazo por etapa validada — artefato
  Gestor não consultado ainda) nem atividades específicas desse funil.

## Arquivos principais
- Navegação: `src/components/dcs/navegacao.ts`, `src/components/dcs/Shell.tsx`.
- Onboarding (pipeline Pipedrive id 1, 8 etapas validadas via API 23/11/2026): `src/lib/dcs/onboarding.ts`.
- Dados agregados: `src/lib/dcs/dados.ts` (`usePipelineOnboarding`, `useAtividades`, `useAlertas`, `usePlanos`).
- Supabase: projeto "Munim V2" (`dknywurmzgrkxiytvncp`). Achados do advisor: 8 tabelas legadas
  `cs_*`/`google_tokens`/`registros` com RLS sem política (não corrigido); leaked password protection desativada.

## Feito (23/11/2026)
- Lovable (commit `8855377`, **ainda não sincronizado com o GitHub**): reorganização de menu com itens
  "Em breve" — superada pelo trabalho direto no GitHub abaixo (módulos reais, não placeholders).
- **Prioridade 1 — Carteira consolidada / Cliente 360**: ficha do cliente ganhou Negócios relacionados
  (todos os `deal_ids`), Riscos (alertas do próprio cliente), Situação de onboarding (liga a
  `dcs_pipeline_onboarding` por `org_id`) e detalhe das atividades de contato. Carteira ganhou coluna
  "Onboarding". Commits `71f461e`, `c7a6c2e`.
- **Prioridade 2 — Onboarding**: rota `/dcs/onboarding` real — lista, filtra por etapa/responsável/busca,
  dias na etapa, liga à ficha CS e ao negócio no Pipedrive. Dados: tabela `dcs_pipeline_onboarding` +
  função `dcs_publicar_pipeline_onboarding` + workflow n8n `13-onboarding.sdk.js` (ID `07ed9XQEH6Fw5Qnm`,
  **inativo**, credencial pendente). Commit `9ea2832`.
- **Prioridade 3 — Gestão da equipe**: rota `/dcs/equipe` real — por colaborador: clientes ativos, valor
  autorizado (gated), % cobertura em dia, ações abertas/atrasadas, clientes em risco, sem próximo contato,
  onboardings ativos, implementações em andamento, diagnósticos por status; link para a carteira filtrada.
  Commit `f5e2aef`.
- **Prioridade 4 — Atividades e pendências**: rota `/dcs/atividades` real — atrasadas/hoje/próximas/todas,
  filtro por responsável, destaque de clientes com ação crítica, link para ficha/Pipedrive, clientes sem
  atividade futura. Dados: tabela `dcs_atividades` + função `dcs_publicar_atividades` + workflow n8n
  `14-atividades.sdk.js` (ID `vClNoAV71FeudEhr`, **inativo**, mesmo bloqueio de credencial). Só leitura —
  sem criar/concluir atividade e sem agenda paralela. Commit `789e077`.
- **Prioridade 5 — Cancelamentos e retenção**: validado direto no Pipedrive (23/11/2026) que o funil CS
  (pipeline_id=15) tem etapa própria "Cancelados" (stage_id=105) com `lost_reason`/`lost_time` reais
  (motivos: "Consta como cancelado no financeiro", "Baixo Resultado", "Mudança de Sistema", "Covid-19",
  "Sem Retorno/Resposta" — amostra de 5 negócios); `dcs_regras.config.stages` já exclui essa etapa do
  funil ativo (`[101,102,103,135,147,104]`), ou seja `dcs_clientes.ativo=false` já é hoje o sinal de
  "saiu do funil", mas sem motivo/data registrados em lugar nenhum. Rota `/dcs/cancelamentos` real:
  lista de cancelamentos (data/cliente/responsável/valor Pipedrive — nunca chamado de MRR/taxa de churn
  —/motivo) com filtro por período/responsável/motivo, e três painéis de retenção preventiva sobre
  clientes ATIVOS (não confundidos com os cancelados acima): com risco identificado (alertas),
  sem utilização (`dcs_utilizacao`), sem acompanhamento agendado (`dcs_cobertura.proximo`). Dados: tabela
  nova `dcs_cancelamentos` (histórico — upsert, nunca inativado/excluído) + função
  `dcs_publicar_cancelamentos` + workflow n8n `15-cancelamentos.sdk.js` (ID `JLSSTrhLrJCJbSoD`,
  **inativo**, mesmo bloqueio de credencial manual, 5 nós HTTP). Commit `7b20afd`.
- **Prioridade 6 — Radar de inteligência**: evolução de "Alertas e pendências" (mesma rota
  `/dcs/alertas`, renomeada na navegação) — mesma tabela `dcs_alertas`/função
  `dcs_atualizar_alertas` (full-replace diário), agora com um 6º tipo real,
  `cancelamento_recente` (cruza `dcs_cancelamentos`, últimos 30 dias, só quando o cliente ainda
  tem linha em `dcs_clientes` — RLS exige). Cada linha passou a trazer explicitamente
  motivo/evidência (coluna já existente), **ação sugerida** (texto de orientação por tipo, não é
  dado do cliente) e **link direto** ao negócio no Pipedrive (reaproveita `dcs_clientes.deal_id` +
  helper `pipedriveDeal`, já usado em outras telas). Não criei alertas de atraso para
  Onboarding/Implementação por falta de uma regra de prazo por etapa validada (mesmo gap já
  registrado abaixo) — melhor não ter o alerta do que inventar um prazo. Commit pendente.
- Correção de gap da sessão anterior: tipo `DcsSync.tipo` não incluía `onboarding`/`atividades`.
- Todas as mudanças com tsc/vitest(293)/eslint/build limpos a cada commit.

## Bloqueio aberto
- **Credenciais dos workflows 13, 14 e 15 não foram anexadas automaticamente** pelo conector n8n (16 nós
  HTTP no total). As credenciais existem no n8n com os IDs corretos (`TqXGYCOmVGd2AvKp` Supabase,
  `RLiF1ChIGaWvWg1f` Pipedrive) mas precisam ser selecionadas manualmente em cada nó, na UI do n8n:
  - `n8n.dinamize.com.br/workflow/07ed9XQEH6Fw5Qnm` (Onboarding, 5 nós)
  - `n8n.dinamize.com.br/workflow/vClNoAV71FeudEhr` (Atividades, 6 nós)
  - `n8n.dinamize.com.br/workflow/JLSSTrhLrJCJbSoD` (Cancelamentos, 5 nós)
  Até lá os três ficam inativos — não vou ativá-los sem credencial confirmada. As telas correspondentes
  (`/dcs/onboarding`, `/dcs/atividades`, `/dcs/cancelamentos`, seção de onboarding na ficha 360) mostram
  corretamente "sem dado sincronizado" — não é bug.
- **Nota para a Prioridade 5 (não resolvida ainda, só registrada)**: o dono do produto definiu que "o mês
  do cancelamento é o mês da solicitação confirmada, mesmo que a conta encerre no mês seguinte" — ainda
  não validei se `lost_time`/`close_time` do Pipedrive correspondem a essa data de "solicitação confirmada"
  ou à data de encerramento efetivo. Por ora a coluna "Cancelado em" na tela mostra a data bruta do
  Pipedrive (`lost_time`/`close_time`), sem assumir que é a mesma coisa. Se forem datas diferentes na
  prática, revisar antes de usar esse campo para relatórios por mês de cancelamento.
- Lovable (commit `8855377`) ainda não apareceu em nenhuma branch do GitHub via `git ls-remote` —
  sincronização pendente do lado do Lovable; acompanhar antes de mesclar com o trabalho feito direto no GitHub.

## Pendências antigas (independentes desta frente)
- Repo público + `.env` commitado (agora em `vinicius814/omunim`): ação do dono no GitHub.
- RLS sem política em 8 tabelas legadas (`cs_*`/`google_tokens`/`registros`): avaliar antes de criar política ou remover.
- Transferência de Master, Supabase Auth (leaked password protection), usuário de integração dedicado no Pipedrive:
  já registradas em `docs/PROJECT_STATUS.md`.

## Próxima etapa
1. Você (ou alguém com acesso ao n8n) anexar as credenciais nos workflows 13, 14 e 15 (ver Bloqueio
   aberto); eu ativo e testo cada um com uma execução manual.
2. Seguir para Prioridade 7 — Oportunidades de melhoria (reapresentar "Planos de ação" sob esse nome/
   enquadramento, conectando diagnósticos/recomendações/implementações/responsáveis/prazos/prioridades/
   histórico/status; preservar o motor de diagnóstico como módulo independente, acessível pela ficha 360).
