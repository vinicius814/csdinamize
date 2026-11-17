-- Somente o Administrador Master concede ou altera o perfil Administrador do Dinamize CS.
CREATE OR REPLACE FUNCTION public.dcs_salvar_permissoes(p_user uuid, p_perfil text, p_financeiro boolean, p_editar boolean, p_exportar boolean,
  p_ativo boolean, p_carteiras integer[], p_clientes text[], p_modulos text[]) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NOT public.dcs_eh_admin() THEN RAISE EXCEPTION 'Somente administradores' USING ERRCODE='42501'; END IF;
  IF p_user = auth.uid() THEN RAISE EXCEPTION 'Não altere o seu próprio acesso' USING ERRCODE='42501'; END IF;
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=p_user AND role='superadmin') THEN
    RAISE EXCEPTION 'O Administrador Master não pode ter o acesso alterado por esta tela' USING ERRCODE='42501';
  END IF;
  IF p_perfil NOT IN ('admin','cs','contas') THEN RAISE EXCEPTION 'Perfil inválido'; END IF;
  IF (p_perfil='admin' OR EXISTS (SELECT 1 FROM public.dcs_membros WHERE user_id=p_user AND perfil='admin')
      OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=p_user AND role='admin')) AND NOT public.dcs_eh_master() THEN
    RAISE EXCEPTION 'Somente o Administrador Master concede ou altera o perfil Administrador' USING ERRCODE='42501';
  END IF;
  INSERT INTO public.dcs_membros(user_id,perfil,financeiro,pode_editar,pode_exportar,ativo,carteiras,clientes,modulos,convidado_por)
  VALUES (p_user,p_perfil,p_financeiro,p_editar,p_exportar,p_ativo,coalesce(p_carteiras,'{}'),coalesce(p_clientes,'{}'),p_modulos,auth.uid())
  ON CONFLICT (user_id) DO UPDATE SET perfil=excluded.perfil, financeiro=excluded.financeiro, pode_editar=excluded.pode_editar,
    pode_exportar=excluded.pode_exportar, ativo=excluded.ativo, carteiras=excluded.carteiras, clientes=excluded.clientes,
    modulos=excluded.modulos, atualizado_em=now();
  PERFORM public.dcs_auditar('membro', p_user::text, 'permissoes', jsonb_build_object('perfil',p_perfil,'financeiro',p_financeiro,'editar',p_editar,
    'exportar',p_exportar,'ativo',p_ativo,'carteiras',p_carteiras,'clientes',p_clientes,'modulos',p_modulos));
END $$;
