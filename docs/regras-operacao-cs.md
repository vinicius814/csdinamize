# Munin · Regras e definições da operação de CS (Dinamize)

Registro das definições confirmadas pela operação. Atualizado em 25/10/2026 (cancelamentos: entrada, responsável e carteira compartilhada).

## Papel do Munin
- O Munin é o sistema de acompanhamento da operação de Customer Success da Dinamize.
- A planilha `Dashboard_Gestao_CS_2026_Junho_a_Dezembro.xlsm` foi a base de controle até out/2026 e é fonte complementar do histórico (jun–set/2026) que o Munin ainda não tem.
- O Pipedrive (cs-dinamize) é a fonte dos registros operacionais. O Munin só lê o Pipedrive; nunca altera negócios.

## Universos
- Customer Success = pipeline 15. Ativo = aberto e fora da etapa 105 (Cancelados).
- Perfil D = pipeline 16, carteira separada; nunca somada ao total de CS. Ativo = aberto e fora da etapa 111.
- Onboarding = pipeline 1 (etapas 136–148; 12 = Bloq/Susp/Canc, fora do total em andamento).
- A planilha cobre somente o pipeline 15.
- Carteira compartilhada = carteira de Carolina Branchi (Pipedrive 158921), confirmado pela operação em 25/10/2026. O Munin exibe esse responsável como "Carteira compartilhada (Carolina Branchi)".

## Financeiro
- Valor do negócio (`value`) = mensalidade de referência (MRR). O campo `mrr` da API não é usado. Moeda: BRL; valor ausente nunca vira zero.
- Upgrade/expansão = cada aumento real do Valor no histórico do negócio (incremento = posterior − anterior), sem exigir atividade "Upgrade".
- Cancelamento = negócio do pipeline de CS dado como perdido na etapa de cancelamento (105 no CS, 111 no Perfil D). Mês = data em que o negócio ENTROU em Cancelados (último episódio de entrada na etapa até a perda, fuso America/Sao_Paulo) — decisão de 25/10/2026; a data de perda (`lost_time`) é guardada à parte. Valor = Valor no momento da perda.
- Responsável pelo cancelamento = CS que atendia a conta na data de entrada em Cancelados (reconstruído pelo changelog, desfazendo trocas de dono posteriores). Enquanto o histórico não é confirmado, o Munin mostra o dono atual marcado como "histórico pendente". Conta por negócio (sem deduplicar organização); clientes únicos é medida separada. Reaberturas não contam.
- Churn do mês = valor perdido ÷ MRR no início do mês. Classificação: ≤1% Saudável, ≤2% Atenção leve, ≤3% Moderado, ≤4% Atenção, ≤5% Crítico, >5% Piso.

## Cobertura
- Contato efetivo = campo "Data do último contato efetivo" do cadastro do Pipedrive (decisão de 25/10/2026).
- Cobertura 60d = clientes com essa data nos últimos 60 dias ÷ todos os clientes da carteira (sem data entram no denominador e são informados à parte).
- Classificação: ≥80% Saudável, ≥70% Atenção, ≥60% Alerta, <60% Crítico.

## Onboarding
- SLA de onboarding = 21 dias (configurado em Regras: `prazo_onboarding_dias = 21`).
- Pendente de definição: dias corridos ou úteis (o Munin conta dias corridos); marco de início (data de contratação, criação do negócio no Onboarding ou kick-off) e marco de conclusão (saída do pipeline 1 para a carteira 15/16 ou outra etapa). Sem datas suficientes, o projeto é "não calculável" e não conta como cumprimento.

## Cancelamentos mensais
- Tela Cancelamentos (menu Operação): mês a mês pela data de entrada em Cancelados, filtro de carteira e de responsável (lista, resumo e CSV usam os mesmos registros), colunas de entrada, perda, motivo e valor.
- Origem da data (`cs_cancelamentos.data_origem`): `historico` = confirmada pelo changelog; `etapa` = última mudança de etapa do negócio (estimativa); `perda` = só a data de perda; `sem_historico` = changelog sem registro da entrada.
- Para confirmar: Análise Gerencial → Qualidade → "Cancelamentos: confirmar entrada e responsável (próximo lote)" até zerar os restantes.
