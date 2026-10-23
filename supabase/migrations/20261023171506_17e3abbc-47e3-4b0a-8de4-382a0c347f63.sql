REVOKE ALL ON FUNCTION public.registrar_meu_acesso() FROM authenticated;
CREATE OR REPLACE FUNCTION public.registrar_acesso_auxiliar(uid uuid)
RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path=public
AS $$ UPDATE public.account_access SET last_access_at=now() WHERE user_id=uid AND (last_access_at IS NULL OR last_access_at<=now()-interval '1 hour') $$;
REVOKE ALL ON FUNCTION public.registrar_acesso_auxiliar(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_acesso_auxiliar(uuid) TO service_role;