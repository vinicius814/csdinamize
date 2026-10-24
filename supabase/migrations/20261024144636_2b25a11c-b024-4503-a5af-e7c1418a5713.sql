REVOKE EXECUTE ON FUNCTION public.cs_atualizar_regras(jsonb) FROM authenticated;
CREATE OR REPLACE FUNCTION public.cs_atualizar_regras_por(actor uuid, regras jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.account_access a JOIN public.profiles p ON p.id=a.user_id LEFT JOIN public.user_roles r ON r.user_id=p.id WHERE p.id=actor AND a.status='ativo' AND a.terms_accepted_at IS NOT NULL AND (r.role IN ('admin','superadmin') OR p.papel IN ('gestor','admin'))) THEN RAISE EXCEPTION 'Apenas gestores e administradores alteram as regras de risco'; END IF;
 UPDATE public.cs_regras_risco SET dias_atencao=(regras->>'dias_atencao')::int, dias_risco=(regras->>'dias_risco')::int, vencidas_atencao=(regras->>'vencidas_atencao')::int, vencidas_risco=(regras->>'vencidas_risco')::int, considerar_sem_uso_como_risco=(regras->>'considerar_sem_uso_como_risco')::boolean, retorno_pendente_dias=(regras->>'retorno_pendente_dias')::int, atualizado_por=actor WHERE id;
 INSERT INTO public.audit_log(actor_id,action,details) VALUES(actor,'cs_regras_risco',regras);
END $$;
REVOKE ALL ON FUNCTION public.cs_atualizar_regras_por(uuid,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cs_atualizar_regras_por(uuid,jsonb) TO service_role;