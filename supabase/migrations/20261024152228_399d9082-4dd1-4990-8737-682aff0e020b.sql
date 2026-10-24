CREATE OR REPLACE FUNCTION public.cs_email_status(recebido timestamptz,enviado timestamptz,retorno_limite integer,analista_limite integer,agora timestamptz DEFAULT now()) RETURNS text LANGUAGE sql STABLE SET search_path TO 'public' AS $$
SELECT CASE
 WHEN recebido IS NULL AND enviado IS NULL THEN 'sem_email'
 WHEN recebido IS NOT NULL AND (enviado IS NULL OR recebido>enviado) AND (agora AT TIME ZONE 'America/Sao_Paulo')::date-(recebido AT TIME ZONE 'America/Sao_Paulo')::date>retorno_limite THEN 'aguardando_resposta'
 WHEN enviado IS NOT NULL AND (recebido IS NULL OR enviado>recebido) AND enviado<agora-interval '30 days' THEN 'sem_email_recente'
 WHEN enviado IS NOT NULL AND (recebido IS NULL OR enviado>recebido) AND enviado BETWEEN agora-interval '30 days' AND agora AND (agora AT TIME ZONE 'America/Sao_Paulo')::date-(enviado AT TIME ZONE 'America/Sao_Paulo')::date>analista_limite THEN 'analista_aguardando'
 WHEN greatest(recebido,enviado)>=agora-interval '60 days' THEN 'em_dia'
 ELSE 'sem_email_recente' END
$$;
REVOKE ALL ON FUNCTION public.cs_email_status(timestamptz,timestamptz,integer,integer,timestamptz) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.cs_email_status(timestamptz,timestamptz,integer,integer,timestamptz) TO authenticated,service_role;
CREATE OR REPLACE VIEW public.cs_snapshot_risco WITH (security_invoker=true) AS
SELECT s.deal_id,s.org_id,s.titulo,s.pipeline_id,s.stage_id,s.owner_id,s.owner_nome,s.status,s.valor,s.perfil_conta,s.ultimo_contato_efetivo,s.ultima_reuniao_cs,s.data_contratacao,s.stage_change_time,s.add_time,s.proxima_atividade_data,s.atividades_vencidas,s.sync_id,s.atualizado_em,s.created_at,s.updated_at,s.org_nome,s.ultima_atividade_concluida,s.ultimo_email_recebido,s.ultimo_email_enviado,s.atividades_abertas,s.contato_efetivo,s.origem_contato,
 CASE WHEN (s.pipeline_id=15 AND s.stage_id<>105 OR s.pipeline_id=16 AND s.stage_id<>111) AND s.status='open' THEN r.cor END AS risco_cor,
 CASE WHEN (s.pipeline_id=15 AND s.stage_id<>105 OR s.pipeline_id=16 AND s.stage_id<>111) AND s.status='open' THEN r.fatores ELSE '{}'::text[] END AS risco_fatores,r.dias_contato,r.retorno_dias,
 public.cs_email_status(s.ultimo_email_recebido,s.ultimo_email_enviado,coalesce(g.retorno_pendente_dias,3),coalesce(g.analista_aguardando_dias,7)) AS email_status,
 (now() AT TIME ZONE 'America/Sao_Paulo')::date-(s.ultimo_email_enviado AT TIME ZONE 'America/Sao_Paulo')::date AS dias_desde_envio
FROM public.cs_snapshot s CROSS JOIN LATERAL public.cs_avaliar_risco(s.contato_efetivo,s.atividades_vencidas,s.stage_id,s.proxima_atividade_data,s.ultimo_email_recebido,s.ultimo_email_enviado) r LEFT JOIN public.cs_regras_risco g ON g.id;
DO $$ BEGIN
 IF public.cs_email_status(NULL,'2026-10-16T15:00:00Z',3,7,'2026-10-24T15:00:00Z') <> 'analista_aguardando' THEN RAISE EXCEPTION 'Espera acima de 7 dias'; END IF;
 IF public.cs_email_status(NULL,'2026-10-17T15:00:00Z',3,7,'2026-10-24T15:00:00Z') <> 'em_dia' THEN RAISE EXCEPTION 'Limite de 7 dias'; END IF;
 IF public.cs_email_status(NULL,'2026-09-24T15:00:00Z',3,7,'2026-10-24T15:00:00Z') <> 'analista_aguardando' THEN RAISE EXCEPTION 'Limite de 30 dias'; END IF;
 IF public.cs_email_status(NULL,'2026-09-24T14:59:59Z',3,7,'2026-10-24T15:00:00Z') <> 'sem_email_recente' THEN RAISE EXCEPTION 'Envio antigo sem resposta'; END IF;
 IF public.cs_email_status('2026-10-20T02:00:00Z','2026-10-20T00:00:00Z',3,7,'2026-10-24T15:00:00Z') <> 'aguardando_resposta' THEN RAISE EXCEPTION 'Comparacao de timestamps e dia Sao Paulo'; END IF;
 IF public.cs_email_status('2026-10-23T15:00:00Z','2026-10-16T15:00:00Z',3,7,'2026-10-24T15:00:00Z') <> 'em_dia' THEN RAISE EXCEPTION 'Resposta posterior encerra espera do analista'; END IF;
END $$;