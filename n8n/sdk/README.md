# Código-fonte dos workflows ativos no n8n (Workflow SDK)

Estes arquivos são a fonte versionada dos workflows criados no n8n da Dinamize (n8n.dinamize.com.br) pelo conector.
Para alterar: edite o arquivo, valide e atualize pelo conector (`validate_workflow` → `update_workflow`) com o mesmo ID.
O código embutido nos nós Code é o mesmo de `n8n/src/*.js`, cuja equivalência com o motor é testada em `src/test/dcs-n8n.test.ts`.

| Arquivo | Workflow no n8n | ID | Estado |
|---|---|---|---|
| 01-carteira.sdk.js | Dinamize CS \| 01 — Sincronização completa da carteira | wz4g4KIsoi1NoGlG | ativo (diário 05:40 + pedido da interface) |
| 04-responsaveis.sdk.js | Dinamize CS \| 04 — Sincronização dos responsáveis | R34Vz2vThH1pOacp | ativo (diário 06:10) |
| 05-cobertura.sdk.js | Dinamize CS \| 05 — Cobertura de Customer Success | Yy7d9zwQRGfTaNhy | ativo (seg–sex 07:20 e 13:20 + pedido da interface) |
| 07-monitoramento.sdk.js | Dinamize CS \| 07 — Monitoramento e falhas | s7uuBwKh5WfOSNda | gatilho de erro |
| 08-alertas.sdk.js | Dinamize CS \| 08 — Revisões e alertas | BEE0MGGSxQbTcPCq | ativo (diário 07:35) |
| 11-pedidos-atualizacao.sdk.js | Dinamize CS \| 11 — Pedidos de atualização da interface | zS2r4fzhZvekC3Nd | ativo (a cada minuto; executa 01 e 05) |
| 10-reprocessamento.sdk.js | Dinamize CS \| 10 — Reprocessamento de operações pendentes | tVMO9IEljT4jrvky | ativo (30 min) |

Credenciais (por ID, sem segredo): `DCS · Supabase service role` (TqXGYCOmVGd2AvKp), `Pipedrive account` (RLiF1ChIGaWvWg1f).
Pendentes de criação: 02 incremental, 03 webhooks, 06 registro de diagnóstico (escrita no Pipedrive, aguarda autorização), 09 IA opcional.
Os JSON em `n8n/workflows/` (fase 0) ficam como referência histórica; a fonte vigente é esta pasta.
