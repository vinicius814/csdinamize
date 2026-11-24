# Dinamize CS — Gestão Operacional MVP (status)

Frente nova, aditiva, sobre o produto Dinamize CS já publicado (Beta 1.1). Não mexe no artefato Gestor
(outro projeto, repo/VPS separados) nem no motor de diagnóstico (`src/lib/dcs/motor.ts`, `artefato-v1.ts`).

## Checkpoint
- Branch: `dinamize-cs/gestor-operacional-mvp`, criada a partir de `main@3008d74` (23/11/2026).
- Repo transferido/renomeado para `vinicius814/omunim` — **continua público, com `.env` commitado na raiz**
  (pendência de segurança A-08; dono decidiu "registrar e seguir depois").

## Módulos implementados (confirmados por módulo entre `dcs_*`/`src/components/dcs`)
Visão geral, Carteira de clientes (+ Cliente 360 ampliado), Minhas análises, Oportunidades de
melhoria (ex-"Planos de ação", renomeado na Prioridade 7),
Cobertura de CS, **Onboarding** (novo), **Gestão da equipe** (novo), **Atividades e pendências**
(novo), **Cancelamentos e retenção** (novo), **Radar de inteligência** (evolução de "Alertas e
pendências"), **Inteligência gerencial** (expandida na Prioridade 8 — Relatórios gerenciais),
**Assistente e metas** (novo), Histórico de diagnósticos, Usuários e permissões,
Configurações, Integrações, Diagnóstico detalhado (motor completo, testado). Onboarding guiado
do app (tours) também existe, mas é funcionalidade diferente do onboarding operacional de
clientes (pipeline Pipedrive id 1).

## Gaps confirmados (pedidos no spec, ainda ausentes)
- Onboarding (Prioridade 2): sem "clientes atrasados" (falta regra de prazo por etapa validada — artefato
  Gestor não consultado ainda) nem atividades específicas desse funil. Mesma razão pela qual o Radar de
  inteligência (Prioridade 6) e o Assistente/Metas (Prioridade 9) não têm alerta/indicador de atraso de
  onboarding — melhor nenhum do que um prazo inventado.
- As 9 prioridades do spec têm agora um módulo real e funcional cada uma. O que resta é operacional, não
  de desenvolvimento: ver "Bloqueio aberto" abaixo (credenciais dos workflows 13/14/15).

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
  registrado abaixo) — melhor não ter o alerta do que inventar um prazo. Commit `e5c5ae7`.
- **Prioridade 7 — Oportunidades de melhoria**: renomeação/reenquadramento do módulo "Planos de
  ação" (já era completo: diagnósticos/recomendações ligados por ciclo, responsável, prazo,
  prioridade, complexidade, status, ganhos rápidos e reincidências entre ciclos — histórico real,
  não novo). Mudança foi só de rótulo/título (nav, Titulo da página, dashboard, tour guiado,
  dica de ajuda) para o nome pedido no spec — nenhuma lógica nova precisou ser construída porque
  a funcionalidade já cobria o enquadramento pedido. O motor de diagnóstico continua módulo
  independente, acessível pela ficha 360. Commit `cf389c8`.
- **Prioridade 8 — Relatórios gerenciais**: ampliação do módulo "Inteligência gerencial" (mantido
  com esse nome — já é a tela de KPIs gerenciais do produto) com nova seção "Visão da operação":
  contagens reais de Onboarding (por etapa), Atividades (abertas/atrasadas) e Cancelamentos
  (últimos 30/90 dias, por motivo) — tudo cruzando as tabelas das Prioridades 2/4/5, sem estimar
  nada; enquanto os workflows 13/14/15 estiverem inativos, cada bloco mostra "sem dados
  sincronizados" corretamente. Mantida a regra de nunca rotular o valor do Pipedrive como MRR
  (já era "Valor" em todo o módulo; confirmado, não alterado). Commit `cf389c8`.
- **Prioridade 9 — Assistente e metas (última prioridade do spec)**: rota `/dcs/assistente`, nova
  e enxuta de propósito. "Assistente" é uma central de respostas rápidas — perguntas fixas
  (clientes em risco, atividades atrasadas, cancelamentos recentes, negócios em onboarding),
  cada uma respondida com dado real recalculado na hora pelos mesmos hooks do resto do produto —
  não é chat livre por IA (exigiria credencial de modelo e revisão de segurança fora do escopo
  desta entrega; rotulado honestamente como "respostas rápidas", não como assistente geral).
  "Metas" cobre só 3 indicadores já confiáveis e reais do produto — cobertura em dia, implementação
  de ações, % onboarding concluído — comparando valor atual (calculado agora) com meta mensal
  definida por quem tem permissão "config" (tabela nova `dcs_metas` + função
  `dcs_definir_meta`, SECURITY DEFINER, valida período/indicador/faixa 0–100). Nenhuma meta de
  churn/MRR. Também lista os 5 clientes sem contato há mais tempo (reaproveita `dcs_cobertura`).
  Commit pendente.
- Correção de gap da sessão anterior: tipo `DcsSync.tipo` não incluía `onboarding`/`atividades`.
- Todas as mudanças com tsc/vitest(293)/eslint/build limpos a cada commit.

## Bloqueio resolvido (24/11/2026)
- **Credenciais dos workflows 13, 14 e 15 anexadas manualmente na UI do n8n** (16 nós HTTP no total —
  `DCS · Supabase service role` / `Pipedrive account`), já que o conector MCP (`create_workflow_from_code`/
  `update_workflow`) não anexa credencial em nós HTTP Request automaticamente. Cada workflow foi testado
  com uma execução real de ponta a ponta (todos os nós verdes, dado real do Pipedrive gravado no Supabase):
  - `07ed9XQEH6Fw5Qnm` (Onboarding, 5 nós) — 50 negócios em `dcs_pipeline_onboarding`.
  - `vClNoAV71FeudEhr` (Atividades, 6 nós) — 173 atividades em `dcs_atividades`.
  - `JLSSTrhLrJCJbSoD` (Cancelamentos, 5 nós) — 3.452 cancelamentos históricos em `dcs_cancelamentos`.
  No caminho apareceu um bug real e não relacionado a credencial: a constraint
  `dcs_sync_execucoes_tipo_check` só permitia `carteira`/`responsaveis`/`cobertura` — faltavam
  `onboarding`/`atividades`/`cancelamentos` (tipos novos de sessões anteriores, nunca adicionados à
  constraint). Corrigido via migração aditiva (`ALTER CONSTRAINT`), confirmado com os 3 testes acima.
  **Os três workflows continuam INATIVOS de propósito** — ativá-los (rodar no agendamento automático,
  escrevendo dado real todo dia) é decisão do dono do produto, não uma ação que tomo sozinho. Para ativar:
  `Publish`/toggle "Active" em cada workflow na UI do n8n, ou pedir para eu fazer isso explicitamente.
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
As 9 prioridades sequenciais do spec estão implementadas com dado real e funcionalidade de verdade
(nenhum placeholder "Em breve" restante nos módulos entregues), e os 3 workflows de sincronização
(Onboarding/Atividades/Cancelamentos) já testados de ponta a ponta com dado real. O que falta não é
desenvolvimento:
1. Decidir quando ativar os workflows 13/14/15 (ver "Bloqueio resolvido") — hoje rodam só sob demanda
   (execução manual testada); ativar faz rodarem sozinhos no agendamento (onboarding diário 05:50,
   atividades de hora em hora em dias úteis, cancelamentos diário 06:30).
2. Revisar a nota pendente da Prioridade 5 (mês de cancelamento vs. `lost_time`/`close_time` do
   Pipedrive) antes de usar esse campo em relatório por mês de cancelamento para a diretoria.
3. Fora do escopo desta frente, mas registrado: Lovable (commit `8855377`) ainda não sincronizou com o
   GitHub; repo público + `.env` commitado; RLS sem política em 8 tabelas legadas (ver "Pendências
   antigas").
