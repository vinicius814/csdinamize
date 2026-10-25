# Munin · Regras e definições da operação de CS (Dinamize)

Registro das definições confirmadas pela operação. Atualizado em 25/10/2026.

## Papel do Munin
- O Munin é o sistema de acompanhamento da operação de Customer Success da Dinamize.
- A planilha `Dashboard_Gestao_CS_2026_Junho_a_Dezembro.xlsm` foi a base de controle até out/2026 e é fonte complementar do histórico (jun–set/2026) que o Munin ainda não tem.
- O Pipedrive (cs-dinamize) é a fonte dos registros operacionais. O Munin só lê o Pipedrive; nunca altera negócios.

## Universos
- Customer Success = pipeline 15. Ativo = aberto e fora da etapa 105 (Cancelados).
- Perfil D = pipeline 16, carteira separada; nunca somada ao total de CS. Ativo = aberto e fora da etapa 111.
- Onboarding = pipeline 1 (etapas 136–148; 12 = Bloq/Susp/Canc, fora do total em andamento).
- A planilha cobre somente o pipeline 15; a linha "Carteira compartilhada" corresponde à carteira de Carolina Branchi (158921) no pipeline 15 (hipótese forte pelos totais; confirmar com a operação).

## Financeiro
- Valor do negócio (`value`) = mensalidade de referência (MRR). O campo `mrr` da API não é usado. Moeda: BRL; valor ausente nunca vira zero.
- Upgrade/expansão = cada aumento real do Valor no histórico do negócio (incremento = posterior − anterior), sem exigir atividade "Upgrade".
- Cancelamento = negócio do pipeline de CS dado como perdido na etapa de cancelamento; mês pela data de perda (`lost_time`, fuso America/Sao_Paulo); valor = Valor no momento da perda. Conta por negócio (sem deduplicar organização); clientes únicos é medida separada. Reaberturas não contam.
- Churn do mês = valor perdido ÷ MRR no início do mês. Classificação: ≤1% Saudável, ≤2% Atenção leve, ≤3% Moderado, ≤4% Atenção, ≤5% Crítico, >5% Piso.

## Cobertura
- Contato efetivo = campo "Data do último contato efetivo" do cadastro do Pipedrive (decisão de 25/10/2026).
- Cobertura 60d = clientes com essa data nos últimos 60 dias ÷ todos os clientes da carteira (sem data entram no denominador e são informados à parte).
- Classificação: ≥80% Saudável, ≥70% Atenção, ≥60% Alerta, <60% Crítico.

## Onboarding
- SLA de onboarding = 21 dias (configurado em Regras: `prazo_onboarding_dias = 21`).
- Pendente de definição: dias corridos ou úteis (o Munin conta dias corridos); marco de início (data de contratação, criação do negócio no Onboarding ou kick-off) e marco de conclusão (saída do pipeline 1 para a carteira 15/16 ou outra etapa). Sem datas suficientes, o projeto é "não calculável" e não conta como cumprimento.

## Cancelamentos mensais
- A visão mensal deve listar os negócios marcados como perdidos no mês, com filtro por responsável que atualiza lista e resumo juntos; responsável = dono na data da perda quando reconstruído do histórico, senão dono atual (identificado como tal).
