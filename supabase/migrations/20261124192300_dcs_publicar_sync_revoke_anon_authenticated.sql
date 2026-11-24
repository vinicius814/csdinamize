-- Achado da auditoria de homologação (24/11/2026): dcs_publicar_pipeline_onboarding,
-- dcs_publicar_atividades e dcs_publicar_cancelamentos (SECURITY DEFINER, chamadas apenas
-- pelo n8n via credencial service_role) estavam expostas via PostgREST a 'anon' e
-- 'authenticated' -- diferente do padrão já usado em dcs_iniciar_sync/dcs_falhar_sync,
-- que só permitem service_role. Corrige o descuido (faltou o REVOKE nas migrations das
-- Prioridades 2/4/5); sem efeito nas automações do n8n, que usam service_role.
revoke execute on function public.dcs_publicar_pipeline_onboarding(uuid, jsonb, integer, boolean) from anon, authenticated;
revoke execute on function public.dcs_publicar_atividades(uuid, jsonb, integer, boolean) from anon, authenticated;
revoke execute on function public.dcs_publicar_cancelamentos(uuid, jsonb, integer, boolean) from anon, authenticated;
