# Código-fonte dos workflows ativos no n8n (Workflow SDK)

Estes arquivos são a fonte versionada dos workflows criados no n8n da Dinamize (n8n.dinamize.com.br) pelo conector.
Para alterar: edite o arquivo, valide e atualize pelo conector (`validate_workflow` → `update_workflow`) com o mesmo ID.
O código embutido nos nós Code é o mesmo de `n8n/src/*.js`, cuja equivalência com o motor é testada em `src/test/dcs-n8n.test.ts`.

| Arquivo | Workflow no n8n | ID | Estado |
|---|---|---|---|
| 01-carteira.sdk.js | Dinamize CS \| 01 — Sincronização completa da carteira | wz4g4KIsoi1NoGlG | ativo (diário 05:40 + pedido da interface) |
| 04-responsaveis.sdk.js | Dinamize CS \| 04 — Sincronização dos responsáveis | R34Vz2vThH1pOacp | ativo (diário 06:10 + pedido da interface via 11) |
| 05-cobertura.sdk.js | Dinamize CS \| 05 — Cobertura de Customer Success | Yy7d9zwQRGfTaNhy | ativo (seg–sex 07:20 e 13:20 + pedido da interface) |
| 07-monitoramento.sdk.js | Dinamize CS \| 07 — Monitoramento e falhas | s7uuBwKh5WfOSNda | gatilho de erro |
| 08-alertas.sdk.js | Dinamize CS \| 08 — Revisões e alertas | BEE0MGGSxQbTcPCq | ativo (diário 07:35) |
| 11-pedidos-atualizacao.sdk.js | Dinamize CS \| 11 — Pedidos de atualização da interface | zS2r4fzhZvekC3Nd | ativo (a cada minuto; executa 01, 04 e 05) |
| 06-registro-diagnostico.sdk.js | Dinamize CS \| 06 — Registro do diagnóstico no Pipedrive | 5sMpOPysvKwcNSmf | ativo (5 min; só registros liberados — D28) |
| 10-reprocessamento.sdk.js | Dinamize CS \| 10 — Reprocessamento de operações pendentes | tVMO9IEljT4jrvky | ativo (30 min) |
| 12-teste-conexao.sdk.js | Dinamize CS \| 12 — Teste de conexão com o Pipedrive | 3sPrZxBsuVqVcJi3 | ativo (a cada minuto; só leituras — D40) |
| 13-onboarding.sdk.js | Dinamize CS \| 13 — Sincronização do funil Onboarding | 07ed9XQEH6Fw5Qnm | **inativo** — criado e validado (23/11/2026), falta anexar credencial manualmente nos 5 nós HTTP antes de ativar |
| 14-atividades.sdk.js | Dinamize CS \| 14 — Sincronização de atividades abertas | vClNoAV71FeudEhr | **inativo** — criado e validado (23/11/2026), mesmo bloqueio de credencial manual (6 nós HTTP) |

Credenciais (por ID, sem segredo): `DCS · Supabase service role` (TqXGYCOmVGd2AvKp), `Pipedrive account` (RLiF1ChIGaWvWg1f).
Pendentes de criação: 02 incremental, 03 webhooks, 09 IA opcional.
Os JSON em `n8n/workflows/` (fase 0) ficam como referência histórica; a fonte vigente é esta pasta.
