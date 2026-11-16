# Integração com o Pipedrive

Conta: `cs-dinamize`. Leitura e escrita só pelo n8n (credencial "DCS · Pipedrive (cs-dinamize)").

## Identificadores (validados em 16/11/2026 por leitura)
| Item | Valor | Situação |
|---|---|---|
| Funil Customer Success | 15 | confirmado |
| Etapas | 101 Cobertura pendente, 102 Implementação, 103 Ongoing Automation, 135 Ongoing Mail, 147 Contas gerenciadas, 104 Sem uso, 105 Cancelados | confirmadas (nomes 101/147 têm espaço final) |
| Campo Segmento (set) | `723edfa476f1d04f92df16d7bc08bc482d9a2ac2`, opção 360 = "E-commerce" | confirmado |
| Campo Gerente de Contas (enum) | `9260473c7dffdb28935ce0db7fafd45524f91431` | confirmado (ex.: id 10 Carolina Branchi) |
| Etiqueta e-commerce | 690 | **não verificada** (amostra sem a etiqueta) |
| Tipo de atividade "Análise" | `anlise` | **não verificado** |
| Valor | `value` (BRL); `mrr` da API vem nulo | confirmado na amostra; regra da operação em docs/regras-operacao-cs.md |

## Fluxos
- Leitura: negócios do funil (v2 `/deals`, cursor, 500/página), usuários (v1 `/users`), atividades (v2 `/activities`).
- Escrita (somente após autorização): uma atividade "Análise" concluída no negócio principal por ciclo de diagnóstico,
  com a marca `DZCS-<cliente>-C<ciclo>` na nota (idempotência). Nada mais é alterado no Pipedrive.
- Webhook: eventos de negócio → n8n 03 (cabeçalho secreto) → sincronização incremental.
