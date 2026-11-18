-- Acesso do usuário logado passa a incluir o usuário do Pipedrive vinculado (central de trabalho e registro de atividades).
CREATE OR REPLACE FUNCTION public.dcs_meu_acesso() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT jsonb_build_object('perfil', public.dcs_perfil(), 'master', public.dcs_eh_master(), 'financeiro', coalesce(public.dcs_ve_financeiro(),false),
    'editar', public.dcs_pode_editar(),
    'exportar', CASE WHEN public.dcs_perfil()='admin' THEN true ELSE coalesce((SELECT m.pode_exportar FROM public.dcs_membros m WHERE m.user_id=auth.uid()),false) END,
    'modulos', (SELECT m.modulos FROM public.dcs_membros m WHERE m.user_id=auth.uid()),
    'pipedrive', public.dcs_pipedrive_do_usuario(auth.uid())) $$;
