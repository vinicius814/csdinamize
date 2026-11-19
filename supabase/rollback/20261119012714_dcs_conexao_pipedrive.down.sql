-- Rollback de 20261119012714_dcs_conexao_pipedrive. Preserve antes: SELECT * FROM dcs_testes_conexao.
DROP TRIGGER IF EXISTS dcs_membros_vinculo_pd ON public.dcs_membros;
DROP TRIGGER IF EXISTS dcs_pre_vinculo_pd ON public.dcs_pre_cadastros;
DROP FUNCTION IF EXISTS public.dcs_validar_vinculo_pd();
DROP FUNCTION IF EXISTS public.dcs_vinculos_pipedrive();
DROP FUNCTION IF EXISTS public.dcs_minha_conexao_pipedrive();
DROP FUNCTION IF EXISTS public.dcs_metodo_vinculo(text,text);
DROP FUNCTION IF EXISTS public.dcs_status_conexao();
DROP FUNCTION IF EXISTS public.dcs_concluir_teste_conexao(uuid,jsonb,text);
DROP FUNCTION IF EXISTS public.dcs_atender_testes_conexao();
DROP FUNCTION IF EXISTS public.dcs_solicitar_teste_conexao();
DROP TABLE IF EXISTS public.dcs_testes_conexao;
-- dcs_solicitar_sync: restaurar a versão de 20261117171704_dcs_admin_produto (exigia dcs_eh_admin()).
