CREATE OR REPLACE FUNCTION public.meu_acesso()
RETURNS TABLE(status text, terms_accepted_at timestamptz, role public.app_role)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$ SELECT a.status, a.terms_accepted_at, r.role FROM public.account_access a JOIN public.user_roles r ON r.user_id=a.user_id WHERE a.user_id=auth.uid() $$;
REVOKE ALL ON FUNCTION public.meu_acesso() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.meu_acesso() TO authenticated;

CREATE OR REPLACE FUNCTION public.registrar_meu_acesso()
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$ UPDATE public.account_access SET last_access_at=now() WHERE user_id=auth.uid() AND (last_access_at IS NULL OR last_access_at <= now()-interval '1 hour') $$;
REVOKE ALL ON FUNCTION public.registrar_meu_acesso() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_meu_acesso() TO authenticated;

CREATE TABLE public.integration_cache (
 user_id uuid NOT NULL,
 cache_key text NOT NULL,
 response_ciphertext text NOT NULL,
 expires_at timestamptz NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(user_id,cache_key)
);
GRANT ALL ON public.integration_cache TO service_role;
REVOKE ALL ON public.integration_cache FROM anon, authenticated;
ALTER TABLE public.integration_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY integration_cache_server_only ON public.integration_cache FOR ALL TO service_role USING(true) WITH CHECK(true);
CREATE TRIGGER integration_cache_updated BEFORE UPDATE ON public.integration_cache FOR EACH ROW EXECUTE FUNCTION public.telegram_touch_updated();
CREATE INDEX integration_cache_expiry ON public.integration_cache(expires_at);

CREATE OR REPLACE FUNCTION public.limpar_cache_integracoes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $$ DECLARE uid uuid; BEGIN
 IF TG_TABLE_NAME='profiles' THEN uid:=COALESCE(NEW.id,OLD.id); ELSE uid:=COALESCE(NEW.user_id,OLD.user_id); END IF;
 DELETE FROM public.integration_cache WHERE user_id=uid;
 RETURN COALESCE(NEW,OLD);
END $$;
REVOKE ALL ON FUNCTION public.limpar_cache_integracoes() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER cache_google_changed AFTER INSERT OR UPDATE OR DELETE ON public.app_user_connections FOR EACH ROW EXECUTE FUNCTION public.limpar_cache_integracoes();
CREATE TRIGGER cache_pipedrive_changed AFTER INSERT OR UPDATE OR DELETE ON public.conexoes_pipedrive FOR EACH ROW EXECUTE FUNCTION public.limpar_cache_integracoes();
CREATE TRIGGER cache_settings_changed AFTER INSERT OR UPDATE OR DELETE ON public.config_usuario FOR EACH ROW EXECUTE FUNCTION public.limpar_cache_integracoes();
CREATE TRIGGER cache_profile_changed AFTER UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.limpar_cache_integracoes();