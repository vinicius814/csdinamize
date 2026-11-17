-- Trava: o sistema nunca fica sem Administrador Master ativo (superadmin + conta ativa), por qualquer caminho.
CREATE OR REPLACE FUNCTION public.dcs_garantir_master() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.user_roles r JOIN public.account_access a ON a.user_id=r.user_id WHERE r.role='superadmin' AND a.status='ativo') THEN
    RAISE EXCEPTION 'Operação removeria o último Administrador Master ativo' USING ERRCODE='42501';
  END IF;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER dcs_master_roles AFTER UPDATE OR DELETE ON public.user_roles DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.dcs_garantir_master();
CREATE CONSTRAINT TRIGGER dcs_master_acesso AFTER UPDATE OR DELETE ON public.account_access DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.dcs_garantir_master();
REVOKE ALL ON FUNCTION public.dcs_garantir_master() FROM PUBLIC, anon, authenticated;
