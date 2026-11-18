-- Reversão de 20261118163837_beta_legado_restrito: remove apenas as políticas restritivas adicionadas.
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['cs_atividades_cache','cs_eventos_onboarding','cs_regras_risco','cs_sync_runs'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS dcs_legado_exige_perfil ON public.%I', t); END LOOP;
  FOREACH t IN ARRAY ARRAY['cs_snapshot','cs_base_diaria','cs_cancelamentos','cs_eventos_valor','cs_metricas_diarias','cs_auditoria_eventos'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS dcs_legado_exige_financeiro ON public.%I', t); END LOOP;
END $$;
GRANT SELECT ON public.cobertura_atual, public.cs_snapshot_risco TO anon;
