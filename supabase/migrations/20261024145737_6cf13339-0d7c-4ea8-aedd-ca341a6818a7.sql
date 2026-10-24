CREATE OR REPLACE FUNCTION public.cs_publicar_tudo(run uuid, rows jsonb, atividades jsonb, lidos integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$ DECLARE dia_local date := (now() AT TIME ZONE 'America/Sao_Paulo')::date; BEGIN
 IF jsonb_typeof(atividades)<>'array' THEN RAISE EXCEPTION 'Atividades inválidas'; END IF;
 UPDATE public.cs_eventos_onboarding e SET saiu_em=dia_local, etapa_saida=s.stage_id
 FROM public.cs_snapshot s WHERE e.deal_id=s.deal_id AND e.saiu_em IS NULL AND s.pipeline_id=1 AND s.status='open'
  AND NOT EXISTS(SELECT 1 FROM jsonb_to_recordset(rows) x(deal_id bigint,pipeline_id integer,status text) WHERE x.deal_id=e.deal_id AND x.pipeline_id=1 AND x.status='open');
 PERFORM public.cs_publicar_snapshot(run,rows,lidos);
 UPDATE public.cs_snapshot s SET contato_dominios=t.d FROM (SELECT (x->>'deal_id')::bigint id, coalesce(array(SELECT jsonb_array_elements_text(coalesce(x->'contato_dominios','[]'::jsonb))),'{}') d FROM jsonb_array_elements(rows) x) t WHERE t.id=s.deal_id;
 INSERT INTO public.cs_eventos_onboarding(deal_id,org_id,owner_id,entrou_em)
 SELECT deal_id,org_id,owner_id,coalesce(data_contratacao,(add_time AT TIME ZONE 'America/Sao_Paulo')::date) FROM public.cs_snapshot WHERE pipeline_id=1 AND status='open'
 ON CONFLICT(deal_id) DO UPDATE SET owner_id=excluded.owner_id, org_id=excluded.org_id, saiu_em=NULL, etapa_saida=NULL;
 INSERT INTO public.cs_atividades_cache(activity_id,deal_id,pipeline_id,owner_id,tipo,assunto,inicio,dia,fim,concluida,sync_id)
 SELECT x.activity_id,x.deal_id,s.pipeline_id,x.owner_id,x.tipo,x.assunto,x.inicio,x.dia,x.fim,x.concluida,run FROM jsonb_to_recordset(atividades) x(activity_id bigint,deal_id bigint,owner_id integer,tipo text,assunto text,inicio timestamptz,dia date,fim timestamptz,concluida boolean) JOIN public.cs_snapshot s ON s.deal_id=x.deal_id
 ON CONFLICT(activity_id) DO UPDATE SET deal_id=excluded.deal_id,pipeline_id=excluded.pipeline_id,owner_id=excluded.owner_id,tipo=excluded.tipo,assunto=excluded.assunto,inicio=excluded.inicio,dia=excluded.dia,fim=excluded.fim,concluida=excluded.concluida,sync_id=run,atualizado_em=now();
 DELETE FROM public.cs_atividades_cache WHERE sync_id<>run;
 DELETE FROM public.cs_base_diaria WHERE dia=dia_local;
 INSERT INTO public.cs_base_diaria(dia,pipeline_id,cliente,owner_id,mrr)
 SELECT DISTINCT ON (pipeline_id,cliente) dia_local,pipeline_id,cliente,owner_id,sum(valor) OVER (PARTITION BY pipeline_id,cliente)
 FROM (SELECT pipeline_id,coalesce('org:'||org_id::text,'deal:'||deal_id::text) cliente,owner_id,valor FROM public.cs_snapshot WHERE status='open' AND pipeline_id IN (15,16) AND stage_id NOT IN (105,111)) b
 ORDER BY pipeline_id,cliente,valor DESC NULLS LAST;
END $$;