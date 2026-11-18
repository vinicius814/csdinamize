-- Endurecimento das tabelas legadas de CS do Munin (FINAL_SECURITY_AUDIT A-01).
-- A regra antiga cs_pode_ver não considerava a permissão financeira do Dinamize CS, a troca obrigatória de senha nem a
-- desativação no Dinamize CS. Políticas RESTRITIVAS (somadas às existentes, sem remover nenhuma) exigem perfil efetivo
-- no Dinamize CS e, para tabelas com valores comerciais, a permissão financeira. O n8n usa service_role (não afetado).
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['cs_atividades_cache','cs_eventos_onboarding','cs_regras_risco','cs_sync_runs'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS dcs_legado_exige_perfil ON public.%I', t);
    EXECUTE format('CREATE POLICY dcs_legado_exige_perfil ON public.%I AS RESTRICTIVE FOR SELECT TO authenticated USING (public.dcs_perfil() IS NOT NULL)', t);
  END LOOP;
  FOREACH t IN ARRAY ARRAY['cs_snapshot','cs_base_diaria','cs_cancelamentos','cs_eventos_valor','cs_metricas_diarias','cs_auditoria_eventos'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS dcs_legado_exige_financeiro ON public.%I', t);
    EXECUTE format('CREATE POLICY dcs_legado_exige_financeiro ON public.%I AS RESTRICTIVE FOR SELECT TO authenticated USING (public.dcs_perfil() IS NOT NULL AND coalesce(public.dcs_ve_financeiro(), false))', t);
  END LOOP;
END $$;
-- Views legadas: sem leitura anônima (já não retornavam linhas pela RLS; remove a superfície).
REVOKE SELECT ON public.cobertura_atual, public.cs_snapshot_risco FROM anon;
