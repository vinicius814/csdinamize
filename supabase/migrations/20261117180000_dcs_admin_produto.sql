-- Dinamize CS — administração do produto (aditiva): master, permissões de edição/exportação,
-- lista de usuários para admins, nomes de analistas e pedidos de atualização da carteira pela interface.

-- Administrador Master = papel superadmin (user_roles, já existente) com conta ativa. Não depende de e-mail ou nome.
CREATE OR REPLACE FUNCTION public.dcs_eh_master() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles r JOIN public.account_access a ON a.user_id=r.user_id
                 WHERE r.user_id=auth.uid() AND r.role='superadmin' AND a.status='ativo') $$;

ALTER TABLE public.dcs_membros
  ADD COLUMN pode_editar boolean NOT NULL DEFAULT true,
  ADD COLUMN pode_exportar boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.dcs_pode_editar() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT CASE WHEN public.dcs_perfil() IS NULL THEN false WHEN public.dcs_perfil()='admin' THEN true
    ELSE coalesce((SELECT m.pode_editar FROM public.dcs_membros m WHERE m.user_id=auth.uid()),false) END $$;

-- Acesso consolidado do usuário logado (a interface só usa para exibir; o banco revalida em cada operação).
CREATE OR REPLACE FUNCTION public.dcs_meu_acesso() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT jsonb_build_object('perfil', public.dcs_perfil(), 'master', public.dcs_eh_master(), 'financeiro', coalesce(public.dcs_ve_financeiro(),false),
    'editar', public.dcs_pode_editar(),
    'exportar', CASE WHEN public.dcs_perfil()='admin' THEN true ELSE coalesce((SELECT m.pode_exportar FROM public.dcs_membros m WHERE m.user_id=auth.uid()),false) END,
    'modulos', (SELECT m.modulos FROM public.dcs_membros m WHERE m.user_id=auth.uid())) $$;

-- Edição bloqueada no banco para quem não tem permissão (vale também dentro das funções SECURITY DEFINER).
CREATE OR REPLACE FUNCTION public.dcs_exigir_edicao() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.dcs_pode_editar() THEN
    RAISE EXCEPTION 'Seu perfil não tem permissão de edição' USING ERRCODE='42501';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER dcs_diag_exige_edicao BEFORE INSERT OR UPDATE ON public.dcs_diagnosticos FOR EACH ROW EXECUTE FUNCTION public.dcs_exigir_edicao();
CREATE TRIGGER dcs_acoes_exige_edicao BEFORE INSERT OR UPDATE ON public.dcs_acoes FOR EACH ROW EXECUTE FUNCTION public.dcs_exigir_edicao();

-- Permissões do Dinamize CS por usuário (somente admin; master protegido).
CREATE OR REPLACE FUNCTION public.dcs_salvar_permissoes(p_user uuid, p_perfil text, p_financeiro boolean, p_editar boolean, p_exportar boolean,
  p_ativo boolean, p_carteiras integer[], p_clientes text[], p_modulos text[]) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NOT public.dcs_eh_admin() THEN RAISE EXCEPTION 'Somente administradores' USING ERRCODE='42501'; END IF;
  IF p_user = auth.uid() THEN RAISE EXCEPTION 'Não altere o seu próprio acesso' USING ERRCODE='42501'; END IF;
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=p_user AND role='superadmin') THEN
    RAISE EXCEPTION 'O Administrador Master não pode ter o acesso alterado por esta tela' USING ERRCODE='42501';
  END IF;
  IF p_perfil NOT IN ('admin','cs','contas') THEN RAISE EXCEPTION 'Perfil inválido'; END IF;
  INSERT INTO public.dcs_membros(user_id,perfil,financeiro,pode_editar,pode_exportar,ativo,carteiras,clientes,modulos,convidado_por)
  VALUES (p_user,p_perfil,p_financeiro,p_editar,p_exportar,p_ativo,coalesce(p_carteiras,'{}'),coalesce(p_clientes,'{}'),p_modulos,auth.uid())
  ON CONFLICT (user_id) DO UPDATE SET perfil=excluded.perfil, financeiro=excluded.financeiro, pode_editar=excluded.pode_editar,
    pode_exportar=excluded.pode_exportar, ativo=excluded.ativo, carteiras=excluded.carteiras, clientes=excluded.clientes,
    modulos=excluded.modulos, atualizado_em=now();
  PERFORM public.dcs_auditar('membro', p_user::text, 'permissoes', jsonb_build_object('perfil',p_perfil,'financeiro',p_financeiro,'editar',p_editar,
    'exportar',p_exportar,'ativo',p_ativo,'carteiras',p_carteiras,'clientes',p_clientes,'modulos',p_modulos));
END $$;

-- Usuários da aplicação com o acesso ao Dinamize CS (somente admin; metadados, sem dados sensíveis).
CREATE OR REPLACE FUNCTION public.dcs_listar_usuarios() RETURNS TABLE(user_id uuid, nome text, email text, status text, papel text, ultimo_acesso timestamptz,
  perfil text, financeiro boolean, pode_editar boolean, pode_exportar boolean, ativo boolean, carteiras integer[], clientes text[], modulos text[])
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NOT public.dcs_eh_admin() THEN RAISE EXCEPTION 'Somente administradores' USING ERRCODE='42501'; END IF;
  RETURN QUERY SELECT p.id, p.nome, p.email, coalesce(a.status,'pendente'), coalesce(r.role::text,'user'), a.last_access_at,
    CASE WHEN r.role IN ('superadmin','admin') THEN 'admin' ELSE m.perfil END, coalesce(m.financeiro, r.role IN ('superadmin','admin')),
    coalesce(m.pode_editar, true), coalesce(m.pode_exportar, r.role IN ('superadmin','admin')), coalesce(m.ativo,false) OR r.role IN ('superadmin','admin'),
    coalesce(m.carteiras,'{}'), coalesce(m.clientes,'{}'), m.modulos
  FROM public.profiles p LEFT JOIN public.account_access a ON a.user_id=p.id LEFT JOIN public.user_roles r ON r.user_id=p.id
  LEFT JOIN public.dcs_membros m ON m.user_id=p.id ORDER BY p.nome;
END $$;

-- Nomes dos analistas (para carteira, histórico e produtividade), visível a qualquer membro ativo.
CREATE OR REPLACE FUNCTION public.dcs_analistas() RETURNS TABLE(user_id uuid, nome text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT p.id, coalesce(nullif(p.nome,''), split_part(p.email,'@',1)) FROM public.profiles p
  WHERE public.dcs_perfil() IS NOT NULL
    AND (EXISTS (SELECT 1 FROM public.dcs_membros m WHERE m.user_id=p.id) OR EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id=p.id AND r.role IN ('admin','superadmin'))
         OR EXISTS (SELECT 1 FROM public.dcs_diagnosticos d WHERE d.analista_id=p.id)) $$;

-- Pedido de atualização (botão "Atualizar carteira"): o app registra, o n8n atende (sem segredos no navegador).
CREATE TABLE public.dcs_solicitacoes_sync (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL CHECK (tipo IN ('carteira','cobertura','responsaveis')),
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','em_execucao','concluida','falha')),
  solicitado_por uuid, solicitado_em timestamptz NOT NULL DEFAULT now(), atendido_em timestamptz, erro text
);
CREATE UNIQUE INDEX dcs_solic_uma_aberta ON public.dcs_solicitacoes_sync(tipo) WHERE status IN ('pendente','em_execucao');
ALTER TABLE public.dcs_solicitacoes_sync ENABLE ROW LEVEL SECURITY;
CREATE POLICY dcs_solic_ler ON public.dcs_solicitacoes_sync FOR SELECT TO authenticated USING (public.dcs_perfil() IS NOT NULL);
REVOKE ALL ON public.dcs_solicitacoes_sync FROM anon; REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.dcs_solicitacoes_sync FROM authenticated;
GRANT SELECT ON public.dcs_solicitacoes_sync TO authenticated; GRANT ALL ON public.dcs_solicitacoes_sync TO service_role;

CREATE OR REPLACE FUNCTION public.dcs_solicitar_sync(p_tipo text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v uuid; BEGIN
  IF NOT public.dcs_eh_admin() THEN RAISE EXCEPTION 'Somente administradores' USING ERRCODE='42501'; END IF;
  SELECT id INTO v FROM public.dcs_solicitacoes_sync WHERE tipo=p_tipo AND status IN ('pendente','em_execucao');
  IF v IS NOT NULL THEN RETURN v; END IF;  -- idempotente: já existe pedido aberto
  INSERT INTO public.dcs_solicitacoes_sync(tipo,solicitado_por) VALUES (p_tipo,auth.uid()) RETURNING id INTO v;
  PERFORM public.dcs_auditar('sync', v::text, 'solicitar', jsonb_build_object('tipo',p_tipo));
  RETURN v; END $$;
CREATE OR REPLACE FUNCTION public.dcs_atender_solicitacoes() RETURNS SETOF public.dcs_solicitacoes_sync LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
  UPDATE public.dcs_solicitacoes_sync SET status='falha', erro='Sem retorno do n8n em 30 minutos' WHERE status='em_execucao' AND atendido_em<now()-interval '30 minutes';
  UPDATE public.dcs_solicitacoes_sync s SET status='em_execucao', atendido_em=now()
   WHERE s.id IN (SELECT id FROM public.dcs_solicitacoes_sync WHERE status='pendente' ORDER BY solicitado_em FOR UPDATE SKIP LOCKED) RETURNING s.* $$;
CREATE OR REPLACE FUNCTION public.dcs_concluir_solicitacao(p_id uuid, p_ok boolean, p_erro text) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
  UPDATE public.dcs_solicitacoes_sync SET status=CASE WHEN p_ok THEN 'concluida' ELSE 'falha' END, erro=left(p_erro,2000) WHERE id=p_id $$;

REVOKE ALL ON FUNCTION public.dcs_eh_master(), public.dcs_pode_editar(), public.dcs_meu_acesso(), public.dcs_salvar_permissoes(uuid,text,boolean,boolean,boolean,boolean,integer[],text[],text[]),
  public.dcs_listar_usuarios(), public.dcs_analistas(), public.dcs_solicitar_sync(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dcs_eh_master(), public.dcs_pode_editar(), public.dcs_meu_acesso(), public.dcs_salvar_permissoes(uuid,text,boolean,boolean,boolean,boolean,integer[],text[],text[]),
  public.dcs_listar_usuarios(), public.dcs_analistas(), public.dcs_solicitar_sync(text) TO authenticated;
REVOKE ALL ON FUNCTION public.dcs_atender_solicitacoes(), public.dcs_concluir_solicitacao(uuid,boolean,text), public.dcs_exigir_edicao() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.dcs_atender_solicitacoes(), public.dcs_concluir_solicitacao(uuid,boolean,text) TO service_role;
