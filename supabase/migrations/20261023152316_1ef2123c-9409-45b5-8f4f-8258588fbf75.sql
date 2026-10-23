CREATE OR REPLACE FUNCTION public.admin_mutation(actor uuid,target uuid,operation text,value jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE actor_role public.app_role; target_role public.app_role; BEGIN
SELECT role INTO actor_role FROM public.user_roles WHERE user_id=actor;
IF actor_role NOT IN ('admin','superadmin') OR actor_role IS NULL OR NOT EXISTS(SELECT 1 FROM public.account_access WHERE user_id=actor AND status='ativo') THEN RAISE EXCEPTION 'Acesso negado'; END IF;
IF target=actor AND operation IN ('role','status') THEN RAISE EXCEPTION 'Não altere seu próprio acesso'; END IF;
SELECT role INTO target_role FROM public.user_roles WHERE user_id=target;
IF actor_role='admin' AND target_role IN ('admin','superadmin') THEN RAISE EXCEPTION 'Só superadmin gerencia administradores'; END IF;
IF operation='status' THEN
IF value#>>'{}' NOT IN ('pendente','ativo','suspenso') THEN RAISE EXCEPTION 'Status inválido'; END IF;
UPDATE public.account_access SET status=value#>>'{}' WHERE user_id=target;
IF NOT FOUND THEN RAISE EXCEPTION 'Conta não encontrada'; END IF;
ELSIF operation='role' THEN
IF actor_role<>'superadmin' THEN RAISE EXCEPTION 'Só superadmin altera papéis'; END IF;
UPDATE public.user_roles SET role=(value#>>'{}')::public.app_role WHERE user_id=target;
IF NOT FOUND THEN RAISE EXCEPTION 'Conta não encontrada'; END IF;
ELSIF operation='limit' THEN
IF (value#>>'{}')::numeric<0 OR (value#>>'{}')::numeric>100000 THEN RAISE EXCEPTION 'Limite inválido'; END IF;
INSERT INTO public.config_usuario(user_id,limite_custo_usd) VALUES(target,(value#>>'{}')::numeric) ON CONFLICT(user_id) DO UPDATE SET limite_custo_usd=excluded.limite_custo_usd;
ELSIF operation='registration' THEN UPDATE public.admin_settings SET manual_approval=(value#>>'{}')::boolean WHERE id=true;
ELSE RAISE EXCEPTION 'Operação inválida'; END IF;
INSERT INTO public.audit_log(actor_id,target_id,action,details) VALUES(actor,target,operation,jsonb_build_object('value',value));
END $$;
REVOKE ALL ON FUNCTION public.admin_mutation(uuid,uuid,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.admin_mutation(uuid,uuid,text,jsonb) TO service_role;
REVOKE UPDATE(limite_custo_usd) ON public.config_usuario FROM authenticated;
REVOKE UPDATE ON public.config_usuario FROM authenticated;
GRANT UPDATE(pipeline_id,campo_ultimo_contato,dias_alerta,pasta_drive_id,onboarding_concluido) ON public.config_usuario TO authenticated;
REVOKE INSERT ON public.config_usuario FROM authenticated;
GRANT INSERT(user_id,pipeline_id,campo_ultimo_contato,dias_alerta,pasta_drive_id,onboarding_concluido) ON public.config_usuario TO authenticated;