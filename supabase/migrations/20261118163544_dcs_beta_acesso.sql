-- Dinamize CS Beta — acesso exclusivamente por convite, permissões granulares, troca obrigatória de senha,
-- onboarding, feedback e configurações da versão. Aditiva; nenhuma tabela ou dado operacional é removido.

-- ============ 1. Configurações da versão ============
INSERT INTO public.dcs_config(chave,valor) VALUES
  ('beta', '{"ativo":true}'),
  ('acesso', '{"validade_convite_dias":7,"senha_provisoria_horas":48}')
ON CONFLICT (chave) DO NOTHING;

-- ============ 2. Segurança da conta (troca obrigatória de senha) ============
CREATE TABLE IF NOT EXISTS public.dcs_seguranca_conta (
  user_id uuid PRIMARY KEY,
  troca_obrigatoria boolean NOT NULL DEFAULT false,
  provisoria_gerada_em timestamptz, provisoria_expira_em timestamptz, provisoria_gerada_por uuid,
  senha_definida_em timestamptz,
  atualizado_em timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.dcs_seguranca_conta ENABLE ROW LEVEL SECURITY;
CREATE POLICY dcs_seg_ler ON public.dcs_seguranca_conta FOR SELECT TO authenticated USING (user_id = auth.uid());
REVOKE ALL ON public.dcs_seguranca_conta FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.dcs_seguranca_conta FROM authenticated;
GRANT SELECT ON public.dcs_seguranca_conta TO authenticated; GRANT ALL ON public.dcs_seguranca_conta TO service_role;

CREATE OR REPLACE FUNCTION public.dcs_troca_pendente(p_user uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS (SELECT 1 FROM public.dcs_seguranca_conta s WHERE s.user_id=p_user AND s.troca_obrigatoria) $$;

-- Perfil efetivo: nulo para conta inativa ou com troca de senha pendente. Toda a RLS e as funções do Dinamize CS dependem disto,
-- então o bloqueio vale para qualquer método de login (e-mail, Google) e para chamadas diretas à API.
CREATE OR REPLACE FUNCTION public.dcs_perfil() RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT CASE
    WHEN NOT EXISTS (SELECT 1 FROM public.account_access a WHERE a.user_id=auth.uid() AND a.status='ativo') THEN NULL
    WHEN public.dcs_troca_pendente(auth.uid()) THEN NULL
    WHEN EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id=auth.uid() AND r.role IN ('admin','superadmin')) THEN 'admin'
    ELSE (SELECT m.perfil FROM public.dcs_membros m WHERE m.user_id=auth.uid() AND m.ativo)
  END $$;
CREATE OR REPLACE FUNCTION public.dcs_perfil_de(p_user uuid) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT CASE
    WHEN NOT EXISTS (SELECT 1 FROM public.account_access a WHERE a.user_id=p_user AND a.status='ativo') THEN NULL
    WHEN public.dcs_troca_pendente(p_user) THEN NULL
    WHEN EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id=p_user AND r.role IN ('admin','superadmin')) THEN 'admin'
    ELSE (SELECT m.perfil FROM public.dcs_membros m WHERE m.user_id=p_user AND m.ativo)
  END $$;
-- Master também exige a conta liberada (troca de senha concluída).
CREATE OR REPLACE FUNCTION public.dcs_eh_master() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles r JOIN public.account_access a ON a.user_id=r.user_id
                 WHERE r.user_id=auth.uid() AND r.role='superadmin' AND a.status='ativo') AND NOT public.dcs_troca_pendente(auth.uid()) $$;

-- ============ 3. Permissões granulares (menor privilégio) ============
ALTER TABLE public.dcs_membros ADD COLUMN IF NOT EXISTS permissoes jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.dcs_pre_cadastros
  ADD COLUMN IF NOT EXISTS permissoes jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS modulos text[],
  ADD COLUMN IF NOT EXISTS expira_em timestamptz,
  ADD COLUMN IF NOT EXISTS metodo text NOT NULL DEFAULT 'google',
  ADD COLUMN IF NOT EXISTS revogado_por uuid;
ALTER TABLE public.dcs_pre_cadastros DROP CONSTRAINT IF EXISTS dcs_pre_metodo_check;
ALTER TABLE public.dcs_pre_cadastros ADD CONSTRAINT dcs_pre_metodo_check CHECK (metodo IN ('google','email','senha'));

-- Permissões válidas por perfil.
CREATE OR REPLACE FUNCTION public.dcs_permissoes_validas(p_perfil text) RETURNS text[] LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN p_perfil='admin' THEN ARRAY['concluir','planos','redistribuir','usuarios','config','integracoes']
              ELSE ARRAY['concluir','planos'] END $$;

-- Tem a permissão? Master: todas. Demais: somente as concedidas explicitamente (nada por padrão).
CREATE OR REPLACE FUNCTION public.dcs_pode(p text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT CASE
    WHEN public.dcs_perfil() IS NULL THEN false
    WHEN public.dcs_eh_master() THEN true
    ELSE coalesce((SELECT (m.permissoes->>p)::boolean FROM public.dcs_membros m WHERE m.user_id=auth.uid() AND m.ativo), false)
         AND p = ANY(public.dcs_permissoes_validas(public.dcs_perfil()))
  END $$;

-- Preserva o comportamento de quem já usa o sistema (sem ampliar nada).
UPDATE public.dcs_membros SET permissoes = CASE WHEN perfil='admin'
    THEN '{"concluir":true,"planos":true,"redistribuir":true,"usuarios":true,"config":true,"integracoes":true}'::jsonb
    ELSE '{"concluir":true,"planos":true}'::jsonb END
  WHERE permissoes = '{}'::jsonb;
-- Administradores legados (papel admin/superadmin sem registro no Dinamize CS) recebem registro explícito com as permissões que já exerciam.
INSERT INTO public.dcs_membros(user_id,perfil,financeiro,pode_editar,pode_exportar,ativo,permissoes)
SELECT r.user_id,'admin',true,true,false,true,'{"concluir":true,"planos":true,"redistribuir":true,"usuarios":true,"config":true,"integracoes":true}'::jsonb
  FROM public.user_roles r WHERE r.role IN ('admin','superadmin')
ON CONFLICT (user_id) DO NOTHING;
UPDATE public.dcs_pre_cadastros SET permissoes='{"concluir":true,"planos":true}'::jsonb WHERE permissoes='{}'::jsonb AND perfil<>'admin';
UPDATE public.dcs_pre_cadastros SET expira_em = now() + interval '7 days' WHERE expira_em IS NULL AND aplicado_em IS NULL AND revogado_em IS NULL;
-- Pré-cadastro cujo usuário já tem acesso aplicado por outro caminho fica marcado como aplicado (sem reaplicar).
UPDATE public.dcs_pre_cadastros p SET aplicado_em = now(), aplicado_user = u.id
  FROM auth.users u JOIN public.dcs_membros m ON m.user_id=u.id
 WHERE lower(u.email)=p.email AND p.aplicado_em IS NULL;

-- Exportação de dados sensíveis desativada para todos (D33). Coluna mantida por compatibilidade, sempre falsa.
UPDATE public.dcs_membros SET pode_exportar=false WHERE pode_exportar;
UPDATE public.dcs_pre_cadastros SET pode_exportar=false WHERE pode_exportar;
ALTER TABLE public.dcs_membros DROP CONSTRAINT IF EXISTS dcs_membros_sem_exportacao;
ALTER TABLE public.dcs_membros ADD CONSTRAINT dcs_membros_sem_exportacao CHECK (NOT pode_exportar);
ALTER TABLE public.dcs_pre_cadastros DROP CONSTRAINT IF EXISTS dcs_pre_sem_exportacao;
ALTER TABLE public.dcs_pre_cadastros ADD CONSTRAINT dcs_pre_sem_exportacao CHECK (NOT pode_exportar);

-- Gatilhos que aplicam as permissões no banco (valem dentro de qualquer função; o n8n/service_role não tem auth.uid()).
CREATE OR REPLACE FUNCTION public.dcs_exigir_permissao_diag() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;
  IF TG_OP='INSERT' AND NEW.analista_id<>auth.uid() AND NOT public.dcs_pode('redistribuir') THEN
    RAISE EXCEPTION 'Seu perfil não tem permissão para atribuir análises' USING ERRCODE='42501';
  END IF;
  IF TG_OP='UPDATE' THEN
    IF NEW.status='concluido' AND OLD.status<>'concluido' AND NOT public.dcs_pode('concluir') THEN
      RAISE EXCEPTION 'Seu perfil não tem permissão para concluir diagnósticos' USING ERRCODE='42501';
    END IF;
    IF NEW.analista_id<>OLD.analista_id AND NEW.analista_id<>auth.uid() AND NOT public.dcs_pode('redistribuir') THEN
      RAISE EXCEPTION 'Seu perfil não tem permissão para redistribuir análises' USING ERRCODE='42501';
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS dcs_diag_permissoes ON public.dcs_diagnosticos;
CREATE TRIGGER dcs_diag_permissoes BEFORE INSERT OR UPDATE ON public.dcs_diagnosticos FOR EACH ROW EXECUTE FUNCTION public.dcs_exigir_permissao_diag();

CREATE OR REPLACE FUNCTION public.dcs_exigir_permissao_acoes() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT (public.dcs_pode('planos') OR public.dcs_pode('concluir')) THEN
    RAISE EXCEPTION 'Seu perfil não tem permissão para administrar planos de ação' USING ERRCODE='42501';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS dcs_acoes_permissoes ON public.dcs_acoes;
CREATE TRIGGER dcs_acoes_permissoes BEFORE INSERT OR UPDATE ON public.dcs_acoes FOR EACH ROW EXECUTE FUNCTION public.dcs_exigir_permissao_acoes();

CREATE OR REPLACE FUNCTION public.dcs_exigir_permissao_tabela() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE perm text := TG_ARGV[0]; BEGIN
  IF auth.uid() IS NULL THEN RETURN coalesce(NEW, OLD); END IF;
  -- Aceite do próprio convite (dcs_reivindicar_acesso) grava o próprio registro.
  IF perm='usuarios' AND current_setting('dcs.reivindicando', true)='1' THEN RETURN coalesce(NEW, OLD); END IF;
  -- Reprocessar o registro do próprio diagnóstico (analista) é permitido.
  IF perm='integracoes' AND TG_TABLE_NAME='dcs_jobs' AND public.dcs_pode('concluir') THEN RETURN coalesce(NEW, OLD); END IF;
  IF NOT public.dcs_pode(perm) THEN
    RAISE EXCEPTION 'Seu perfil não tem a permissão necessária (%)', perm USING ERRCODE='42501';
  END IF;
  RETURN coalesce(NEW, OLD);
END $$;
DROP TRIGGER IF EXISTS dcs_regras_permissoes ON public.dcs_regras;
CREATE TRIGGER dcs_regras_permissoes BEFORE INSERT OR UPDATE ON public.dcs_regras FOR EACH ROW EXECUTE FUNCTION public.dcs_exigir_permissao_tabela('config');
DROP TRIGGER IF EXISTS dcs_jobs_permissoes ON public.dcs_jobs;
CREATE TRIGGER dcs_jobs_permissoes BEFORE UPDATE ON public.dcs_jobs FOR EACH ROW EXECUTE FUNCTION public.dcs_exigir_permissao_tabela('integracoes');
DROP TRIGGER IF EXISTS dcs_membros_permissoes ON public.dcs_membros;
CREATE TRIGGER dcs_membros_permissoes BEFORE INSERT OR UPDATE OR DELETE ON public.dcs_membros FOR EACH ROW EXECUTE FUNCTION public.dcs_exigir_permissao_tabela('usuarios');
DROP TRIGGER IF EXISTS dcs_pre_permissoes ON public.dcs_pre_cadastros;
CREATE TRIGGER dcs_pre_permissoes BEFORE INSERT OR UPDATE OR DELETE ON public.dcs_pre_cadastros FOR EACH ROW EXECUTE FUNCTION public.dcs_exigir_permissao_tabela('usuarios');

-- ============ 4. Cadastro somente com convite (Supabase Auth) ============
-- Qualquer criação de conta (e-mail/senha, Google, convite por e-mail, API administrativa) exige convite válido para o e-mail.
CREATE OR REPLACE FUNCTION public.dcs_exigir_convite() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NEW.email IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.dcs_pre_cadastros p
     WHERE p.email=lower(NEW.email) AND p.revogado_em IS NULL AND p.aplicado_em IS NULL AND p.ativo
       AND (p.expira_em IS NULL OR p.expira_em > now())) THEN
    RAISE EXCEPTION 'Cadastro não autorizado' USING ERRCODE='42501';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS dcs_exigir_convite ON auth.users;
CREATE TRIGGER dcs_exigir_convite BEFORE INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.dcs_exigir_convite();

-- ============ 5. Convite e edição de acesso (caminho único) ============
-- p: {email, nome, perfil, financeiro, editar, carteiras[], clientes[], modulos[]|null, permissoes{}, pipedrive, metodo, validade_dias, ativo}
CREATE OR REPLACE FUNCTION public.dcs_salvar_acesso(p jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  e text := lower(trim(p->>'email')); v_perfil text := p->>'perfil'; u uuid; k text; v_perms jsonb := '{}'::jsonb;
  v_dias int := coalesce(nullif(p->>'validade_dias','')::int, (SELECT (valor->>'validade_convite_dias')::int FROM public.dcs_config WHERE chave='acesso'), 7);
  v_metodo text := coalesce(nullif(p->>'metodo',''),'google');
  v_carteiras int[] := coalesce((SELECT array_agg(x::int) FROM jsonb_array_elements_text(coalesce(p->'carteiras','[]')) x), '{}');
  v_clientes text[] := coalesce((SELECT array_agg(x) FROM jsonb_array_elements_text(coalesce(p->'clientes','[]')) x), '{}');
  v_modulos text[] := CASE WHEN jsonb_typeof(p->'modulos')='array' THEN (SELECT array_agg(x) FROM jsonb_array_elements_text(p->'modulos') x) END;
  v_ativo boolean := coalesce((p->>'ativo')::boolean, true);
BEGIN
  IF NOT public.dcs_pode('usuarios') THEN RAISE EXCEPTION 'Seu perfil não pode convidar ou alterar usuários' USING ERRCODE='42501'; END IF;
  IF e IS NULL OR e !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN RAISE EXCEPTION 'E-mail inválido'; END IF;
  IF v_perfil NOT IN ('admin','cs','contas') THEN RAISE EXCEPTION 'Perfil inválido'; END IF;
  IF v_perfil='admin' AND NOT public.dcs_eh_master() THEN RAISE EXCEPTION 'Somente o Administrador Master convida administradores' USING ERRCODE='42501'; END IF;
  IF v_metodo NOT IN ('google','email','senha') THEN RAISE EXCEPTION 'Método de acesso inválido'; END IF;
  IF v_dias < 1 OR v_dias > 30 THEN RAISE EXCEPTION 'Validade do convite deve ficar entre 1 e 30 dias'; END IF;
  -- Somente permissões válidas para o perfil e que o próprio administrador possui (sem elevação).
  FOR k IN SELECT key FROM jsonb_each_text(coalesce(p->'permissoes','{}')) WHERE value='true' LOOP
    IF NOT k = ANY(public.dcs_permissoes_validas(v_perfil)) THEN RAISE EXCEPTION 'Permissão % não se aplica ao perfil', k; END IF;
    IF NOT public.dcs_pode(k) THEN RAISE EXCEPTION 'Você não pode conceder a permissão % (não a possui)', k USING ERRCODE='42501'; END IF;
    v_perms := v_perms || jsonb_build_object(k, true);
  END LOOP;
  IF coalesce((p->>'financeiro')::boolean,false) AND NOT public.dcs_ve_financeiro() THEN RAISE EXCEPTION 'Você não pode conceder acesso financeiro' USING ERRCODE='42501'; END IF;

  SELECT id INTO u FROM auth.users WHERE lower(email)=e;
  IF u IS NOT NULL THEN
    IF u = auth.uid() THEN RAISE EXCEPTION 'Não altere o seu próprio acesso' USING ERRCODE='42501'; END IF;
    IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=u AND role='superadmin') THEN
      RAISE EXCEPTION 'O Administrador Master não pode ser alterado por esta tela' USING ERRCODE='42501';
    END IF;
    IF NOT public.dcs_eh_master() AND (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=u AND role='admin')
       OR EXISTS (SELECT 1 FROM public.dcs_membros WHERE user_id=u AND perfil='admin')) THEN
      RAISE EXCEPTION 'Somente o Administrador Master altera administradores' USING ERRCODE='42501';
    END IF;
    INSERT INTO public.dcs_membros(user_id,perfil,financeiro,pode_editar,pode_exportar,ativo,carteiras,clientes,modulos,permissoes,pipedrive_user_id,convidado_por)
    VALUES (u,v_perfil,coalesce((p->>'financeiro')::boolean,false),coalesce((p->>'editar')::boolean,true),false,v_ativo,v_carteiras,v_clientes,v_modulos,v_perms,
            nullif(p->>'pipedrive','')::int,auth.uid())
    ON CONFLICT (user_id) DO UPDATE SET perfil=excluded.perfil, financeiro=excluded.financeiro, pode_editar=excluded.pode_editar, ativo=excluded.ativo,
      carteiras=excluded.carteiras, clientes=excluded.clientes, modulos=excluded.modulos, permissoes=excluded.permissoes,
      pipedrive_user_id=excluded.pipedrive_user_id, atualizado_em=now();
    IF coalesce(trim(p->>'nome'),'')<>'' THEN UPDATE public.profiles SET nome=trim(p->>'nome') WHERE id=u; END IF;
    PERFORM public.dcs_auditar('acesso', u::text, 'permissoes', jsonb_build_object('perfil',v_perfil,'permissoes',v_perms,'financeiro',p->'financeiro',
      'editar',p->'editar','carteiras',v_carteiras,'clientes',v_clientes,'modulos',v_modulos,'ativo',v_ativo));
    RETURN jsonb_build_object('modo','aplicado','user_id',u);
  END IF;

  INSERT INTO public.dcs_pre_cadastros(email,nome,perfil,financeiro,pode_editar,pode_exportar,ativo,carteiras,clientes,modulos,permissoes,pipedrive_user_id,
    criado_por,metodo,expira_em)
  VALUES (e,nullif(trim(p->>'nome'),''),v_perfil,coalesce((p->>'financeiro')::boolean,false),coalesce((p->>'editar')::boolean,true),false,true,
    v_carteiras,v_clientes,v_modulos,v_perms,nullif(p->>'pipedrive','')::int,auth.uid(),v_metodo,now()+make_interval(days=>v_dias))
  ON CONFLICT (email) DO UPDATE SET nome=excluded.nome, perfil=excluded.perfil, financeiro=excluded.financeiro, pode_editar=excluded.pode_editar,
    ativo=true, carteiras=excluded.carteiras, clientes=excluded.clientes, modulos=excluded.modulos, permissoes=excluded.permissoes,
    pipedrive_user_id=excluded.pipedrive_user_id, criado_por=auth.uid(), metodo=excluded.metodo, expira_em=excluded.expira_em,
    revogado_em=NULL, revogado_por=NULL, aplicado_em=NULL, aplicado_user=NULL, convite_enviado_em=NULL, atualizado_em=now();
  PERFORM public.dcs_auditar('convite', e, 'criar', jsonb_build_object('perfil',v_perfil,'permissoes',v_perms,'metodo',v_metodo,'validade_dias',v_dias,
    'carteiras',v_carteiras,'clientes',v_clientes,'financeiro',p->'financeiro'));
  RETURN jsonb_build_object('modo','convite','email',e,'expira_em',now()+make_interval(days=>v_dias));
END $$;

CREATE OR REPLACE FUNCTION public.dcs_revogar_pre_cadastro(p_email text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
  IF NOT public.dcs_pode('usuarios') THEN RAISE EXCEPTION 'Sem permissão' USING ERRCODE='42501'; END IF;
  UPDATE public.dcs_pre_cadastros SET revogado_em=now(), revogado_por=auth.uid(), ativo=false, atualizado_em=now()
   WHERE email=lower(trim(p_email)) AND aplicado_em IS NULL;
  PERFORM public.dcs_auditar('convite', lower(trim(p_email)), 'revogar', NULL);
END $$;
CREATE OR REPLACE FUNCTION public.dcs_registrar_convite(p_email text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
  IF NOT public.dcs_pode('usuarios') THEN RAISE EXCEPTION 'Sem permissão' USING ERRCODE='42501'; END IF;
  UPDATE public.dcs_pre_cadastros SET convite_enviado_em=now() WHERE email=lower(trim(p_email)) AND aplicado_em IS NULL AND revogado_em IS NULL;
  PERFORM public.dcs_auditar('convite', lower(trim(p_email)), 'enviar', NULL);
END $$;

-- Aceite do convite no primeiro login (identidade = e-mail verificado do Supabase Auth). Convite expirado/revogado não vale.
CREATE OR REPLACE FUNCTION public.dcs_reivindicar_acesso() RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE e text; p public.dcs_pre_cadastros; BEGIN
  SELECT lower(email) INTO e FROM auth.users WHERE id=auth.uid() AND email_confirmed_at IS NOT NULL;
  IF e IS NULL THEN RETURN false; END IF;
  SELECT * INTO p FROM public.dcs_pre_cadastros WHERE email=e AND aplicado_em IS NULL AND revogado_em IS NULL AND ativo
     AND (expira_em IS NULL OR expira_em > now()) FOR UPDATE;
  IF p.email IS NULL THEN RETURN false; END IF;
  PERFORM set_config('dcs.reivindicando','1',true);
  INSERT INTO public.dcs_membros(user_id,perfil,financeiro,pode_editar,pode_exportar,ativo,carteiras,clientes,modulos,permissoes,pipedrive_user_id,convidado_por)
  VALUES (auth.uid(),p.perfil,p.financeiro,p.pode_editar,false,true,p.carteiras,p.clientes,p.modulos,p.permissoes,p.pipedrive_user_id,p.criado_por)
  ON CONFLICT (user_id) DO UPDATE SET perfil=excluded.perfil, financeiro=excluded.financeiro, pode_editar=excluded.pode_editar, ativo=true,
    carteiras=excluded.carteiras, clientes=excluded.clientes, modulos=excluded.modulos, permissoes=excluded.permissoes,
    pipedrive_user_id=excluded.pipedrive_user_id, atualizado_em=now();
  UPDATE public.account_access SET status='ativo' WHERE user_id=auth.uid() AND status='pendente';
  IF p.nome IS NOT NULL THEN UPDATE public.profiles SET nome=p.nome WHERE id=auth.uid(); END IF;
  UPDATE public.dcs_pre_cadastros SET aplicado_em=now(), aplicado_user=auth.uid() WHERE email=e;
  PERFORM set_config('dcs.reivindicando','0',true);
  INSERT INTO public.dcs_auditoria(ator,entidade,entidade_id,acao,dados) VALUES (auth.uid(),'convite',e,'aceitar',jsonb_build_object('perfil',p.perfil));
  RETURN true;
END $$;

-- Desativar/reativar (sem excluir). Master e o próprio usuário protegidos; ao desativar, encerra as sessões.
CREATE OR REPLACE FUNCTION public.dcs_definir_status_usuario(p_user uuid, p_ativo boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
  IF NOT public.dcs_pode('usuarios') THEN RAISE EXCEPTION 'Sem permissão' USING ERRCODE='42501'; END IF;
  IF p_user = auth.uid() THEN RAISE EXCEPTION 'Não altere o seu próprio acesso' USING ERRCODE='42501'; END IF;
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=p_user AND role='superadmin') THEN
    RAISE EXCEPTION 'O Administrador Master não pode ser desativado' USING ERRCODE='42501';
  END IF;
  IF NOT public.dcs_eh_master() AND (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=p_user AND role='admin')
     OR EXISTS (SELECT 1 FROM public.dcs_membros WHERE user_id=p_user AND perfil='admin')) THEN
    RAISE EXCEPTION 'Somente o Administrador Master altera administradores' USING ERRCODE='42501';
  END IF;
  UPDATE public.account_access SET status=CASE WHEN p_ativo THEN 'ativo' ELSE 'suspenso' END WHERE user_id=p_user;
  UPDATE public.dcs_membros SET ativo=p_ativo, atualizado_em=now() WHERE user_id=p_user;
  IF NOT p_ativo THEN DELETE FROM auth.sessions WHERE user_id=p_user; END IF;
  PERFORM public.dcs_auditar('acesso', p_user::text, CASE WHEN p_ativo THEN 'reativar' ELSE 'desativar' END, NULL);
END $$;

-- Autoriza (pelo administrador logado) uma operação de credencial; o servidor só executa a API administrativa se isto passar.
CREATE OR REPLACE FUNCTION public.dcs_autorizar_credencial(p_email text) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE e text := lower(trim(p_email)); u uuid; pc public.dcs_pre_cadastros; BEGIN
  IF NOT public.dcs_pode('usuarios') THEN RAISE EXCEPTION 'Sem permissão' USING ERRCODE='42501'; END IF;
  SELECT id INTO u FROM auth.users WHERE lower(email)=e;
  IF u = auth.uid() THEN RAISE EXCEPTION 'Não altere o seu próprio acesso' USING ERRCODE='42501'; END IF;
  IF u IS NOT NULL AND EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=u AND role='superadmin') THEN
    RAISE EXCEPTION 'O Administrador Master não pode ter o acesso redefinido por esta tela' USING ERRCODE='42501';
  END IF;
  IF u IS NOT NULL AND NOT public.dcs_eh_master() AND EXISTS (SELECT 1 FROM public.dcs_membros WHERE user_id=u AND perfil='admin') THEN
    RAISE EXCEPTION 'Somente o Administrador Master redefine administradores' USING ERRCODE='42501';
  END IF;
  IF u IS NULL THEN
    SELECT * INTO pc FROM public.dcs_pre_cadastros WHERE email=e AND aplicado_em IS NULL AND revogado_em IS NULL AND (expira_em IS NULL OR expira_em>now());
    IF pc.email IS NULL THEN RAISE EXCEPTION 'Convite inexistente, revogado ou expirado'; END IF;
  END IF;
  RETURN jsonb_build_object('user_id',u,'email',e,'nome',coalesce(pc.nome,(SELECT nome FROM public.profiles WHERE id=u)),
    'horas',coalesce((SELECT (valor->>'senha_provisoria_horas')::int FROM public.dcs_config WHERE chave='acesso'),48));
END $$;

-- Operações do servidor (service_role) após a autorização acima. Nunca recebem a senha.
CREATE OR REPLACE FUNCTION public.dcs_registrar_provisoria(p_user uuid, p_ator uuid, p_horas int) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
  INSERT INTO public.dcs_seguranca_conta(user_id,troca_obrigatoria,provisoria_gerada_em,provisoria_expira_em,provisoria_gerada_por,atualizado_em)
  VALUES (p_user,true,now(),now()+make_interval(hours=>greatest(1,least(p_horas,168))),p_ator,now())
  ON CONFLICT (user_id) DO UPDATE SET troca_obrigatoria=true, provisoria_gerada_em=now(), provisoria_expira_em=excluded.provisoria_expira_em,
    provisoria_gerada_por=p_ator, atualizado_em=now();
  DELETE FROM auth.sessions WHERE user_id=p_user;  -- credencial anterior e sessões deixam de valer
  INSERT INTO public.dcs_auditoria(ator,entidade,entidade_id,acao,dados) VALUES (p_ator,'acesso',p_user::text,'senha_provisoria',jsonb_build_object('horas',p_horas));
END $$;
CREATE OR REPLACE FUNCTION public.dcs_exigir_definicao_senha(p_user uuid, p_ator uuid, p_acao text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
  INSERT INTO public.dcs_seguranca_conta(user_id,troca_obrigatoria,atualizado_em) VALUES (p_user,true,now())
  ON CONFLICT (user_id) DO UPDATE SET troca_obrigatoria=true, provisoria_expira_em=NULL, atualizado_em=now();
  INSERT INTO public.dcs_auditoria(ator,entidade,entidade_id,acao,dados) VALUES (p_ator,'acesso',p_user::text,p_acao,NULL);
END $$;
CREATE OR REPLACE FUNCTION public.dcs_concluir_definicao_senha(p_user uuid, p_sessao uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
  UPDATE public.dcs_seguranca_conta SET troca_obrigatoria=false, provisoria_expira_em=NULL, senha_definida_em=now(), atualizado_em=now() WHERE user_id=p_user;
  DELETE FROM auth.sessions WHERE user_id=p_user AND (p_sessao IS NULL OR id<>p_sessao);  -- demais sessões provisórias encerradas
  INSERT INTO public.dcs_auditoria(ator,entidade,entidade_id,acao,dados) VALUES (p_user,'acesso',p_user::text,'senha_definida',NULL);
END $$;
CREATE OR REPLACE FUNCTION public.dcs_revogar_sessoes(p_user uuid, p_ator uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
  DELETE FROM auth.sessions WHERE user_id=p_user;
  INSERT INTO public.dcs_auditoria(ator,entidade,entidade_id,acao,dados) VALUES (p_ator,'acesso',p_user::text,'revogar_sessoes',NULL);
END $$;

-- Situação da própria troca de senha (para a tela "Configure sua senha"). A comparação com a senha atual é feita no banco (bcrypt).
CREATE OR REPLACE FUNCTION public.dcs_situacao_senha() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT jsonb_build_object('pendente', coalesce(s.troca_obrigatoria,false), 'expira_em', s.provisoria_expira_em,
    'expirada', coalesce(s.provisoria_expira_em < now(), false))
  FROM (SELECT 1) x LEFT JOIN public.dcs_seguranca_conta s ON s.user_id=auth.uid() $$;
CREATE OR REPLACE FUNCTION public.dcs_senha_igual_atual(p_senha text) RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public, extensions AS $$
DECLARE h text; BEGIN
  SELECT encrypted_password INTO h FROM auth.users WHERE id=auth.uid();
  IF h IS NULL OR h='' THEN RETURN false; END IF;
  RETURN extensions.crypt(p_senha, h) = h;
END $$;

-- ============ 6. Acesso do usuário logado (exibição; o banco revalida tudo) ============
CREATE OR REPLACE FUNCTION public.dcs_meu_acesso() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT jsonb_build_object('perfil', public.dcs_perfil(), 'master', public.dcs_eh_master(), 'financeiro', coalesce(public.dcs_ve_financeiro(),false),
    'editar', public.dcs_pode_editar(), 'exportar', false,
    'modulos', (SELECT m.modulos FROM public.dcs_membros m WHERE m.user_id=auth.uid()),
    'pipedrive', public.dcs_pipedrive_do_usuario(auth.uid()),
    'troca_senha', public.dcs_troca_pendente(auth.uid()),
    'permissoes', (SELECT jsonb_object_agg(k, public.dcs_pode(k)) FROM unnest(ARRAY['concluir','planos','redistribuir','usuarios','config','integracoes']) k),
    'beta', coalesce((SELECT (valor->>'ativo')::boolean FROM public.dcs_config WHERE chave='beta'), true)) $$;

-- ============ 7. Lista de usuários e convites (admin com permissão "usuarios") ============
DROP FUNCTION IF EXISTS public.dcs_listar_usuarios();
CREATE FUNCTION public.dcs_listar_usuarios() RETURNS TABLE(user_id uuid, nome text, email text, status text, papel text, ultimo_acesso timestamptz,
  perfil text, financeiro boolean, pode_editar boolean, pode_exportar boolean, ativo boolean, carteiras integer[], clientes text[], modulos text[],
  pipedrive_user_id integer, master_principal boolean, permissoes jsonb, troca_senha boolean, provisoria_expira_em timestamptz, convidado_por uuid, criado_em timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE mp uuid := (SELECT nullif(valor->>'user_id','')::uuid FROM public.dcs_config WHERE chave='master_principal'); BEGIN
  IF NOT public.dcs_pode('usuarios') THEN RAISE EXCEPTION 'Sem permissão' USING ERRCODE='42501'; END IF;
  RETURN QUERY SELECT p.id, p.nome, p.email, coalesce(a.status,'pendente'), coalesce(r.role::text,'user'), a.last_access_at,
    CASE WHEN r.role IN ('superadmin','admin') THEN 'admin' ELSE m.perfil END, coalesce(m.financeiro, r.role IN ('superadmin','admin')),
    coalesce(m.pode_editar, true), false, coalesce(m.ativo,false) OR r.role='superadmin',
    coalesce(m.carteiras,'{}'), coalesce(m.clientes,'{}'), m.modulos,
    coalesce(m.pipedrive_user_id, (SELECT x.pipedrive_user_id FROM public.dcs_responsaveis x WHERE lower(x.email)=lower(p.email) LIMIT 1)),
    p.id = mp OR (mp IS NULL AND r.role='superadmin'),
    CASE WHEN r.role='superadmin' THEN '{"concluir":true,"planos":true,"redistribuir":true,"usuarios":true,"config":true,"integracoes":true}'::jsonb ELSE coalesce(m.permissoes,'{}') END,
    coalesce(s.troca_obrigatoria,false), s.provisoria_expira_em, m.convidado_por, u.created_at
  FROM public.profiles p JOIN auth.users u ON u.id=p.id LEFT JOIN public.account_access a ON a.user_id=p.id LEFT JOIN public.user_roles r ON r.user_id=p.id
  LEFT JOIN public.dcs_membros m ON m.user_id=p.id LEFT JOIN public.dcs_seguranca_conta s ON s.user_id=p.id ORDER BY p.nome;
END $$;
-- Convites visíveis a quem administra usuários (antes: qualquer admin).
DROP POLICY IF EXISTS dcs_pre_ler ON public.dcs_pre_cadastros;
CREATE POLICY dcs_pre_ler ON public.dcs_pre_cadastros FOR SELECT TO authenticated USING (public.dcs_pode('usuarios'));

-- Logs de segurança: consulta por quem administra usuários (somente metadados; nunca senhas ou links).
CREATE OR REPLACE FUNCTION public.dcs_logs_seguranca(p_limite integer DEFAULT 200) RETURNS TABLE(em timestamptz, ator uuid, entidade text, entidade_id text, acao text, dados jsonb)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$ BEGIN
  IF NOT public.dcs_pode('usuarios') THEN RAISE EXCEPTION 'Sem permissão' USING ERRCODE='42501'; END IF;
  RETURN QUERY SELECT x.em, x.ator, x.entidade, x.entidade_id, x.acao, x.dados FROM public.dcs_auditoria x
   WHERE x.entidade IN ('acesso','convite','pre_cadastro','membro','master','config','job','regras','exportacao')
   ORDER BY x.em DESC LIMIT least(greatest(p_limite,1),500);
END $$;

-- ============ 8. Configurações da versão (Master) ============
CREATE OR REPLACE FUNCTION public.dcs_definir_config_produto(p_chave text, p_valor jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
  IF NOT public.dcs_eh_master() THEN RAISE EXCEPTION 'Somente o Administrador Master' USING ERRCODE='42501'; END IF;
  IF p_chave='beta' THEN
    IF jsonb_typeof(p_valor->'ativo')<>'boolean' THEN RAISE EXCEPTION 'Valor inválido'; END IF;
  ELSIF p_chave='acesso' THEN
    IF (p_valor->>'validade_convite_dias')::int NOT BETWEEN 1 AND 30 OR (p_valor->>'senha_provisoria_horas')::int NOT BETWEEN 1 AND 168 THEN
      RAISE EXCEPTION 'Validade fora dos limites (convite 1–30 dias; senha provisória 1–168 horas)';
    END IF;
  ELSE RAISE EXCEPTION 'Configuração inválida'; END IF;
  INSERT INTO public.dcs_config(chave,valor) VALUES (p_chave,p_valor) ON CONFLICT (chave) DO UPDATE SET valor=excluded.valor;
  PERFORM public.dcs_auditar('config', p_chave, 'alterar', p_valor);
END $$;
CREATE OR REPLACE FUNCTION public.dcs_config_produto() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT CASE WHEN public.dcs_perfil() IS NULL THEN NULL ELSE jsonb_build_object(
    'beta', (SELECT valor FROM public.dcs_config WHERE chave='beta'), 'acesso', (SELECT valor FROM public.dcs_config WHERE chave='acesso')) END $$;

-- ============ 9. Onboarding (persistido por usuário e tour) ============
CREATE TABLE IF NOT EXISTS public.dcs_onboarding (
  user_id uuid NOT NULL, tour text NOT NULL CHECK (tour ~ '^[a-z_]{2,40}$'), versao integer NOT NULL DEFAULT 1,
  etapas_concluidas text[] NOT NULL DEFAULT '{}', etapa_atual text, estado text NOT NULL DEFAULT 'em_andamento'
    CHECK (estado IN ('em_andamento','pausado','concluido','dispensado')),
  preferencias jsonb NOT NULL DEFAULT '{}'::jsonb, concluido_em timestamptz, atualizado_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, tour)
);
ALTER TABLE public.dcs_onboarding ENABLE ROW LEVEL SECURITY;
CREATE POLICY dcs_onb_ler ON public.dcs_onboarding FOR SELECT TO authenticated USING (user_id=auth.uid());
REVOKE ALL ON public.dcs_onboarding FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.dcs_onboarding FROM authenticated;
GRANT SELECT ON public.dcs_onboarding TO authenticated; GRANT ALL ON public.dcs_onboarding TO service_role;
CREATE OR REPLACE FUNCTION public.dcs_salvar_onboarding(p_tour text, p_versao integer, p_estado text, p_etapa text, p_concluidas text[], p_prefs jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
  IF public.dcs_perfil() IS NULL THEN RAISE EXCEPTION 'Sem acesso' USING ERRCODE='42501'; END IF;
  IF coalesce(array_length(p_concluidas,1),0) > 50 THEN RAISE EXCEPTION 'Etapas demais'; END IF;
  INSERT INTO public.dcs_onboarding(user_id,tour,versao,etapas_concluidas,etapa_atual,estado,preferencias,concluido_em,atualizado_em)
  VALUES (auth.uid(),p_tour,p_versao,coalesce(p_concluidas,'{}'),left(p_etapa,60),p_estado,coalesce(p_prefs,'{}'),CASE WHEN p_estado='concluido' THEN now() END,now())
  ON CONFLICT (user_id,tour) DO UPDATE SET versao=excluded.versao, etapas_concluidas=excluded.etapas_concluidas, etapa_atual=excluded.etapa_atual,
    estado=excluded.estado, preferencias=excluded.preferencias,
    concluido_em=CASE WHEN excluded.estado='concluido' THEN coalesce(dcs_onboarding.concluido_em, now()) ELSE NULL END, atualizado_em=now();
END $$;

-- ============ 10. Feedback da versão Beta ============
CREATE TABLE IF NOT EXISTS public.dcs_feedback (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, user_id uuid NOT NULL, criado_em timestamptz NOT NULL DEFAULT now(),
  tipo text NOT NULL CHECK (tipo IN ('sugestao','dificuldade','erro','informacao','outro')),
  descricao text NOT NULL CHECK (length(descricao) BETWEEN 5 AND 4000), funcionalidade text CHECK (length(funcionalidade) <= 120),
  pagina text CHECK (length(pagina) <= 200), versao text CHECK (length(versao) <= 60),
  status text NOT NULL DEFAULT 'novo' CHECK (status IN ('novo','analisado','resolvido'))
);
ALTER TABLE public.dcs_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY dcs_fb_ler ON public.dcs_feedback FOR SELECT TO authenticated USING (user_id=auth.uid() OR public.dcs_eh_master());
REVOKE ALL ON public.dcs_feedback FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.dcs_feedback FROM authenticated;
GRANT SELECT ON public.dcs_feedback TO authenticated; GRANT ALL ON public.dcs_feedback TO service_role;
CREATE OR REPLACE FUNCTION public.dcs_enviar_feedback(p_tipo text, p_descricao text, p_funcionalidade text, p_pagina text, p_versao text) RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE i bigint; BEGIN
  IF public.dcs_perfil() IS NULL THEN RAISE EXCEPTION 'Sem acesso' USING ERRCODE='42501'; END IF;
  IF (SELECT count(*) FROM public.dcs_feedback WHERE user_id=auth.uid() AND criado_em > now()-interval '1 hour') >= 20 THEN
    RAISE EXCEPTION 'Limite de envios atingido. Tente novamente mais tarde.';
  END IF;
  INSERT INTO public.dcs_feedback(user_id,tipo,descricao,funcionalidade,pagina,versao)
  VALUES (auth.uid(),p_tipo,trim(p_descricao),nullif(trim(p_funcionalidade),''),left(regexp_replace(coalesce(p_pagina,''),'\?.*$',''),200),left(p_versao,60))
  RETURNING id INTO i;
  RETURN i;
END $$;
CREATE OR REPLACE FUNCTION public.dcs_atualizar_feedback(p_id bigint, p_status text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
  IF NOT public.dcs_eh_master() THEN RAISE EXCEPTION 'Somente o Administrador Master' USING ERRCODE='42501'; END IF;
  UPDATE public.dcs_feedback SET status=p_status WHERE id=p_id;
END $$;

-- ============ 11. Caminho único para gestão de acessos e grants ============
-- As funções antigas de criação/edição direta deixam de ser chamáveis pela interface (o convite é o único caminho).
REVOKE EXECUTE ON FUNCTION public.dcs_salvar_usuario(text,text,text,boolean,boolean,boolean,boolean,integer[],text[],integer) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.dcs_salvar_permissoes(uuid,text,boolean,boolean,boolean,boolean,integer[],text[],text[]) FROM authenticated;

REVOKE ALL ON FUNCTION public.dcs_salvar_acesso(jsonb), public.dcs_definir_status_usuario(uuid,boolean), public.dcs_autorizar_credencial(text),
  public.dcs_situacao_senha(), public.dcs_senha_igual_atual(text), public.dcs_listar_usuarios(), public.dcs_logs_seguranca(integer),
  public.dcs_definir_config_produto(text,jsonb), public.dcs_config_produto(), public.dcs_salvar_onboarding(text,integer,text,text,text[],jsonb),
  public.dcs_enviar_feedback(text,text,text,text,text), public.dcs_atualizar_feedback(bigint,text), public.dcs_meu_acesso(), public.dcs_pode(text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dcs_salvar_acesso(jsonb), public.dcs_definir_status_usuario(uuid,boolean), public.dcs_autorizar_credencial(text),
  public.dcs_situacao_senha(), public.dcs_senha_igual_atual(text), public.dcs_listar_usuarios(), public.dcs_logs_seguranca(integer),
  public.dcs_definir_config_produto(text,jsonb), public.dcs_config_produto(), public.dcs_salvar_onboarding(text,integer,text,text,text[],jsonb),
  public.dcs_enviar_feedback(text,text,text,text,text), public.dcs_atualizar_feedback(bigint,text), public.dcs_meu_acesso(), public.dcs_pode(text)
  TO authenticated;
REVOKE ALL ON FUNCTION public.dcs_registrar_provisoria(uuid,uuid,int), public.dcs_exigir_definicao_senha(uuid,uuid,text),
  public.dcs_concluir_definicao_senha(uuid,uuid), public.dcs_revogar_sessoes(uuid,uuid), public.dcs_exigir_convite(),
  public.dcs_exigir_permissao_diag(), public.dcs_exigir_permissao_acoes(), public.dcs_exigir_permissao_tabela(), public.dcs_troca_pendente(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.dcs_registrar_provisoria(uuid,uuid,int), public.dcs_exigir_definicao_senha(uuid,uuid,text),
  public.dcs_concluir_definicao_senha(uuid,uuid), public.dcs_revogar_sessoes(uuid,uuid) TO service_role;
