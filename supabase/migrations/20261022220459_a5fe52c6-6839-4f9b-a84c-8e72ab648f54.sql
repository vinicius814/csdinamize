CREATE OR REPLACE FUNCTION public.tocar_atualizado_em() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$ BEGIN NEW.atualizado_em = now(); RETURN NEW; END; $$;

CREATE TABLE public.conexoes_pipedrive (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  token_cifrado text NOT NULL,
  dominio text NOT NULL,
  pipedrive_user_id integer,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.conexoes_pipedrive TO service_role;
ALTER TABLE public.conexoes_pipedrive ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER conexoes_pipedrive_atualizado BEFORE UPDATE ON public.conexoes_pipedrive FOR EACH ROW EXECUTE FUNCTION public.tocar_atualizado_em();

CREATE TABLE public.config_usuario (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  pipeline_id integer,
  campo_ultimo_contato text,
  dias_alerta integer NOT NULL DEFAULT 60,
  pasta_drive_id text,
  onboarding_concluido boolean NOT NULL DEFAULT false,
  limite_custo_usd numeric NOT NULL DEFAULT 20,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.config_usuario TO authenticated;
GRANT ALL ON public.config_usuario TO service_role;
ALTER TABLE public.config_usuario ENABLE ROW LEVEL SECURITY;
CREATE POLICY config_select_own ON public.config_usuario FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()) OR (SELECT public.meu_papel()) = 'admin');
CREATE POLICY config_insert_own ON public.config_usuario FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY config_update_own ON public.config_usuario FOR UPDATE TO authenticated USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));
CREATE TRIGGER config_usuario_atualizado BEFORE UPDATE ON public.config_usuario FOR EACH ROW EXECUTE FUNCTION public.tocar_atualizado_em();

CREATE TABLE public.convites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text NOT NULL UNIQUE DEFAULT substr(md5(random()::text || clock_timestamp()::text), 1, 12),
  email text,
  criado_por uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  usado_por uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  usado_em timestamptz,
  expira_em timestamptz NOT NULL DEFAULT now() + interval '7 days',
  criado_em timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.convites TO authenticated;
GRANT ALL ON public.convites TO service_role;
ALTER TABLE public.convites ENABLE ROW LEVEL SECURITY;
CREATE POLICY convites_admin_all ON public.convites FOR ALL TO authenticated USING ((SELECT public.meu_papel()) = 'admin') WITH CHECK ((SELECT public.meu_papel()) = 'admin');

CREATE POLICY uso_select_own ON public.uso FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS clientes_select_por_responsavel ON public.clientes;
DROP POLICY IF EXISTS registros_select_own_or_manager ON public.registros;
DROP POLICY IF EXISTS cobertura_select_own_or_manager ON public.cobertura_historico;