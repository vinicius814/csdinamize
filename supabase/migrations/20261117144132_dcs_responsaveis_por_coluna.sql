-- Correção apontada pelo verificador de segurança do Supabase (security_definer_view):
-- a view dcs_responsaveis_publico contornava a RLS. Agora membros leem nome/status por permissão de coluna
-- e o e-mail fica só para administradores via função.
DROP VIEW public.dcs_responsaveis_publico;
DROP POLICY dcs_resp_ler ON public.dcs_responsaveis;
CREATE POLICY dcs_resp_ler ON public.dcs_responsaveis FOR SELECT TO authenticated USING (public.dcs_perfil() IS NOT NULL);
REVOKE SELECT ON public.dcs_responsaveis FROM authenticated;
GRANT SELECT (pipedrive_user_id, nome, ativo, visto_em) ON public.dcs_responsaveis TO authenticated;
CREATE OR REPLACE FUNCTION public.dcs_responsaveis_admin() RETURNS SETOF public.dcs_responsaveis LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NOT public.dcs_eh_admin() THEN RAISE EXCEPTION 'Somente administradores' USING ERRCODE='42501'; END IF;
  RETURN QUERY SELECT * FROM public.dcs_responsaveis ORDER BY nome;
END $$;
REVOKE ALL ON FUNCTION public.dcs_responsaveis_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dcs_responsaveis_admin() TO authenticated;
