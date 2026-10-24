ALTER TABLE public.cs_snapshot
 ADD COLUMN IF NOT EXISTS org_nome text,
 ADD COLUMN IF NOT EXISTS ultima_atividade_concluida date,
 ADD COLUMN IF NOT EXISTS ultimo_email_recebido timestamptz,
 ADD COLUMN IF NOT EXISTS ultimo_email_enviado timestamptz,
 ADD COLUMN IF NOT EXISTS atividades_abertas integer NOT NULL DEFAULT 0,
 ADD COLUMN IF NOT EXISTS contato_efetivo date,
 ADD COLUMN IF NOT EXISTS origem_contato text CHECK (origem_contato IN ('campo','reunião','atividade','e-mail'));
ALTER TABLE public.cs_metricas_diarias ADD COLUMN IF NOT EXISTS sem_dados_contato integer NOT NULL DEFAULT 0;
ALTER TABLE public.cs_sync_runs ADD COLUMN IF NOT EXISTS janela text;
CREATE UNIQUE INDEX IF NOT EXISTS cs_sync_runs_janela_unica ON public.cs_sync_runs(janela) WHERE janela IS NOT NULL;

CREATE TABLE public.cs_regras_risco(
 id boolean PRIMARY KEY DEFAULT true CHECK (id),
 dias_atencao integer NOT NULL DEFAULT 45 CHECK (dias_atencao BETWEEN 1 AND 365),
 dias_risco integer NOT NULL DEFAULT 75 CHECK (dias_risco BETWEEN 1 AND 365),
 vencidas_atencao integer NOT NULL DEFAULT 1 CHECK (vencidas_atencao BETWEEN 1 AND 100),
 vencidas_risco integer NOT NULL DEFAULT 3 CHECK (vencidas_risco BETWEEN 1 AND 100),
 considerar_sem_uso_como_risco boolean NOT NULL DEFAULT true,
 retorno_pendente_dias integer NOT NULL DEFAULT 3 CHECK (retorno_pendente_dias BETWEEN 0 AND 60),
 atualizado_por uuid,
 created_at timestamptz NOT NULL DEFAULT now(),
 atualizado_em timestamptz NOT NULL DEFAULT now(),
 CHECK (dias_risco > dias_atencao), CHECK (vencidas_risco >= vencidas_atencao));
GRANT SELECT ON public.cs_regras_risco TO authenticated;
GRANT ALL ON public.cs_regras_risco TO service_role;
ALTER TABLE public.cs_regras_risco ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Contas ativas leem regras de risco" ON public.cs_regras_risco FOR SELECT TO authenticated USING (public.account_active());
INSERT INTO public.cs_regras_risco(id) VALUES (true) ON CONFLICT DO NOTHING;
CREATE TRIGGER cs_regras_risco_atualizado BEFORE UPDATE ON public.cs_regras_risco FOR EACH ROW EXECUTE FUNCTION public.tocar_atualizado_em();

CREATE TABLE public.cs_eventos_valor(
 deal_id bigint NOT NULL, dia date NOT NULL, pipeline_id integer NOT NULL, owner_id integer NOT NULL,
 valor_anterior numeric NOT NULL, valor_novo numeric NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), atualizado_em timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(deal_id,dia));
GRANT SELECT ON public.cs_eventos_valor TO authenticated;
GRANT ALL ON public.cs_eventos_valor TO service_role;
ALTER TABLE public.cs_eventos_valor ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Eventos de valor pelo escopo CS" ON public.cs_eventos_valor FOR SELECT TO authenticated USING (public.cs_pode_ver(owner_id,pipeline_id));
CREATE INDEX cs_eventos_valor_dia ON public.cs_eventos_valor(dia,pipeline_id,owner_id);
CREATE TRIGGER cs_eventos_valor_atualizado BEFORE UPDATE ON public.cs_eventos_valor FOR EACH ROW EXECUTE FUNCTION public.tocar_atualizado_em();

-- Termômetro determinístico por negócio, lendo as regras vigentes.
CREATE OR REPLACE FUNCTION public.cs_avaliar_risco(contato date, vencidas integer, stage integer, proxima date, recebido timestamptz, enviado timestamptz)
RETURNS TABLE(cor text, fatores text[], dias_contato integer, retorno_dias integer)
LANGUAGE plpgsql STABLE SET search_path TO 'public' AS $$
DECLARE g public.cs_regras_risco; hoje date := (now() AT TIME ZONE 'America/Sao_Paulo')::date; dias integer; ret integer; v text[] := '{}'; a text[] := '{}';
BEGIN
 SELECT * INTO g FROM public.cs_regras_risco LIMIT 1;
 IF g.id IS NULL THEN g.dias_atencao:=45; g.dias_risco:=75; g.vencidas_atencao:=1; g.vencidas_risco:=3; g.considerar_sem_uso_como_risco:=true; g.retorno_pendente_dias:=3; END IF;
 dias := CASE WHEN contato IS NULL THEN NULL ELSE hoje-contato END;
 IF recebido IS NOT NULL AND (enviado IS NULL OR recebido>enviado) THEN ret := hoje-(recebido AT TIME ZONE 'America/Sao_Paulo')::date; END IF;
 IF dias IS NOT NULL AND dias>=g.dias_risco THEN v:=v||(dias||' dias sem contato efetivo'); ELSIF dias IS NOT NULL AND dias>=g.dias_atencao THEN a:=a||(dias||' dias sem contato efetivo'); END IF;
 IF vencidas>=g.vencidas_risco THEN v:=v||(vencidas||' atividades vencidas'); ELSIF vencidas>=g.vencidas_atencao THEN a:=a||(vencidas||CASE WHEN vencidas=1 THEN ' atividade vencida' ELSE ' atividades vencidas' END); END IF;
 IF g.considerar_sem_uso_como_risco AND stage IN (104,110) THEN v:=v||'etapa Sem uso'::text; END IF;
 IF ret IS NOT NULL AND ret>g.retorno_pendente_dias THEN v:=v||('cliente aguardando resposta há '||ret||' dias'); ELSIF ret IS NOT NULL THEN a:=a||('cliente aguardando resposta há '||ret||CASE WHEN ret=1 THEN ' dia' ELSE ' dias' END); END IF;
 IF proxima IS NULL THEN a:=a||'sem próxima atividade agendada'::text; END IF;
 IF contato IS NULL THEN
  RETURN QUERY SELECT CASE WHEN cardinality(v)>0 THEN 'vermelho' ELSE 'sem_dados' END, v||a||'sem data de contato em nenhuma fonte'::text, dias, ret; RETURN;
 END IF;
 RETURN QUERY SELECT CASE WHEN cardinality(v)>0 THEN 'vermelho' WHEN cardinality(a)>0 THEN 'amarelo' ELSE 'verde' END, v||a, dias, ret;
END $$;
GRANT EXECUTE ON FUNCTION public.cs_avaliar_risco(date,integer,integer,date,timestamptz,timestamptz) TO authenticated, service_role;

CREATE OR REPLACE VIEW public.cs_snapshot_risco WITH (security_invoker=true) AS
SELECT s.*, CASE WHEN (s.pipeline_id=15 AND s.stage_id<>105 OR s.pipeline_id=16 AND s.stage_id<>111) AND s.status='open' THEN r.cor END AS risco_cor,
 CASE WHEN (s.pipeline_id=15 AND s.stage_id<>105 OR s.pipeline_id=16 AND s.stage_id<>111) AND s.status='open' THEN r.fatores ELSE '{}'::text[] END AS risco_fatores,
 r.dias_contato, r.retorno_dias
FROM public.cs_snapshot s CROSS JOIN LATERAL public.cs_avaliar_risco(s.contato_efetivo,s.atividades_vencidas,s.stage_id,s.proxima_atividade_data,s.ultimo_email_recebido,s.ultimo_email_enviado) r;
GRANT SELECT ON public.cs_snapshot_risco TO authenticated;
GRANT ALL ON public.cs_snapshot_risco TO service_role;

-- Uma tentativa automática por janela; reaproveita as mesmas travas do início manual/agendado.
CREATE OR REPLACE FUNCTION public.cs_iniciar_sync_janela(janela_id text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$ DECLARE run uuid; BEGIN
 PERFORM pg_advisory_xact_lock(841516);
 IF janela_id !~ '^\d{4}-\d{2}-\d{2}-(08|12)$' THEN RAISE EXCEPTION 'Janela inválida'; END IF;
 IF EXISTS(SELECT 1 FROM public.cs_sync_runs WHERE janela=janela_id) THEN RETURN NULL; END IF;
 UPDATE public.cs_sync_runs SET status='falha',concluido_em=now(),erro='Tempo limite excedido; snapshot anterior preservado' WHERE status='executando' AND iniciado_em<now()-interval '30 minutes';
 IF EXISTS(SELECT 1 FROM public.cs_sync_runs WHERE status='executando') THEN RETURN NULL; END IF;
 INSERT INTO public.cs_sync_runs(origem,status,janela) VALUES('agendado','executando',janela_id) RETURNING id INTO run; RETURN run; END $$;
REVOKE ALL ON FUNCTION public.cs_iniciar_sync_janela(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cs_iniciar_sync_janela(text) TO service_role;

CREATE OR REPLACE FUNCTION public.cs_atualizar_regras(regras jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$ BEGIN
 IF NOT public.account_active() OR NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'superadmin') OR public.meu_papel() IN ('gestor','admin')) THEN RAISE EXCEPTION 'Apenas gestores e administradores alteram as regras de risco'; END IF;
 UPDATE public.cs_regras_risco SET dias_atencao=(regras->>'dias_atencao')::int, dias_risco=(regras->>'dias_risco')::int, vencidas_atencao=(regras->>'vencidas_atencao')::int, vencidas_risco=(regras->>'vencidas_risco')::int, considerar_sem_uso_como_risco=(regras->>'considerar_sem_uso_como_risco')::boolean, retorno_pendente_dias=(regras->>'retorno_pendente_dias')::int, atualizado_por=auth.uid() WHERE id;
 INSERT INTO public.audit_log(actor_id,action,details) VALUES(auth.uid(),'cs_regras_risco',regras);
END $$;
REVOKE ALL ON FUNCTION public.cs_atualizar_regras(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cs_atualizar_regras(jsonb) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.cs_publicar_snapshot(run uuid, rows jsonb, lidos integer)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$ DECLARE dia_local date := (now() AT TIME ZONE 'America/Sao_Paulo')::date; BEGIN
PERFORM pg_advisory_xact_lock(841516);
IF NOT EXISTS(SELECT 1 FROM public.cs_sync_runs WHERE id=run AND status='executando' FOR UPDATE) THEN RAISE EXCEPTION 'Atualização não está em execução'; END IF;
IF jsonb_typeof(rows)<>'array' OR lidos<jsonb_array_length(rows) THEN RAISE EXCEPTION 'Snapshot inválido'; END IF;
CREATE TEMP TABLE novos ON COMMIT DROP AS SELECT * FROM jsonb_to_recordset(rows) AS x(deal_id bigint,org_id bigint,org_nome text,titulo text,pipeline_id integer,stage_id integer,owner_id integer,owner_nome text,status text,valor numeric,perfil_conta text,ultimo_contato_efetivo date,ultima_reuniao_cs date,data_contratacao date,stage_change_time timestamptz,add_time timestamptz,proxima_atividade_data date,atividades_vencidas integer,atividades_abertas integer,ultima_atividade_concluida date,ultimo_email_recebido timestamptz,ultimo_email_enviado timestamptz,contato_efetivo date,origem_contato text);
INSERT INTO public.cs_eventos_valor(deal_id,dia,pipeline_id,owner_id,valor_anterior,valor_novo)
SELECT n.deal_id,dia_local,n.pipeline_id,n.owner_id,s.valor,n.valor FROM novos n JOIN public.cs_snapshot s ON s.deal_id=n.deal_id
WHERE n.status='open' AND s.status='open' AND n.pipeline_id=s.pipeline_id AND n.valor IS NOT NULL AND s.valor IS NOT NULL AND n.valor<>s.valor
ON CONFLICT(deal_id,dia) DO UPDATE SET valor_novo=excluded.valor_novo,owner_id=excluded.owner_id;
INSERT INTO public.cs_snapshot(deal_id,org_id,org_nome,titulo,pipeline_id,stage_id,owner_id,owner_nome,status,valor,perfil_conta,ultimo_contato_efetivo,ultima_reuniao_cs,data_contratacao,stage_change_time,add_time,proxima_atividade_data,atividades_vencidas,atividades_abertas,ultima_atividade_concluida,ultimo_email_recebido,ultimo_email_enviado,contato_efetivo,origem_contato,sync_id,atualizado_em)
SELECT x.deal_id,x.org_id,x.org_nome,x.titulo,x.pipeline_id,x.stage_id,x.owner_id,x.owner_nome,x.status,x.valor,x.perfil_conta,x.ultimo_contato_efetivo,x.ultima_reuniao_cs,x.data_contratacao,x.stage_change_time,x.add_time,x.proxima_atividade_data,x.atividades_vencidas,coalesce(x.atividades_abertas,0),x.ultima_atividade_concluida,x.ultimo_email_recebido,x.ultimo_email_enviado,x.contato_efetivo,x.origem_contato,run,now() FROM novos x
ON CONFLICT(deal_id) DO UPDATE SET org_id=excluded.org_id,org_nome=excluded.org_nome,titulo=excluded.titulo,pipeline_id=excluded.pipeline_id,stage_id=excluded.stage_id,owner_id=excluded.owner_id,owner_nome=excluded.owner_nome,status=excluded.status,valor=excluded.valor,perfil_conta=excluded.perfil_conta,ultimo_contato_efetivo=excluded.ultimo_contato_efetivo,ultima_reuniao_cs=excluded.ultima_reuniao_cs,data_contratacao=excluded.data_contratacao,stage_change_time=excluded.stage_change_time,add_time=excluded.add_time,proxima_atividade_data=excluded.proxima_atividade_data,atividades_vencidas=excluded.atividades_vencidas,atividades_abertas=excluded.atividades_abertas,ultima_atividade_concluida=excluded.ultima_atividade_concluida,ultimo_email_recebido=excluded.ultimo_email_recebido,ultimo_email_enviado=excluded.ultimo_email_enviado,contato_efetivo=excluded.contato_efetivo,origem_contato=excluded.origem_contato,sync_id=run,atualizado_em=now();
DELETE FROM public.cs_snapshot WHERE sync_id<>run;
WITH donos AS (SELECT DISTINCT pipeline_id,owner_id FROM public.cs_snapshot), ativos AS (
SELECT pipeline_id,owner_id,coalesce('org:'||org_id::text,'deal:'||deal_id::text) cliente,CASE WHEN pipeline_id=1 THEN 0 ELSE CASE WHEN count(valor)=count(*) THEN sum(valor) ELSE NULL END END receita,max(contato_efetivo) contato,sum(atividades_vencidas) vencidas FROM public.cs_snapshot WHERE status='open' AND stage_id NOT IN (105,111) GROUP BY pipeline_id,owner_id,coalesce('org:'||org_id::text,'deal:'||deal_id::text)), totais AS (
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