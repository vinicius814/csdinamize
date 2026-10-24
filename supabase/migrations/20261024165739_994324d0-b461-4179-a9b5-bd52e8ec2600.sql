ALTER TABLE public.cs_snapshot ADD COLUMN IF NOT EXISTS etiquetas integer[] NOT NULL DEFAULT '{}';
ALTER TABLE public.cs_eventos_valor ADD COLUMN IF NOT EXISTS origem text NOT NULL DEFAULT 'snapshot';

CREATE TABLE IF NOT EXISTS public.cs_upgrade_fonte (
  deal_id bigint PRIMARY KEY,
  consultado_em timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.cs_upgrade_fonte TO service_role;
ALTER TABLE public.cs_upgrade_fonte ENABLE ROW LEVEL SECURITY;

DROP VIEW IF EXISTS public.cs_snapshot_risco;
DROP FUNCTION IF EXISTS public.cs_avaliar_risco(date,integer,integer,date,timestamp with time zone,timestamp with time zone);

CREATE FUNCTION public.cs_avaliar_risco(contato date, vencidas integer, stage integer, proxima date, recebido timestamp with time zone, enviado timestamp with time zone, etiquetas integer[])
 RETURNS TABLE(cor text, fatores text[], dias_contato integer, retorno_dias integer)
 LANGUAGE plpgsql STABLE SET search_path TO 'public'
AS $function$
DECLARE g public.cs_regras_risco; hoje date := (now() AT TIME ZONE 'America/Sao_Paulo')::date; dias integer; ret integer; v text[] := '{}'; a text[] := '{}';
BEGIN
 SELECT * INTO g FROM public.cs_regras_risco LIMIT 1;
 IF g.id IS NULL THEN g.dias_atencao:=45; g.dias_risco:=75; g.considerar_sem_uso_como_risco:=true; g.retorno_pendente_dias:=3; g.sem_proxima_atividade_e_atencao:=true; END IF;
 dias := CASE WHEN contato IS NULL THEN NULL ELSE hoje-contato END;
 IF recebido IS NOT NULL AND (enviado IS NULL OR recebido>enviado) THEN ret := hoje-(recebido AT TIME ZONE 'America/Sao_Paulo')::date; END IF;
 IF dias IS NOT NULL AND dias>=g.dias_risco THEN v:=v||(dias||' dias sem contato efetivo'); ELSIF dias IS NOT NULL AND dias>=g.dias_atencao THEN a:=a||(dias||' dias sem contato efetivo'); END IF;
 IF g.considerar_sem_uso_como_risco AND stage IN (104,110) THEN v:=v||'negócio na etapa Sem uso'::text; END IF;
 IF 709 = ANY(coalesce(etiquetas,'{}'::integer[])) THEN v:=v||'etiqueta Risco de Churn no Pipedrive'::text; END IF;
 IF contato IS NULL THEN
  IF cardinality(v)>0 THEN RETURN QUERY SELECT 'vermelho'::text, v||'sem data de contato efetivo no Pipedrive'::text, dias, ret; RETURN; END IF;
  RETURN QUERY SELECT 'sem_dados'::text, '{sem data de contato efetivo no Pipedrive}'::text[], dias, ret; RETURN;
 END IF;
 IF proxima IS NULL AND g.sem_proxima_atividade_e_atencao THEN a:=a||'sem próxima atividade agendada'::text; END IF;
 RETURN QUERY SELECT CASE WHEN cardinality(v)>0 THEN 'vermelho' WHEN cardinality(a)>0 THEN 'amarelo' ELSE 'verde' END, v||a, dias, ret;
END $function$;

CREATE VIEW public.cs_snapshot_risco WITH (security_invoker=on) AS
 SELECT s.deal_id, s.org_id, s.titulo, s.pipeline_id, s.stage_id, s.owner_id, s.owner_nome, s.status, s.valor, s.perfil_conta,
  s.ultimo_contato_efetivo, s.ultima_reuniao_cs, s.data_contratacao, s.stage_change_time, s.add_time, s.proxima_atividade_data,
  s.atividades_vencidas, s.sync_id, s.atualizado_em, s.created_at, s.updated_at, s.org_nome, s.ultima_atividade_concluida,
  s.ultimo_email_recebido, s.ultimo_email_enviado, s.atividades_abertas, s.contato_efetivo, s.origem_contato, s.contato_dominios, s.etiquetas,
  CASE WHEN (((s.pipeline_id = 15) AND (s.stage_id <> 105)) OR ((s.pipeline_id = 16) AND (s.stage_id <> 111))) AND (s.status = 'open'::text) THEN r.cor ELSE NULL::text END AS risco_cor,
  CASE WHEN (((s.pipeline_id = 15) AND (s.stage_id <> 105)) OR ((s.pipeline_id = 16) AND (s.stage_id <> 111))) AND (s.status = 'open'::text) THEN r.fatores ELSE '{}'::text[] END AS risco_fatores,
  r.dias_contato, r.retorno_dias,
  cs_email_status(s.ultimo_email_recebido, s.ultimo_email_enviado, COALESCE(g.retorno_pendente_dias, 3), COALESCE(g.analista_aguardando_dias, 7)) AS email_status,
  ((now() AT TIME ZONE 'America/Sao_Paulo'::text))::date - ((s.ultimo_email_enviado AT TIME ZONE 'America/Sao_Paulo'::text))::date AS dias_desde_envio
 FROM (public.cs_snapshot s
   CROSS JOIN LATERAL public.cs_avaliar_risco(s.ultimo_contato_efetivo, s.atividades_vencidas, s.stage_id, s.proxima_atividade_data, s.ultimo_email_recebido, s.ultimo_email_enviado, s.etiquetas) r(cor, fatores, dias_contato, retorno_dias))
   LEFT JOIN public.cs_regras_risco g ON (g.id);
GRANT SELECT ON public.cs_snapshot_risco TO authenticated;
GRANT SELECT ON public.cs_snapshot_risco TO service_role;

CREATE OR REPLACE FUNCTION public.cs_publicar_snapshot(run uuid, rows jsonb, lidos integer)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$ DECLARE dia_local date := (now() AT TIME ZONE 'America/Sao_Paulo')::date; BEGIN
PERFORM pg_advisory_xact_lock(841516);
IF NOT EXISTS(SELECT 1 FROM public.cs_sync_runs WHERE id=run AND status='executando' FOR UPDATE) THEN RAISE EXCEPTION 'Atualização não está em execução'; END IF;
IF jsonb_typeof(rows)<>'array' OR lidos<jsonb_array_length(rows) THEN RAISE EXCEPTION 'Snapshot inválido'; END IF;
CREATE TEMP TABLE novos ON COMMIT DROP AS SELECT * FROM jsonb_to_recordset(rows) AS x(deal_id bigint,org_id bigint,org_nome text,titulo text,pipeline_id integer,stage_id integer,owner_id integer,owner_nome text,status text,valor numeric,perfil_conta text,ultimo_contato_efetivo date,ultima_reuniao_cs date,data_contratacao date,stage_change_time timestamptz,add_time timestamptz,proxima_atividade_data date,atividades_vencidas integer,atividades_abertas integer,ultima_atividade_concluida date,ultimo_email_recebido timestamptz,ultimo_email_enviado timestamptz,contato_efetivo date,origem_contato text,etiquetas integer[]); CREATE INDEX ON novos(deal_id); ANALYZE novos;
INSERT INTO public.cs_eventos_valor(deal_id,dia,pipeline_id,owner_id,valor_anterior,valor_novo)
SELECT n.deal_id,dia_local,n.pipeline_id,n.owner_id,s.valor,n.valor FROM novos n JOIN public.cs_snapshot s ON s.deal_id=n.deal_id
WHERE n.status='open' AND s.status='open' AND n.pipeline_id=s.pipeline_id AND n.valor IS NOT NULL AND s.valor IS NOT NULL AND n.valor<>s.valor
ON CONFLICT(deal_id,dia) DO UPDATE SET valor_novo=excluded.valor_novo,owner_id=excluded.owner_id;
INSERT INTO public.cs_snapshot(deal_id,org_id,org_nome,titulo,pipeline_id,stage_id,owner_id,owner_nome,status,valor,perfil_conta,ultimo_contato_efetivo,ultima_reuniao_cs,data_contratacao,stage_change_time,add_time,proxima_atividade_data,atividades_vencidas,atividades_abertas,ultima_atividade_concluida,ultimo_email_recebido,ultimo_email_enviado,contato_efetivo,origem_contato,etiquetas,sync_id,atualizado_em)
SELECT x.deal_id,x.org_id,x.org_nome,x.titulo,x.pipeline_id,x.stage_id,x.owner_id,x.owner_nome,x.status,x.valor,x.perfil_conta,x.ultimo_contato_efetivo,x.ultima_reuniao_cs,x.data_contratacao,x.stage_change_time,x.add_time,x.proxima_atividade_data,x.atividades_vencidas,coalesce(x.atividades_abertas,0),x.ultima_atividade_concluida,x.ultimo_email_recebido,x.ultimo_email_enviado,x.contato_efetivo,x.origem_contato,coalesce(x.etiquetas,'{}'::integer[]),run,now() FROM novos x
ON CONFLICT(deal_id) DO UPDATE SET org_id=excluded.org_id,org_nome=excluded.org_nome,titulo=excluded.titulo,pipeline_id=excluded.pipeline_id,stage_id=excluded.stage_id,owner_id=excluded.owner_id,owner_nome=excluded.owner_nome,status=excluded.status,valor=excluded.valor,perfil_conta=excluded.perfil_conta,ultimo_contato_efetivo=excluded.ultimo_contato_efetivo,ultima_reuniao_cs=excluded.ultima_reuniao_cs,data_contratacao=excluded.data_contratacao,stage_change_time=excluded.stage_change_time,add_time=excluded.add_time,proxima_atividade_data=excluded.proxima_atividade_data,atividades_vencidas=excluded.atividades_vencidas,atividades_abertas=excluded.atividades_abertas,ultima_atividade_concluida=excluded.ultima_atividade_concluida,ultimo_email_recebido=excluded.ultimo_email_recebido,ultimo_email_enviado=excluded.ultimo_email_enviado,contato_efetivo=excluded.contato_efetivo,origem_contato=excluded.origem_contato,etiquetas=excluded.etiquetas,sync_id=run,atualizado_em=now() WHERE (cs_snapshot.org_id,cs_snapshot.org_nome,cs_snapshot.titulo,cs_snapshot.pipeline_id,cs_snapshot.stage_id,cs_snapshot.owner_id,cs_snapshot.owner_nome,cs_snapshot.status,cs_snapshot.valor,cs_snapshot.perfil_conta,cs_snapshot.ultimo_contato_efetivo,cs_snapshot.ultima_reuniao_cs,cs_snapshot.data_contratacao,cs_snapshot.stage_change_time,cs_snapshot.add_time,cs_snapshot.proxima_atividade_data,cs_snapshot.atividades_vencidas,cs_snapshot.atividades_abertas,cs_snapshot.ultima_atividade_concluida,cs_snapshot.ultimo_email_recebido,cs_snapshot.ultimo_email_enviado,cs_snapshot.contato_efetivo,cs_snapshot.origem_contato,cs_snapshot.etiquetas) IS DISTINCT FROM (excluded.org_id,excluded.org_nome,excluded.titulo,excluded.pipeline_id,excluded.stage_id,excluded.owner_id,excluded.owner_nome,excluded.status,excluded.valor,excluded.perfil_conta,excluded.ultimo_contato_efetivo,excluded.ultima_reuniao_cs,excluded.data_contratacao,excluded.stage_change_time,excluded.add_time,excluded.proxima_atividade_data,excluded.atividades_vencidas,excluded.atividades_abertas,excluded.ultima_atividade_concluida,excluded.ultimo_email_recebido,excluded.ultimo_email_enviado,excluded.contato_efetivo,excluded.origem_contato,excluded.etiquetas);
DELETE FROM public.cs_snapshot s WHERE NOT EXISTS(SELECT 1 FROM novos n WHERE n.deal_id=s.deal_id);
WITH donos AS (SELECT DISTINCT pipeline_id,owner_id FROM public.cs_snapshot), ativos AS (
SELECT pipeline_id,owner_id,coalesce('org:'||org_id::text,'deal:'||deal_id::text) cliente,CASE WHEN pipeline_id=1 THEN 0 ELSE CASE WHEN count(valor)=count(*) THEN sum(valor) ELSE NULL END END receita,max(ultimo_contato_efetivo) contato,sum(atividades_vencidas) vencidas FROM public.cs_snapshot WHERE status='open' AND stage_id NOT IN (105,111) GROUP BY pipeline_id,owner_id,coalesce('org:'||org_id::text,'deal:'||deal_id::text)), totais AS (
SELECT pipeline_id,owner_id,count(*)::integer clientes,CASE WHEN count(receita)=count(*) THEN sum(receita) ELSE NULL END mrr,
count(*) FILTER(WHERE contato BETWEEN dia_local-30 AND dia_local)::numeric / nullif(count(contato),0)*100 c30,
count(*) FILTER(WHERE contato BETWEEN dia_local-60 AND dia_local)::numeric / nullif(count(contato),0)*100 c60,
count(*) FILTER(WHERE contato BETWEEN dia_local-90 AND dia_local)::numeric / nullif(count(contato),0)*100 c90,
count(*) FILTER(WHERE contato<dia_local-60)::integer sem60, count(*) FILTER(WHERE contato IS NULL)::integer semdados, sum(vencidas)::integer vencidas FROM ativos GROUP BY pipeline_id,owner_id), cancel AS (
SELECT pipeline_id,owner_id,count(*)::integer n,CASE WHEN count(valor)=count(*) THEN sum(valor) ELSE NULL END receita FROM public.cs_snapshot WHERE stage_id IN (105,111) AND (stage_change_time AT TIME ZONE 'America/Sao_Paulo')::date=dia_local GROUP BY pipeline_id,owner_id)
INSERT INTO public.cs_metricas_diarias(dia,pipeline_id,owner_id,clientes_ativos,mrr,cobertura_30,cobertura_60,cobertura_90,sem_contato_60,sem_dados_contato,atividades_vencidas,cancelados_dia,mrr_cancelado_dia)
SELECT dia_local,d.pipeline_id,d.owner_id,coalesce(t.clientes,0),CASE WHEN t.clientes IS NULL THEN 0 ELSE t.mrr END,t.c30,t.c60,t.c90,coalesce(t.sem60,0),coalesce(t.semdados,0),coalesce(t.vencidas,0),coalesce(c.n,0),CASE WHEN c.n IS NULL THEN 0 ELSE c.receita END FROM donos d LEFT JOIN totais t USING(pipeline_id,owner_id) LEFT JOIN cancel c USING(pipeline_id,owner_id)
ON CONFLICT(dia,pipeline_id,owner_id) DO UPDATE SET clientes_ativos=excluded.clientes_ativos,mrr=excluded.mrr,cobertura_30=excluded.cobertura_30,cobertura_60=excluded.cobertura_60,cobertura_90=excluded.cobertura_90,sem_contato_60=excluded.sem_contato_60,sem_dados_contato=excluded.sem_dados_contato,atividades_vencidas=excluded.atividades_vencidas,cancelados_dia=excluded.cancelados_dia,mrr_cancelado_dia=excluded.mrr_cancelado_dia;
UPDATE public.cs_sync_runs SET status='sucesso',concluido_em=now(),negocios_lidos=lidos,erro=NULL WHERE id=run;
END $function$;