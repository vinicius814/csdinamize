ALTER TABLE public.cs_regras_risco
 ADD COLUMN IF NOT EXISTS sem_proxima_atividade_e_atencao boolean NOT NULL DEFAULT true,
 ADD COLUMN IF NOT EXISTS analista_aguardando_dias integer NOT NULL DEFAULT 7 CHECK (analista_aguardando_dias BETWEEN 1 AND 90),
 ADD COLUMN IF NOT EXISTS prazo_onboarding_dias integer NOT NULL DEFAULT 30 CHECK (prazo_onboarding_dias BETWEEN 1 AND 365),
 ADD COLUMN IF NOT EXISTS prazo_por_etapa_dias integer NOT NULL DEFAULT 10 CHECK (prazo_por_etapa_dias BETWEEN 1 AND 365);
ALTER TABLE public.cs_snapshot ADD COLUMN IF NOT EXISTS contato_dominios text[] NOT NULL DEFAULT '{}';

CREATE TABLE public.cs_atividades_cache(
 activity_id bigint PRIMARY KEY, deal_id bigint NOT NULL, pipeline_id integer NOT NULL, owner_id integer NOT NULL,
 tipo text NOT NULL, assunto text NOT NULL, inicio timestamptz, dia date, fim timestamptz, concluida boolean NOT NULL,
 sync_id uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), atualizado_em timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.cs_atividades_cache TO authenticated; GRANT ALL ON public.cs_atividades_cache TO service_role;
ALTER TABLE public.cs_atividades_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Atividades pelo escopo CS" ON public.cs_atividades_cache FOR SELECT TO authenticated USING (public.cs_pode_ver(owner_id,pipeline_id));
CREATE INDEX cs_atividades_cache_dia ON public.cs_atividades_cache(dia,owner_id); CREATE INDEX cs_atividades_cache_deal ON public.cs_atividades_cache(deal_id);

CREATE TABLE public.cs_base_diaria(
 dia date NOT NULL, pipeline_id integer NOT NULL, cliente text NOT NULL, owner_id integer NOT NULL, mrr numeric,
 created_at timestamptz NOT NULL DEFAULT now(), atualizado_em timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(dia,pipeline_id,cliente));
GRANT SELECT ON public.cs_base_diaria TO authenticated; GRANT ALL ON public.cs_base_diaria TO service_role;
ALTER TABLE public.cs_base_diaria ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Base diária pelo escopo CS" ON public.cs_base_diaria FOR SELECT TO authenticated USING (public.cs_pode_ver(owner_id,pipeline_id));

CREATE TABLE public.cs_eventos_onboarding(
 deal_id bigint PRIMARY KEY, org_id bigint, owner_id integer NOT NULL, pipeline_id integer NOT NULL DEFAULT 1,
 entrou_em date, saiu_em date, etapa_saida integer, created_at timestamptz NOT NULL DEFAULT now(), atualizado_em timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.cs_eventos_onboarding TO authenticated; GRANT ALL ON public.cs_eventos_onboarding TO service_role;
ALTER TABLE public.cs_eventos_onboarding ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Onboarding pelo escopo CS" ON public.cs_eventos_onboarding FOR SELECT TO authenticated USING (public.cs_pode_ver(owner_id,pipeline_id));
CREATE TRIGGER cs_eventos_onboarding_atualizado BEFORE UPDATE ON public.cs_eventos_onboarding FOR EACH ROW EXECUTE FUNCTION public.tocar_atualizado_em();

CREATE OR REPLACE FUNCTION public.cs_avaliar_risco(contato date, vencidas integer, stage integer, proxima date, recebido timestamptz, enviado timestamptz)
RETURNS TABLE(cor text, fatores text[], dias_contato integer, retorno_dias integer)
LANGUAGE plpgsql STABLE SET search_path TO 'public' AS $$
DECLARE g public.cs_regras_risco; hoje date := (now() AT TIME ZONE 'America/Sao_Paulo')::date; dias integer; ret integer; v text[] := '{}'; a text[] := '{}';
BEGIN
 SELECT * INTO g FROM public.cs_regras_risco LIMIT 1;
 IF g.id IS NULL THEN g.dias_atencao:=45; g.dias_risco:=75; g.vencidas_atencao:=1; g.vencidas_risco:=3; g.considerar_sem_uso_como_risco:=true; g.retorno_pendente_dias:=3; g.sem_proxima_atividade_e_atencao:=true; END IF;
 dias := CASE WHEN contato IS NULL THEN NULL ELSE hoje-contato END;
 IF recebido IS NOT NULL AND (enviado IS NULL OR recebido>enviado) THEN ret := hoje-(recebido AT TIME ZONE 'America/Sao_Paulo')::date; END IF;
 IF dias IS NOT NULL AND dias>=g.dias_risco THEN v:=v||(dias||' dias sem contato efetivo'); ELSIF dias IS NOT NULL AND dias>=g.dias_atencao THEN a:=a||(dias||' dias sem contato efetivo'); END IF;
 IF vencidas>=g.vencidas_risco THEN v:=v||(vencidas||' atividades vencidas'); ELSIF vencidas>=g.vencidas_atencao THEN a:=a||(vencidas||CASE WHEN vencidas=1 THEN ' atividade vencida' ELSE ' atividades vencidas' END); END IF;
 IF g.considerar_sem_uso_como_risco AND stage IN (104,110) THEN v:=v||'etapa Sem uso'::text; END IF;
 IF ret IS NOT NULL AND ret>g.retorno_pendente_dias THEN v:=v||('cliente aguardando resposta há '||ret||' dias'); ELSIF ret IS NOT NULL THEN a:=a||('cliente aguardando resposta há '||ret||CASE WHEN ret=1 THEN ' dia' ELSE ' dias' END); END IF;
 IF proxima IS NULL AND g.sem_proxima_atividade_e_atencao THEN a:=a||'sem próxima atividade agendada'::text; END IF;
 IF contato IS NULL THEN
  RETURN QUERY SELECT CASE WHEN cardinality(v)>0 THEN 'vermelho' ELSE 'sem_dados' END, v||a||'sem data de contato em nenhuma fonte'::text, dias, ret; RETURN;
 END IF;
 RETURN QUERY SELECT CASE WHEN cardinality(v)>0 THEN 'vermelho' WHEN cardinality(a)>0 THEN 'amarelo' ELSE 'verde' END, v||a, dias, ret;
END $$;

CREATE OR REPLACE VIEW public.cs_snapshot_risco WITH (security_invoker=true) AS
SELECT s.deal_id,s.org_id,s.titulo,s.pipeline_id,s.stage_id,s.owner_id,s.owner_nome,s.status,s.valor,s.perfil_conta,s.ultimo_contato_efetivo,s.ultima_reuniao_cs,s.data_contratacao,s.stage_change_time,s.add_time,s.proxima_atividade_data,s.atividades_vencidas,s.sync_id,s.atualizado_em,s.created_at,s.updated_at,s.org_nome,s.ultima_atividade_concluida,s.ultimo_email_recebido,s.ultimo_email_enviado,s.atividades_abertas,s.contato_efetivo,s.origem_contato,
 CASE WHEN (s.pipeline_id=15 AND s.stage_id<>105 OR s.pipeline_id=16 AND s.stage_id<>111) AND s.status='open' THEN r.cor END AS risco_cor,
 CASE WHEN (s.pipeline_id=15 AND s.stage_id<>105 OR s.pipeline_id=16 AND s.stage_id<>111) AND s.status='open' THEN r.fatores ELSE '{}'::text[] END AS risco_fatores,
 r.dias_contato, r.retorno_dias,
 CASE WHEN s.ultimo_email_recebido IS NULL AND s.ultimo_email_enviado IS NULL THEN 'sem_email'
  WHEN s.ultimo_email_recebido IS NOT NULL AND (s.ultimo_email_enviado IS NULL OR s.ultimo_email_recebido>s.ultimo_email_enviado) AND r.retorno_dias>g.retorno_pendente_dias THEN 'aguardando_resposta'
  WHEN s.ultimo_email_enviado IS NOT NULL AND (s.ultimo_email_recebido IS NULL OR s.ultimo_email_enviado>s.ultimo_email_recebido) AND (now() AT TIME ZONE 'America/Sao_Paulo')::date-(s.ultimo_email_enviado AT TIME ZONE 'America/Sao_Paulo')::date>g.analista_aguardando_dias THEN 'analista_aguardando'
  WHEN greatest(s.ultimo_email_recebido,s.ultimo_email_enviado)>=now()-interval '60 days' THEN 'em_dia'
  ELSE 'sem_email_recente' END AS email_status,
 (now() AT TIME ZONE 'America/Sao_Paulo')::date-(s.ultimo_email_enviado AT TIME ZONE 'America/Sao_Paulo')::date AS dias_desde_envio
FROM public.cs_snapshot s CROSS JOIN LATERAL public.cs_avaliar_risco(s.contato_efetivo,s.atividades_vencidas,s.stage_id,s.proxima_atividade_data,s.ultimo_email_recebido,s.ultimo_email_enviado) r
LEFT JOIN public.cs_regras_risco g ON g.id;

CREATE OR REPLACE FUNCTION public.cs_atualizar_regras_por(actor uuid, regras jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.account_access a JOIN public.profiles p ON p.id=a.user_id LEFT JOIN public.user_roles r ON r.user_id=p.id WHERE p.id=actor AND a.status='ativo' AND a.terms_accepted_at IS NOT NULL AND (r.role IN ('admin','superadmin') OR p.papel IN ('gestor','admin'))) THEN RAISE EXCEPTION 'Apenas gestores e administradores alteram as regras de risco'; END IF;
 UPDATE public.cs_regras_risco SET dias_atencao=(regras->>'dias_atencao')::int, dias_risco=(regras->>'dias_risco')::int, vencidas_atencao=(regras->>'vencidas_atencao')::int, vencidas_risco=(regras->>'vencidas_risco')::int, considerar_sem_uso_como_risco=(regras->>'considerar_sem_uso_como_risco')::boolean, retorno_pendente_dias=(regras->>'retorno_pendente_dias')::int,
  sem_proxima_atividade_e_atencao=coalesce((regras->>'sem_proxima_atividade_e_atencao')::boolean,sem_proxima_atividade_e_atencao), analista_aguardando_dias=coalesce((regras->>'analista_aguardando_dias')::int,analista_aguardando_dias), prazo_onboarding_dias=coalesce((regras->>'prazo_onboarding_dias')::int,prazo_onboarding_dias), prazo_por_etapa_dias=coalesce((regras->>'prazo_por_etapa_dias')::int,prazo_por_etapa_dias), atualizado_por=actor WHERE id;
 INSERT INTO public.audit_log(actor_id,action,details) VALUES(actor,'cs_regras_risco',regras);
END $$;

-- Publishes activities, onboarding history and the daily client base together with the snapshot, in one transaction.
CREATE OR REPLACE FUNCTION public.cs_publicar_tudo(run uuid, rows jsonb, atividades jsonb, lidos integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$ DECLARE dia_local date := (now() AT TIME ZONE 'America/Sao_Paulo')::date; BEGIN
 IF jsonb_typeof(atividades)<>'array' THEN RAISE EXCEPTION 'Atividades inválidas'; END IF;
 -- Onboarding exits: deals that were open in pipeline 1 and no longer are.
 UPDATE public.cs_eventos_onboarding e SET saiu_em=dia_local, etapa_saida=s.stage_id
 FROM public.cs_snapshot s WHERE e.deal_id=s.deal_id AND e.saiu_em IS NULL AND s.pipeline_id=1 AND s.status='open'
  AND NOT EXISTS(SELECT 1 FROM jsonb_to_recordset(rows) x(deal_id bigint,pipeline_id integer,status text) WHERE x.deal_id=e.deal_id AND x.pipeline_id=1 AND x.status='open');
 PERFORM public.cs_publicar_snapshot(run,rows,lidos);
 UPDATE public.cs_snapshot s SET contato_dominios=coalesce((SELECT array(SELECT jsonb_array_elements_text(x->'contato_dominios')) FROM jsonb_array_elements(rows) x WHERE (x->>'deal_id')::bigint=s.deal_id LIMIT 1),'{}');
 INSERT INTO public.cs_eventos_onboarding(deal_id,org_id,owner_id,entrou_em)
 SELECT deal_id,org_id,owner_id,coalesce(data_contratacao,(add_time AT TIME ZONE 'America/Sao_Paulo')::date) FROM public.cs_snapshot WHERE pipeline_id=1 AND status='open'
 ON CONFLICT(deal_id) DO UPDATE SET owner_id=excluded.owner_id, org_id=excluded.org_id, saiu_em=CASE WHEN cs_eventos_onboarding.saiu_em IS NOT NULL THEN NULL ELSE cs_eventos_onboarding.saiu_em END, etapa_saida=CASE WHEN cs_eventos_onboarding.saiu_em IS NOT NULL THEN NULL ELSE cs_eventos_onboarding.etapa_saida END;
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
REVOKE ALL ON FUNCTION public.cs_publicar_tudo(uuid,jsonb,jsonb,integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cs_publicar_tudo(uuid,jsonb,jsonb,integer) TO service_role;