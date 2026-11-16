# Banco (Supabase) — objetos dcs_*

| Tabela | Conteúdo | Escrita |
|---|---|---|
| dcs_membros | perfil (admin/cs/contas), financeiro, ativo, carteiras (owner_id), clientes, módulos, convite | dcs_salvar_membro (admin) |
| dcs_regras | versões imutáveis de configuração; uma ativa | dcs_publicar_regras (admin) |
| dcs_clientes | carteira consolidada por organização (sem valores) | dcs_publicar_carteira (n8n) |
| dcs_clientes_financeiro | mrr (soma de deal.value; null se faltar valor) | idem; leitura só com financeiro |
| dcs_responsaveis (+ view _publico) | usuários do Pipedrive | dcs_publicar_responsaveis (n8n) |
| dcs_sync_execucoes | execuções de sync (lidos, criados, alterados, inativados, completo) | dcs_iniciar_sync / publicar / falhar |
| dcs_cobertura | último efetivo, sem evidência, tentativa, próximo agendado | dcs_publicar_cobertura (n8n) |
| dcs_diagnosticos | ciclos (cliente, ciclo) com itens/métricas/resultados/derivado/resumo/regras_id/versão | iniciar/salvar/concluir/reabrir/transferir |
| dcs_diagnosticos_eventos | histórico append-only do ciclo | funções acima |
| dcs_acoes (+ _eventos) | plano de ação por cliente (rec_id determinístico) | dcs_concluir_analise, dcs_atualizar_acao |
| dcs_jobs, dcs_integracao_logs | outbox para n8n e logs | concluir_analise, reservar/finalizar/reenfileirar/liberar |
| dcs_alertas | revisão vencida, ação atrasada, cobertura crítica, oportunidade crítica | dcs_atualizar_alertas (n8n 08) |
| dcs_config, dcs_mensagens, dcs_preferencias, dcs_auditoria | configurações, mensagens geradas, preferências por usuário, auditoria admin | — |

Funções de acesso: `dcs_perfil()` (exige `account_access.status='ativo'`; admin/superadmin do Munin herdam admin), `dcs_eh_admin()`,
`dcs_ve_financeiro()`, `dcs_pode_ver(owner_id, key)`.

Equivalência com a lista sugerida no briefing: profiles/roles → `profiles`+`user_roles` existentes + `dcs_membros`; user_permissions → `dcs_membros`;
clients/client_deals → `dcs_clientes.deal_ids`; pipedrive_users → `dcs_responsaveis`; diagnoses/diagnosis_items → `dcs_diagnosticos.itens` (jsonb
por chave do item, versionado por `regras_id`); checklist_templates/items → código versionado (`artefato-v1.ts` + `REGRAS_VERSAO`);
action_plans/items → `dcs_acoes`; client_metrics → `dcs_diagnosticos.metricas`; coverage → `dcs_cobertura`; integration_jobs/logs,
pipedrive_sync → `dcs_jobs`, `dcs_integracao_logs`, `dcs_sync_execucoes`; audit_logs → `dcs_auditoria` + tabelas de eventos; settings → `dcs_config`/`dcs_regras`.
