-- Reversão de 20261118163544_dcs_beta_acesso (gerada a partir das migrações anteriores).

-- Não remove tabelas/colunas novas (dados de onboarding, feedback e segurança ficam preservados).

begin;

drop trigger if exists dcs_diag_permissoes on public.dcs_diagnosticos;

drop trigger if exists dcs_acoes_permissoes on public.dcs_acoes;

drop trigger if exists dcs_regras_permissoes on public.dcs_regras;

drop trigger if exists dcs_jobs_permissoes on public.dcs_jobs;

drop trigger if exists dcs_membros_permissoes on public.dcs_membros;

drop trigger if exists dcs_pre_permissoes on public.dcs_pre_cadastros;

drop trigger if exists dcs_exigir_convite on auth.users;

-- origem: supabase/migrations/20261117180000_dcs_admin_produto.sql
CREATE OR REPLACE FUNCTION public.dcs_eh_master() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles r JOIN public.account_access a ON a.user_id=r.user_id
                 WHERE r.user_id=auth.uid() AND r.role='superadmin' AND a.status='ativo') $$;

-- origem: supabase/migrations/20261118150803_dcs_meu_acesso_pipedrive.sql
CREATE OR REPLACE FUNCTION public.dcs_meu_acesso() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT jsonb_build_object('perfil', public.dcs_perfil(), 'master', public.dcs_eh_master(), 'financeiro', coalesce(public.dcs_ve_financeiro(),false),
    'editar', public.dcs_pode_editar(),
    'exportar', CASE WHEN public.dcs_perfil()='admin' THEN true ELSE coalesce((SELECT m.pode_exportar FROM public.dcs_membros m WHERE m.user_id=auth.uid()),false) END,
    'modulos', (SELECT m.modulos FROM public.dcs_membros m WHERE m.user_id=auth.uid()),
    'pipedrive', public.dcs_pipedrive_do_usuario(auth.uid())) $$;

-- origem: supabase/migrations/20261117142211_dcs_fundacao.sql
CREATE OR REPLACE FUNCTION public.dcs_perfil() RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT CASE
    WHEN NOT EXISTS (SELECT 1 FROM public.account_access a WHERE a.user_id=auth.uid() AND a.status='ativo') THEN NULL
    WHEN EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id=auth.uid() AND r.role IN ('admin','superadmin')) THEN 'admin'
    ELSE (SELECT m.perfil FROM public.dcs_membros m WHERE m.user_id=auth.uid() AND m.ativo
          AND (m.convite_expira_em IS NULL OR m.convite_expira_em>now() OR EXISTS (SELECT 1 FROM public.account_access a WHERE a.user_id=m.user_id AND a.last_access_at IS NOT NULL)))
  END $$;

-- origem: supabase/migrations/20261117190000_dcs_operacao.sql
CREATE OR REPLACE FUNCTION public.dcs_perfil_de(p_user uuid) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT CASE
    WHEN NOT EXISTS (SELECT 1 FROM public.account_access a WHERE a.user_id=p_user AND a.status='ativo') THEN NULL
    WHEN EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id=p_user AND r.role IN ('admin','superadmin')) THEN 'admin'
    ELSE (SELECT m.perfil FROM public.dcs_membros m WHERE m.user_id=p_user AND m.ativo)
  END $$;

-- origem: supabase/migrations/20261118144532_dcs_evolucao.sql
CREATE OR REPLACE FUNCTION public.dcs_registrar_convite(p_email text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
  IF NOT public.dcs_eh_admin() THEN RAISE EXCEPTION 'Somente administradores' USING ERRCODE='42501'; END IF;
  UPDATE public.dcs_pre_cadastros SET convite_enviado_em=now() WHERE email=lower(trim(p_email));
  PERFORM public.dcs_auditar('pre_cadastro', lower(trim(p_email)), 'convite', NULL);
END $$;

-- origem: supabase/migrations/20261118144532_dcs_evolucao.sql
CREATE OR REPLACE FUNCTION public.dcs_reivindicar_acesso() RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE e text; p public.dcs_pre_cadastros; BEGIN
  SELECT lower(email) INTO e FROM auth.users WHERE id=auth.uid() AND email_confirmed_at IS NOT NULL;
  IF e IS NULL THEN RETURN false; END IF;
  SELECT * INTO p FROM public.dcs_pre_cadastros WHERE email=e AND aplicado_em IS NULL AND revogado_em IS NULL AND ativo FOR UPDATE;
  IF p.email IS NULL THEN RETURN false; END IF;
  INSERT INTO public.dcs_membros(user_id,perfil,financeiro,pode_editar,pode_exportar,ativo,carteiras,clientes,pipedrive_user_id,convidado_por)
  VALUES (auth.uid(),p.perfil,p.financeiro,p.pode_editar,p.pode_exportar,true,p.carteiras,p.clientes,p.pipedrive_user_id,p.criado_por)
  ON CONFLICT (user_id) DO UPDATE SET perfil=excluded.perfil, financeiro=excluded.financeiro, pode_editar=excluded.pode_editar, pode_exportar=excluded.pode_exportar,
    ativo=true, carteiras=excluded.carteiras, clientes=excluded.clientes, pipedrive_user_id=excluded.pipedrive_user_id, atualizado_em=now();
  UPDATE public.account_access SET status='ativo' WHERE user_id=auth.uid() AND status='pendente';
  IF p.nome IS NOT NULL THEN UPDATE public.profiles SET nome=p.nome WHERE id=auth.uid() AND coalesce(nome,'') IN ('', split_part(email,'@',1)); END IF;
  UPDATE public.dcs_pre_cadastros SET aplicado_em=now(), aplicado_user=auth.uid() WHERE email=e;
  INSERT INTO public.dcs_auditoria(ator,entidade,entidade_id,acao,dados) VALUES (auth.uid(),'pre_cadastro',e,'aplicado',jsonb_build_object('perfil',p.perfil));
  RETURN true;
END $$;

-- origem: supabase/migrations/20261118144532_dcs_evolucao.sql
CREATE OR REPLACE FUNCTION public.dcs_revogar_pre_cadastro(p_email text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
  IF NOT public.dcs_eh_admin() THEN RAISE EXCEPTION 'Somente administradores' USING ERRCODE='42501'; END IF;
  UPDATE public.dcs_pre_cadastros SET revogado_em=now(), ativo=false, atualizado_em=now() WHERE email=lower(trim(p_email)) AND aplicado_em IS NULL;
  PERFORM public.dcs_auditar('pre_cadastro', lower(trim(p_email)), 'revogar', NULL);
END $$;

-- função nova mantida: dcs_atualizar_feedback

-- função nova mantida: dcs_autorizar_credencial

-- função nova mantida: dcs_concluir_definicao_senha

-- função nova mantida: dcs_config_produto

-- função nova mantida: dcs_definir_config_produto

-- função nova mantida: dcs_definir_status_usuario

-- função nova mantida: dcs_enviar_feedback

-- função nova mantida: dcs_exigir_convite

-- função nova mantida: dcs_exigir_definicao_senha

-- função nova mantida: dcs_exigir_permissao_acoes

-- função nova mantida: dcs_exigir_permissao_diag

-- função nova mantida: dcs_exigir_permissao_tabela

-- função nova mantida: dcs_logs_seguranca

-- função nova mantida: dcs_permissoes_validas

-- função nova mantida: dcs_pode

-- função nova mantida: dcs_registrar_provisoria

-- função nova mantida: dcs_revogar_sessoes

-- função nova mantida: dcs_salvar_acesso

-- função nova mantida: dcs_salvar_onboarding

-- função nova mantida: dcs_senha_igual_atual

-- função nova mantida: dcs_situacao_senha

-- função nova mantida: dcs_troca_pendente

grant execute on function public.dcs_salvar_usuario to authenticated;
grant execute on function public.dcs_salvar_permissoes to authenticated;

alter table public.dcs_membros drop constraint if exists dcs_membros_sem_exportacao;
alter table public.dcs_pre_cadastros drop constraint if exists dcs_pre_sem_exportacao;

commit;
-- Observação: dcs_listar_usuarios() e a política dcs_pre_ler permanecem na versão nova (retorno é um superconjunto
-- do anterior; administradores já recebem a permissão "usuarios" na migração). Tabelas novas não são removidas.
