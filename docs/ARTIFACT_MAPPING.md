# Matriz de equivalência: artefato → Dinamize CS

Status: **P** = portado e testado (motor/banco) · **B** = estrutura de banco pronta · **UI** = interface pendente · **—** = substituído.

| Artefato (função/constante) | Dinamize CS | Status |
|---|---|---|
| CATS, ITEMS, MAIN_DEF, MAINS/SUBS, needsMet | artefato-v1.ts (1:1) | P |
| STATES, CODE2ST, PRIOS, IMPL, WHO_L, CPX_L | artefato-v1.ts | P |
| DEF_CFG, mergeCfg | motor.configPadrao/mesclarConfig + dcs_regras (versões) | P/B |
| calcScore, bandOf, bandOfSc | motor.calcularIndice, motor.faixa | P |
| autoState, AUTO_CHECKS, AUTO_WIN1, MATRIX_COLS | motor.estadoAutomacao (+C1/C2) | P |
| outRef, autoEntPatch, ENT_METRIC, METRICS | motor.patchEntregabilidade | P |
| prioFor, mkRec, genRecs | motor.recomendacoes | P |
| buildDerived, maxPrio, isIn | motor.derivado → dcs_diagnosticos.derivado | P/B |
| pendingInfo, buildSummary, PEND_TEXT | motor.pendencias, motor.resumoProfissional | P |
| mergePlan, planCounts, setImpl, addManualRec | motor.mesclarPlano (+C3), dcs_acoes, dcs_atualizar_acao | P/B, UI |
| newDiag, startAnalysis, newCycle | dcs_iniciar_analise (ciclo novo herda respostas) | B |
| setField, flushNow, queues/enqueue, retry | dcs_salvar_diagnostico (versão otimista) | B, UI |
| concludeAnalysis, syncToPipedrive | dcs_concluir_analise → dcs_jobs → n8n 06 | B |
| reopenAnalysis, transferModal, assignable | dcs_reabrir_analise, dcs_transferir_analise | B |
| syncPortfolio, isEcom, CLIENT_FIELDS | n8n 01/02 + motor.consolidarCarteira (+C4/C5) + dcs_publicar_carteira | P/B |
| classifyActivity, hasKw, stripHtml | motor.classificarAtividade + n8n 05 (com "tentativa") | P |
| syncCoverage, coverageMaps, matchClient, later | n8n 05 + dcs_publicar_cobertura | B |
| covThresholds, covInfo, COV_L, covStale | motor.limitesCobertura/statusCobertura | P |
| msgFacts, templateMessage, genMessage | motor.fatosMensagem/mensagemTemplate (aba Mensagens); IA opcional n8n 09 | P |
| ROLES, NAV_BY_ROLE, computePerm, canSee, inviteState | dcs_membros + dcs_perfil/dcs_pode_ver (RLS) + motor.MODULOS_POR_PERFIL | P/B |
| MONEY_OK (ocultação visual) | dcs_clientes_financeiro + RLS | B (segurança real) |
| vOverview, vCarteira, vMinhas, vDiag, vPlanos, vCobertura, vHist | rotas `src/routes/_authenticated/dcs/*` + `src/components/dcs/*` | P (UI implementada) |
| vIntel, vUsers, vConfig | — | UI pendente |
| groupClients, itemRank, IND, COLL | consultas da visão geral/inteligência | UI |
| exportCarteira/Cov/Hist/Planos (CSV) | exportações conforme permissão | UI |
| PD_BASE, PIPELINE_ID, F_SEG, F_GER, SEG_ECOM, LABEL_ECOM, STAGES | validados no Pipedrive em 16/11/2026 (ver PIPEDRIVE_INTEGRATION) | P |
| USERS (mapa fixo de nomes) | dcs_responsaveis (n8n 04) | — |
| pdCall, pdLink* (conector do Claude) | n8n | — |
| S.db / coleções (clients, diag, analyses, plans, history, cov, ops, users, access, config, messages) | tabelas dcs_* | — (dados: ver DECISIONS D9) |
