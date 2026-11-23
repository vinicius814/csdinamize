-- Radar de inteligência (Prioridade 6): expande "Alertas e pendências" com o primeiro sinal
-- cruzando o novo dcs_cancelamentos (Prioridade 5) - cancelamento recente (ultimos 30 dias),
-- visivel so quando o cliente ainda tem linha em dcs_clientes (RLS por carteira exige isso; a
-- maioria dos cancelamentos historicos nao tera linha e fica de fora corretamente, sem erro).
ALTER TABLE public.dcs_alertas DROP CONSTRAINT IF EXISTS dcs_alertas_tipo_check;
ALTER TABLE public.dcs_alertas ADD CONSTRAINT dcs_alertas_tipo_check
  CHECK (tipo IN ('revisao_vencida','acao_atrasada','cobertura_critica','oportunidade_critica','utilizacao_revisao','cancelamento_recente'));

CREATE OR REPLACE FUNCTION public.dcs_atualizar_alertas() RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE hoje date := (now() AT TIME ZONE 'America/Sao_Paulo')::date; lim int; n int; BEGIN
  SELECT coalesce((config->'cov'->>'pendente')::int, 60) INTO lim FROM public.dcs_regras WHERE ativa;
  DELETE FROM public.dcs_alertas WHERE true;  -- pg_safeupdate exige WHERE
  INSERT INTO public.dcs_alertas(tipo,cliente_key,referencia,detalhe)
  SELECT 'revisao_vencida', d.cliente_key, d.id::text, jsonb_build_object('proxima_revisao',d.proxima_revisao,'ciclo',d.ciclo)
    FROM public.dcs_diagnosticos d JOIN public.dcs_clientes c ON c.key=d.cliente_key AND c.ativo
   WHERE d.status='concluido' AND d.proxima_revisao<hoje
     AND NOT EXISTS (SELECT 1 FROM public.dcs_diagnosticos n WHERE n.cliente_key=d.cliente_key AND n.ciclo>d.ciclo)
     AND NOT EXISTS (SELECT 1 FROM public.dcs_utilizacao u WHERE u.cliente_key=d.cliente_key AND u.status='sem_uso')  -- diagnóstico dispensado
  UNION ALL
  SELECT 'acao_atrasada', a.cliente_key, a.id::text, jsonb_build_object('prazo',a.prazo,'prioridade',a.prioridade,'acao',a.acao)
    FROM public.dcs_acoes a JOIN public.dcs_clientes c ON c.key=a.cliente_key AND c.ativo
   WHERE NOT a.obsoleta AND a.status NOT IN ('implementado','nao_aprovado') AND a.prazo<hoje
  UNION ALL
  SELECT 'cobertura_critica', c.key, NULL, jsonb_build_object('data_contato_efetivo',cb.data_contato_efetivo)
    FROM public.dcs_clientes c LEFT JOIN public.dcs_cobertura cb ON cb.key=c.key
   WHERE c.ativo AND cb.key IS NOT NULL AND (cb.data_contato_efetivo IS NULL OR cb.data_contato_efetivo < hoje-lim)
  UNION ALL
  SELECT 'oportunidade_critica', a.cliente_key, a.id::text, jsonb_build_object('acao',a.acao)
    FROM public.dcs_acoes a JOIN public.dcs_clientes c ON c.key=a.cliente_key AND c.ativo
   WHERE NOT a.obsoleta AND a.prioridade='critica' AND a.status NOT IN ('implementado','nao_aprovado')
     AND NOT EXISTS (SELECT 1 FROM public.dcs_utilizacao u WHERE u.cliente_key=a.cliente_key AND u.status='sem_uso')
  UNION ALL
  SELECT 'utilizacao_revisao', u.cliente_key, NULL, jsonb_build_object('proxima_revisao',u.proxima_revisao,'motivo',u.motivo,'responsavel_id',u.responsavel_id)
    FROM public.dcs_utilizacao u JOIN public.dcs_clientes c ON c.key=u.cliente_key AND c.ativo
   WHERE u.status='sem_uso' AND u.proxima_revisao<hoje
  UNION ALL
  SELECT 'cancelamento_recente', cnc.key, cnc.deal_id::text, jsonb_build_object('cancelado_em',cnc.cancelado_em,'motivo',cnc.motivo,'valor',cnc.valor)
    FROM public.dcs_cancelamentos cnc JOIN public.dcs_clientes c ON c.key=cnc.key
   WHERE cnc.cancelado_em >= hoje - 30;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n; END $$;
