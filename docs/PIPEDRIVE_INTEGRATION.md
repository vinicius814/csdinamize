# Integração com o Pipedrive

Conta: `cs-dinamize`. Leitura e escrita só pelo n8n (credencial "DCS · Pipedrive (cs-dinamize)").

## Identificadores (validados em 16/11/2026 por leitura)
| Item | Valor | Situação |
|---|---|---|
| Funil Customer Success | 15 | confirmado |
| Etapas | 101 Cobertura pendente, 102 Implementação, 103 Ongoing Automation, 135 Ongoing Mail, 147 Contas gerenciadas, 104 Sem uso, 105 Cancelados | confirmadas (nomes 101/147 têm espaço final) |
| Campo Segmento (set) | `723edfa476f1d04f92df16d7bc08bc482d9a2ac2`, opção 360 = "E-commerce" | confirmado |
| Campo Gerente de Contas (enum) | `9260473c7dffdb28935ce0db7fafd45524f91431` | confirmado (ex.: id 10 Carolina Branchi) |
| Etiqueta e-commerce | 690 = "E-commerce" | confirmado em 17/11/2026 |
| Tipo de atividade "Análise" | `anlise` | confirmado em 17/11/2026 |
| Campo "Data do último contato efetivo" (negócio) | `58cd094a23bd14b9275f4c006f1b19457b3c1d63` | existe; referência complementar da cobertura (D5) |
| Tipos de atividade fora da configuração do artefato | `retencao` (Contato de retenção), `reversao`, `apresentao_de_resultados_w` (Upgrade CS), `ativao_no_concluda`, `migrao`, `perdido` | contam como "nao" até decisão (D13) |
| Valor | `value` (BRL); `mrr` da API vem nulo | confirmado na amostra; regra da operação em docs/regras-operacao-cs.md |

## Fluxos
- Leitura: negócios do funil (v2 `/deals`, cursor, 500/página), usuários (v1 `/users`), atividades (v2 `/activities`).
- Escrita (somente após autorização): uma atividade "Análise" concluída no negócio principal por ciclo de diagnóstico,
  com a marca `DZCS-<cliente>-C<ciclo>` na nota (idempotência) e link de volta ao diagnóstico no Dinamize CS. Reconclusão
  (inclusive após reabrir) atualiza a mesma atividade com o relatório mais recente (D41).
- Escrita (somente após autorização): resumo consolidado do plano de ação — uma atividade "Análise" por cliente (não por
  ciclo, não por ação individual), com a marca `DZCS-ACOES-<cliente>` e contagem de ações ativas/críticas/implementadas/
  atrasadas + link para o plano no Dinamize CS. Atualizada a cada conclusão/revisão de diagnóstico do cliente (D41).
- Webhook: eventos de negócio → n8n 03 (cabeçalho secreto) → sincronização incremental.

## Conexão, autoria e vínculos (D40, 19/11/2026)
- **Conexão institucional:** credencial `Pipedrive account` no n8n (token de API). Hoje pertence a um usuário pessoal; recomenda-se
  um usuário de integração dedicado. O navegador nunca recebe o token.
- **Autoria × responsável:** a conta da credencial é a autora técnica (`creator_user_id`); o `owner_id` é o analista vinculado.
  Sem vínculo: sem `owner_id` (fica com a conta institucional) e a nota avisa. Nunca se usa o responsável da carteira como substituto.
- **Vínculos:** `dcs_membros.pipedrive_user_id` = id do usuário do Pipedrive (identificador oficial), validado contra a última
  sincronização de responsáveis e confirmado pelo e-mail (igual, ou mesmo usuário em outro domínio Dinamize). Não pode haver
  dois colaboradores ativos com o mesmo vínculo novo.
- **Teste de conexão (workflow 12):** só GETs — `users/me`, `deals?pipeline_id=15`, `organizations`, `persons`, `activities`,
  `users`, `dealFields` (segmento, gerente de CS, contato efetivo), `stages?pipeline_id=15` (101, 102, 103, 135, 147, 104),
  `activityTypes` (`anlise`). Escrita não testada; comprovada pelo último registro confirmado.
- **Pedidos da interface (workflow 11):** carteira → 01, responsáveis → 04, cobertura → 05.
- **Anti-duplicidade (06):** procura a marca `DZCS-<cliente>-C<ciclo>` nas atividades concluídas do negócio, mais recentes primeiro.
