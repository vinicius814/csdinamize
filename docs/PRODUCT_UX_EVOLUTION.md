# Evolução do produto e da experiência — 18–19/11/2026

Branch `dinamize-cs/evolucao-produto` (checkpoint `checkpoint/pre-evolucao-2026-11-18`). Decisões D38–D40.
Princípio: reduzir trabalho diário sem refazer o que já existia e sem pontuação opaca.

## O que já existia (mantido, não refeito)
| Necessidade | Onde já estava |
|---|---|
| Fila de trabalho do analista com ordem de urgência | Minhas análises (`fila.ts`) |
| Diagnóstico incremental (confirmar igual, revalidar, não se aplica mais, só o que mudou) | Editor de diagnóstico (D26) |
| Perguntas dependentes dispensadas (ex.: integração ausente não gera recomendações dependentes) | Metodologia `needsMet` |
| Contas sem utilização com motivo, revisão recorrente e retomada | Aba "Contas sem utilização" + painel na ficha |
| Registro automático com idempotência, backoff, 5 tentativas, conferência de ambíguos | Workflows 06/10 + `dcs_jobs` |
| Sincronização completa por cursor que só inativa com leitura completa | Workflow 01 (`completo`) |
| Contato efetivo pelo campo do Pipedrive, sem contar atividades de diagnóstico | Workflow 05 |

## O que foi implementado
### 1. Minha operação hoje (Visão geral) — D38
Contadores clicáveis (análises em andamento, revisões vencidas, contas sem uso a revisar, ações atrasadas, ações críticas,
contatos efetivos atrasados), "Próximas ações recomendadas" com motivo e atalho direto, e diagnósticos concluídos na semana.
Escopo: minha carteira, minhas análises e contas sem uso sob minha responsabilidade; administrador sem carteira vê a carteira toda.

### 2. Prioridade operacional explicável — D38
`src/lib/dcs/prioridade.ts`. Soma de pesos por motivo verificável (conta sem uso vencida 30, ação crítica 25, contato além do
limite 20, ação atrasada 15, revisão vencida 15, análise parada 10, contato perto do limite 10, sem registro de contato 8,
ganhos rápidos 5, sem diagnóstico 5). Pesos editáveis em Configurações (0–50; 0 desliga), versionados com as regras.
Garantias testadas: separada do índice; valor comercial fora dos pontos e dos motivos; desempate por valor só quando visível;
"cobertura indisponível" não vira "sem contato". Coluna **Atenção** na carteira (ordem padrão) com todos os motivos no título.

### 3. Evolução do cliente — D39
Aba "Evolução" na ficha: índice antes → depois (só entre ciclos da mesma metodologia), **resolvido e confirmado** (problema que
deixou de aparecer no diagnóstico seguinte), **implementado a confirmar**, pendente, novas oportunidades e reincidências.
"Copiar para a reunião" gera texto sem valores financeiros e sem atribuir resultados ao CS.

### 4. Conexão com o Pipedrive — D40
- **Modelo:** conexão institucional única (credencial no n8n) + vínculo de cada colaborador ao seu usuário do Pipedrive.
  Não há OAuth individual: o Pipedrive da Dinamize é uma conta única; tokens pessoais aumentariam a superfície de risco sem
  ganho de permissão. O responsável das atividades é o analista vinculado; a conta institucional é a autora técnica.
- **Central em Integrações:** "Testar conexão" (workflow 12, só leituras: autenticação, negócios do funil 15, organizações,
  pessoas, atividades, usuários, campos personalizados usados, etapas da carteira, tipo "Análise"); escrita marcada como
  "não testada" e comprovada pelo último registro confirmado; atualizar carteira/responsáveis/cobertura; registros por estado
  (confirmados, fila, aguardando autorização, falha recuperável, **falha definitiva**, conferência manual); erros de 30 dias.
- **Minha conta → Minha conexão com o Pipedrive:** vínculo, como foi confirmado (e-mail, e-mail em outro domínio Dinamize,
  manual), situação no Pipedrive e aviso de vínculo compartilhado.
- **Usuários:** coluna Pipedrive com a qualidade do vínculo (confere, outro domínio, manual, compartilhado, inativo, sem vínculo).
- **Banco:** vínculo só com usuário existente na última sincronização; nenhum novo vínculo duplicado (no 1º acesso o vínculo
  conflitante é descartado em vez de bloquear o login); pedidos de atualização e testes exigem a permissão `integracoes`.

### 5. Correções na integração (auditoria)
| Achado | Correção |
|---|---|
| Analista sem vínculo → atividade atribuída ao responsável da carteira (pessoa errada) | 06 atribui só ao analista vinculado; sem vínculo, fica com a conta institucional e a nota explica |
| Busca anti-duplicidade lia só as 500 primeiras atividades do negócio | Busca atividades concluídas, mais recentes primeiro |
| Pedido "responsáveis" executava a cobertura | 11 encaminha para o 04 (que ganhou gatilho de sub-workflow) |
| Credencial "institucional" é o token pessoal de um usuário | Recomendado criar usuário de integração dedicado (pendência) |

## Validação
- vitest 287 (novos: prioridade 6, evolução 3); pglite 143 (16 novos de conexão); tsc 0; build ok.
- Banco real (transação desfeita, usuários reais): status e vínculos pelo Master; analista sem acesso ao status e aos pedidos;
  duplicidade de vínculo recusada.
- **Ponta a ponta real:** teste de conexão executado pelo n8n — 9 leituras ok, escrita não testada, sem token no resultado;
  pedido de responsáveis atendido pelo 11 → 04 em 1 minuto (45 usuários lidos).
- Visual (dados simulados) em 1440 e 390 px: Visão geral, carteira, Integrações, Minha conta, Usuários, Evolução.

## Pendências
1. Usuário de integração dedicado no Pipedrive para a credencial do n8n (decisão e criação pelo administrador do Pipedrive).
2. Revisar os 2 vínculos compartilhados (contas do mesmo colaborador) e a conta sem vínculo.
3. Homologação no preview com analistas reais (fila "Hoje" e coluna Atenção com a carteira de cada um).
4. Plano de ação agrupado por causa raiz: as dependências já evitam recomendações redundantes; agrupamento visual fica para a próxima fase.
