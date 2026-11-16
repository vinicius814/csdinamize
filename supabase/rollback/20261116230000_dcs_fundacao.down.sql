-- Rollback da fundação do Dinamize CS. Remove SOMENTE objetos dcs_* (o Munin não é afetado).
-- Antes de executar em produção: exportar as tabelas dcs_* (ver docs/DEPLOYMENT.md).
DROP VIEW IF EXISTS public.dcs_responsaveis_publico;
DROP TABLE IF EXISTS public.dcs_alertas, public.dcs_responsaveis CASCADE;
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT p.oid::regprocedure AS f FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
           WHERE n.nspname='public' AND p.proname LIKE 'dcs\_%' LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS '||r.f||' CASCADE';
  END LOOP;
END $$;
DROP TABLE IF EXISTS public.dcs_preferencias, public.dcs_mensagens, public.dcs_config, public.dcs_integracao_logs, public.dcs_jobs,
  public.dcs_acoes_eventos, public.dcs_acoes, public.dcs_diagnosticos_eventos, public.dcs_diagnosticos, public.dcs_cobertura,
  public.dcs_sync_execucoes, public.dcs_clientes_financeiro, public.dcs_clientes, public.dcs_regras, public.dcs_auditoria, public.dcs_membros CASCADE;
