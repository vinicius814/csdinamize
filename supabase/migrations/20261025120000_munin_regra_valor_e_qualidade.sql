-- Munin · auditoria 25/10/2026 · migração incremental e não destrutiva.
-- 1) Reinterpreta, pela regra oficial (Valor do negócio = mensalidade de referência), os eventos já auditados
--    que ficaram pendentes apenas pela exigência antiga do campo "mrr". Nenhum evento é apagado; o motivo registra a reinterpretação.
--    Moeda: o snapshot só guarda valor quando a moeda é BRL; eventos de negócios sem valor BRL continuam pendentes.
UPDATE public.cs_auditoria_eventos e
   SET estado = 'confirmado', mrr_anterior = e.valor_anterior, mrr_posterior = e.valor_posterior, fonte = 'Histórico Valor',
       motivo = 'Aumento do Valor do negócio (mensalidade de referência) em BRL. Reinterpretado pela regra oficial do Valor em 25/10/2026.',
       atualizado_em = now()
 WHERE e.tipo = 'expansao' AND e.estado = 'pendente'
   AND e.motivo LIKE 'Alteração de Valor comprovada diretamente no Pipedrive%'
   AND e.valor_anterior IS NOT NULL AND e.valor_posterior IS NOT NULL
   AND round(e.valor_posterior * 100) > round(e.valor_anterior * 100)
   AND EXISTS (SELECT 1 FROM public.cs_snapshot s WHERE s.deal_id = e.deal_id AND s.valor IS NOT NULL);

UPDATE public.cs_auditoria_eventos e
   SET estado = 'confirmado', mrr_perdido = e.valor_anterior, fonte = 'Histórico status + etapa + Valor',
       motivo = 'Negócio perdido na etapa de cancelamento, sem reversão; Valor no momento do cancelamento. Reinterpretado pela regra oficial do Valor em 25/10/2026.'
                || coalesce(' Motivo: ' || substring(e.motivo FROM 'Motivo: (.*)$'), ''),
       atualizado_em = now()
 WHERE e.tipo = 'cancelamento' AND e.estado = 'pendente'
   AND e.motivo LIKE 'Perda registrada no CRM e conferida no histórico%'
   AND e.valor_anterior IS NOT NULL
   AND EXISTS (SELECT 1 FROM public.cs_snapshot s WHERE s.deal_id = e.deal_id AND s.valor IS NOT NULL);

-- 2) Telemetria da sincronização: modo (incremental/completo) e duração por fase.
ALTER TABLE public.cs_sync_runs ADD COLUMN IF NOT EXISTS modo text;
ALTER TABLE public.cs_sync_runs ADD COLUMN IF NOT EXISTS fases jsonb;

-- 3) Cobertura com numerador explícito (clientes cobertos no mesmo universo de clientes_ativos).
ALTER TABLE public.cs_metricas_diarias ADD COLUMN IF NOT EXISTS cobertos_60 integer;

-- 4) Recuperação histórica em lotes com checkpoint (cursor da API) e escopo.
ALTER TABLE public.cs_historico_execucoes ADD COLUMN IF NOT EXISTS cursor text;
ALTER TABLE public.cs_historico_execucoes ADD COLUMN IF NOT EXISTS ate date;
-- Origem da data de entrada no Onboarding (criação, entrada pelo pipeline ou reabertura), reconstruída do changelog oficial.
ALTER TABLE public.cs_eventos_onboarding ADD COLUMN IF NOT EXISTS entrada_origem text;

-- 5) Publicação: grava cobertos_60 e preserva atividades concluídas (histórico de produtividade/treinamentos).
CREATE OR REPLACE FUNCTION public.cs_publicar_snapshot(run uuid, rows jsonb, lidos integer)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$ DECLARE dia_local date := (now() AT TIME ZONE 'America/Sao_Paulo')::date; BEGIN
PERFORM pg_advisory_xact_lock(841516);
IF NOT EXISTS(SELECT 1 FROM public.cs_sync_runs WHERE id=run AND status='executando' FOR UPDATE) THEN RAISE EXCEPTION 'Atualização não está em execução'; END IF;
IF jsonb_typeof(rows)<>'array' OR lidos<jsonb_array_length(rows) THEN RAISE EXCEPTION 'Snapshot inválido'; END IF;
CREATE TEMP TABLE novos ON COMMIT DROP AS SELECT * FROM jsonb_to_recordset(rows) AS x(deal_id bigint,org_id bigint,org_nome text,titulo text,pipeline_id integer,stage_id integer,owner_id integer,owner_nome text,status text,valor numeric,perfil_conta text,ultimo_contato_efetivo date,ultima_reuniao_cs date,data_contratacao date,stage_change_time timestamptz,add_time timestamptz,proxima_atividade_data date,atividades_vencidas integer,atividades_abertas integer,ultima_atividade_concluida date,ultimo_email_recebido timestamptz,ultimo_email_enviado timestamptz,contato_efetivo date,origem_contato text,etiquetas integer[]); CREATE INDEX ON novos(deal_id); ANALYZE novos;
INSERT INTO public.cs_eventos_valor(deal_id,dia,pipeline_id,owner_id,valor_anterior,valor_novo,origem)
SELECT n.deal_id,dia_local,n.pipeline_id,n.owner_id,s.valor,n.valor,'snapshot' FROM novos n JOIN public.cs_snapshot s ON s.deal_id=n.deal_id
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
count(*) FILTER(WHERE contato BETWEEN dia_local-60 AND dia_local)::integer cob60,
count(*) FILTER(WHERE contato<dia_local-60)::integer sem60, count(*) FILTER(WHERE contato IS NULL)::integer semdados, sum(vencidas)::integer vencidas FROM ativos GROUP BY pipeline_id,owner_id), cancel AS (
SELECT pipeline_id,owner_id,count(*)::integer n,CASE WHEN count(valor)=count(*) THEN sum(valor) ELSE NULL END receita FROM public.cs_snapshot WHERE stage_id IN (105,111) AND (stage_change_time AT TIME ZONE 'America/Sao_Paulo')::date=dia_local GROUP BY pipeline_id,owner_id)
INSERT INTO public.cs_metricas_diarias(dia,pipeline_id,owner_id,clientes_ativos,mrr,cobertura_30,cobertura_60,cobertura_90,cobertos_60,sem_contato_60,sem_dados_contato,atividades_vencidas,cancelados_dia,mrr_cancelado_dia)
SELECT dia_local,d.pipeline_id,d.owner_id,coalesce(t.clientes,0),CASE WHEN t.clientes IS NULL THEN 0 ELSE t.mrr END,t.c30,t.c60,t.c90,coalesce(t.cob60,0),coalesce(t.sem60,0),coalesce(t.semdados,0),coalesce(t.vencidas,0),coalesce(c.n,0),CASE WHEN c.n IS NULL THEN 0 ELSE c.receita END FROM donos d LEFT JOIN totais t USING(pipeline_id,owner_id) LEFT JOIN cancel c USING(pipeline_id,owner_id)
ON CONFLICT(dia,pipeline_id,owner_id) DO UPDATE SET clientes_ativos=excluded.clientes_ativos,mrr=excluded.mrr,cobertura_30=excluded.cobertura_30,cobertura_60=excluded.cobertura_60,cobertura_90=excluded.cobertura_90,cobertos_60=excluded.cobertos_60,sem_contato_60=excluded.sem_contato_60,sem_dados_contato=excluded.sem_dados_contato,atividades_vencidas=excluded.atividades_vencidas,cancelados_dia=excluded.cancelados_dia,mrr_cancelado_dia=excluded.mrr_cancelado_dia;
UPDATE public.cs_sync_runs SET status='sucesso',concluido_em=now(),negocios_lidos=lidos,erro=NULL WHERE id=run;
END $function$;

-- Atividades: abertas são renovadas a cada leitura; concluídas ficam como histórico (produtividade e treinamentos por mês).
CREATE OR REPLACE FUNCTION public.cs_publicar_tudo(run uuid, rows jsonb, atividades jsonb, lidos integer)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$ DECLARE dia_local date := (now() AT TIME ZONE 'America/Sao_Paulo')::date; BEGIN
 IF jsonb_typeof(atividades)<>'array' THEN RAISE EXCEPTION 'Atividades inválidas'; END IF;
 CREATE TEMP TABLE entrada ON COMMIT DROP AS SELECT x.deal_id,x.pipeline_id,x.status,coalesce(x.contato_dominios,'{}'::text[]) d FROM jsonb_to_recordset(rows) x(deal_id bigint,pipeline_id integer,status text,contato_dominios text[]);
 CREATE UNIQUE INDEX ON entrada(deal_id); ANALYZE entrada;
 UPDATE public.cs_eventos_onboarding e SET saiu_em=dia_local, etapa_saida=s.stage_id FROM public.cs_snapshot s WHERE e.deal_id=s.deal_id AND e.saiu_em IS NULL AND s.pipeline_id=1 AND s.status='open' AND NOT EXISTS(SELECT 1 FROM entrada x WHERE x.deal_id=e.deal_id AND x.pipeline_id=1 AND x.status='open');
 PERFORM public.cs_publicar_snapshot(run,rows,lidos);
 WITH dominios AS (SELECT deal_id,d FROM entrada) UPDATE public.cs_snapshot s SET contato_dominios=t.d FROM dominios t WHERE t.deal_id=s.deal_id AND s.contato_dominios IS DISTINCT FROM t.d;
 INSERT INTO public.cs_eventos_onboarding(deal_id,org_id,owner_id,entrou_em) SELECT deal_id,org_id,owner_id,coalesce(data_contratacao,(add_time AT TIME ZONE 'America/Sao_Paulo')::date) FROM public.cs_snapshot WHERE pipeline_id=1 AND status='open' ON CONFLICT(deal_id) DO UPDATE SET owner_id=excluded.owner_id,org_id=excluded.org_id,saiu_em=NULL,etapa_saida=NULL;
 INSERT INTO public.cs_atividades_cache(activity_id,deal_id,pipeline_id,owner_id,tipo,assunto,inicio,dia,fim,concluida,sync_id,data_conclusao)
 SELECT x.activity_id,x.deal_id,s.pipeline_id,x.owner_id,x.tipo,x.assunto,x.inicio,x.dia,x.fim,x.concluida,run,x.data_conclusao FROM jsonb_to_recordset(atividades) x(activity_id bigint,deal_id bigint,owner_id integer,tipo text,assunto text,inicio timestamptz,dia date,fim timestamptz,concluida boolean,data_conclusao date) JOIN public.cs_snapshot s ON s.deal_id=x.deal_id
 ON CONFLICT(activity_id) DO UPDATE SET deal_id=excluded.deal_id,pipeline_id=excluded.pipeline_id,owner_id=excluded.owner_id,tipo=excluded.tipo,assunto=excluded.assunto,inicio=excluded.inicio,dia=excluded.dia,fim=excluded.fim,concluida=excluded.concluida,sync_id=run,data_conclusao=excluded.data_conclusao,atualizado_em=now();
 DELETE FROM public.cs_atividades_cache WHERE sync_id<>run AND NOT concluida;
 DELETE FROM public.cs_base_diaria WHERE dia=dia_local;
 INSERT INTO public.cs_base_diaria(dia,pipeline_id,cliente,owner_id,mrr) SELECT DISTINCT ON (pipeline_id,cliente) dia_local,pipeline_id,cliente,owner_id,sum(valor) OVER (PARTITION BY pipeline_id,cliente) FROM (SELECT pipeline_id,coalesce('org:'||org_id::text,'deal:'||deal_id::text) cliente,owner_id,valor FROM public.cs_snapshot WHERE status='open' AND pipeline_id IN (15,16) AND stage_id NOT IN (105,111)) b ORDER BY pipeline_id,cliente,valor DESC NULLS LAST;
END $function$;

-- Histórico de atividades concluídas recuperado em lotes (somente negócios presentes no snapshot central).
CREATE OR REPLACE FUNCTION public.cs_publicar_atividades_historicas(run uuid, atividades jsonb)
 RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$ DECLARE n integer; BEGIN
 IF jsonb_typeof(atividades)<>'array' THEN RAISE EXCEPTION 'Atividades inválidas'; END IF;
 INSERT INTO public.cs_atividades_cache(activity_id,deal_id,pipeline_id,owner_id,tipo,assunto,inicio,dia,fim,concluida,sync_id,data_conclusao)
 SELECT x.activity_id,x.deal_id,s.pipeline_id,x.owner_id,x.tipo,x.assunto,x.inicio,x.dia,x.fim,true,run,x.data_conclusao FROM jsonb_to_recordset(atividades) x(activity_id bigint,deal_id bigint,owner_id integer,tipo text,assunto text,inicio timestamptz,dia date,fim timestamptz,concluida boolean,data_conclusao date) JOIN public.cs_snapshot s ON s.deal_id=x.deal_id
 WHERE x.concluida AND x.data_conclusao IS NOT NULL
 ON CONFLICT(activity_id) DO UPDATE SET deal_id=excluded.deal_id,pipeline_id=excluded.pipeline_id,owner_id=excluded.owner_id,tipo=excluded.tipo,assunto=excluded.assunto,inicio=excluded.inicio,dia=excluded.dia,fim=excluded.fim,concluida=true,data_conclusao=excluded.data_conclusao,atualizado_em=now();
 GET DIAGNOSTICS n = ROW_COUNT; RETURN n;
END $function$;
REVOKE ALL ON FUNCTION public.cs_publicar_atividades_historicas(uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cs_publicar_atividades_historicas(uuid, jsonb) TO service_role;
