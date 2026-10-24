CREATE OR REPLACE FUNCTION public.cs_avaliar_risco(contato date, vencidas integer, stage integer, proxima date, recebido timestamp with time zone, enviado timestamp with time zone, etiquetas integer[])
 RETURNS TABLE(cor text, fatores text[], dias_contato integer, retorno_dias integer)
 LANGUAGE plpgsql STABLE SET search_path TO 'public'
AS $function$
DECLARE g public.cs_regras_risco; hoje date := (now() AT TIME ZONE 'America/Sao_Paulo')::date; dias integer; ret integer; v text[] := '{}'; a text[] := '{}';
BEGIN
 SELECT * INTO g FROM public.cs_regras_risco LIMIT 1;
 IF g.id IS NULL THEN g.dias_atencao:=45; g.dias_risco:=75; g.considerar_sem_uso_como_risco:=true; g.retorno_pendente_dias:=3; END IF;
 dias := CASE WHEN contato IS NULL THEN NULL ELSE hoje-contato END;
 IF recebido IS NOT NULL AND (enviado IS NULL OR recebido>enviado) THEN ret := hoje-(recebido AT TIME ZONE 'America/Sao_Paulo')::date; END IF;
 IF dias IS NOT NULL AND dias>=g.dias_risco THEN v:=v||(dias||' dias sem contato efetivo'); ELSIF dias IS NOT NULL AND dias>=g.dias_atencao THEN a:=a||(dias||' dias sem contato efetivo'); END IF;
 IF g.considerar_sem_uso_como_risco AND stage IN (104,110) THEN v:=v||'negócio na etapa Sem uso'::text; END IF;
 IF 709 = ANY(coalesce(etiquetas,'{}'::integer[])) THEN v:=v||'etiqueta Risco de Churn no Pipedrive'::text; END IF;
 IF contato IS NULL THEN
  IF cardinality(v)>0 THEN RETURN QUERY SELECT 'vermelho'::text, v||'sem data de contato efetivo no Pipedrive'::text, dias, ret; RETURN; END IF;
  RETURN QUERY SELECT 'sem_dados'::text, '{sem data de contato efetivo no Pipedrive}'::text[], dias, ret; RETURN;
 END IF;
 -- Sem próxima atividade é acompanhamento operacional, nunca fator de risco.
 RETURN QUERY SELECT CASE WHEN cardinality(v)>0 THEN 'vermelho' WHEN cardinality(a)>0 THEN 'amarelo' ELSE 'verde' END, v||a, dias, ret;
END $function$;
UPDATE public.cs_regras_risco SET sem_proxima_atividade_e_atencao=false;