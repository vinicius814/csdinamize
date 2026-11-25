-- Implementa as correções #1 e #2 da auditoria de integração Pipedrive (docs/PIPEDRIVE_INTEGRATION_AUDIT.md),
-- autorizadas pelo usuário em 25/11/2026 ("pode implementar"). Mudança aditiva: novo tipo de job dentro do
-- MESMO padrão de fila + autorização já existente (sem habilitar escrita real no Pipedrive — dcs_config.
-- pipedrive_escrita.ativa permanece false) e um campo de link de volta ao Dinamize CS na nota.
--
-- A correção #3 da auditoria (reenvio em revisão) já estava implementada desde 20261118144532_dcs_evolucao.sql
-- (dcs_concluir_analise já faz UPSERT no job por chave, inclusive reabrindo um job já 'concluido'); a
-- auditoria havia avaliado apenas a versão original da função. Nada a fazer aqui além de registrar a correção
-- em docs/PIPEDRIVE_INTEGRATION_AUDIT.md.

ALTER TABLE public.dcs_jobs DROP CONSTRAINT dcs_jobs_tipo_check;
ALTER TABLE public.dcs_jobs ADD CONSTRAINT dcs_jobs_tipo_check
  CHECK (tipo IN ('pipedrive_atividade_diagnostico','pipedrive_atividade_acao','mensagem_ia'));

-- URL base do app, para montar o link de volta ao diagnóstico/plano na nota do Pipedrive (admin pode alterar).
INSERT INTO public.dcs_config(chave,valor) VALUES ('app_url','{"base":"https://csdinamize.lovable.app"}')
ON CONFLICT (chave) DO NOTHING;

CREATE OR REPLACE FUNCTION public.dcs_concluir_analise(p_id uuid, p_versao integer, p_resumo text, p_derivado jsonb, p_acoes jsonb, p_proxima_revisao date, p_registrar_pipedrive boolean)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE d public.dcs_diagnosticos; c public.dcs_clientes; j uuid; x jsonb; aid uuid; ativa boolean; payload jsonb; base_url text; resumo_acoes jsonb; BEGIN
  SELECT * INTO d FROM public.dcs_diagnosticos WHERE id=p_id FOR UPDATE;
  IF d.id IS NULL OR d.status<>'em_analise' THEN RAISE EXCEPTION 'Diagnóstico não está em análise'; END IF;
  IF d.analista_id<>auth.uid() AND NOT public.dcs_eh_admin() THEN RAISE EXCEPTION 'Sem permissão' USING ERRCODE='42501'; END IF;
  IF d.versao<>p_versao THEN RAISE EXCEPTION 'Conflito de edição' USING ERRCODE='40001'; END IF;
  SELECT * INTO c FROM public.dcs_clientes WHERE key=d.cliente_key;
  base_url := coalesce((SELECT valor->>'base' FROM public.dcs_config WHERE chave='app_url'), 'https://csdinamize.lovable.app');
  UPDATE public.dcs_diagnosticos SET status='concluido', concluido_em=now(), resumo=p_resumo, derivado=p_derivado,
    indice=nullif(p_derivado->>'score','')::int, completude=nullif(p_derivado->>'completion','')::int,
    proxima_revisao=p_proxima_revisao, versao=versao+1 WHERE id=p_id;
  FOR x IN SELECT * FROM jsonb_array_elements(coalesce(p_acoes,'[]')) LOOP
    INSERT INTO public.dcs_acoes AS t(cliente_key,rec_id,categoria,problema,acao,beneficio,prioridade,complexidade,quem,ganho_rapido,status,prazo,observacoes,manual,obsoleta,obsoleta_em,reincidencias,primeiro_ciclo,ultimo_ciclo)
    VALUES (d.cliente_key, x->>'rec_id', x->>'categoria', x->>'problema', x->>'acao', x->>'beneficio', x->>'prioridade', x->>'complexidade', x->>'quem',
      coalesce((x->>'ganho_rapido')::boolean,false), coalesce(x->>'status','aguardando_contato'), nullif(x->>'prazo','')::date, x->>'observacoes',
      coalesce((x->>'manual')::boolean,false), coalesce((x->>'obsoleta')::boolean,false), nullif(x->>'obsoleta_em','')::date,
      coalesce((x->>'reincidencias')::int,0), (x->>'primeiro_ciclo')::int, (x->>'ultimo_ciclo')::int)
    ON CONFLICT (cliente_key,rec_id) DO UPDATE SET categoria=excluded.categoria, problema=excluded.problema, acao=excluded.acao, beneficio=excluded.beneficio,
      prioridade=excluded.prioridade, complexidade=excluded.complexidade, quem=excluded.quem, ganho_rapido=excluded.ganho_rapido, status=excluded.status,
      prazo=excluded.prazo, observacoes=excluded.observacoes, obsoleta=excluded.obsoleta, obsoleta_em=excluded.obsoleta_em,
      reincidencias=excluded.reincidencias, ultimo_ciclo=excluded.ultimo_ciclo, versao=t.versao+1, atualizado_em=now()
    RETURNING id INTO aid;
    INSERT INTO public.dcs_acoes_eventos(acao_id,ator,tipo,dados) VALUES (aid,auth.uid(),'ciclo',jsonb_build_object('ciclo',d.ciclo,'status',x->>'status','obsoleta',x->'obsoleta'));
  END LOOP;
  INSERT INTO public.dcs_diagnosticos_eventos(diagnostico_id,ator,tipo,dados) VALUES (p_id,auth.uid(),'concluir',jsonb_build_object('indice',p_derivado->'score','proxima_revisao',p_proxima_revisao));
  IF p_registrar_pipedrive THEN
    ativa := coalesce((SELECT (valor->>'ativa')::boolean FROM public.dcs_config WHERE chave='pipedrive_escrita'),false);
    payload := jsonb_build_object('diagnostico_id',p_id,'deal_id',c.deal_id,'org_id',c.org_id,'person_id',c.person_id,'owner_id',c.owner_id,
        'user_id',public.dcs_pipedrive_do_usuario(d.analista_id),'ciclo',d.ciclo,'cliente',c.nome,
        'subject','CS | Diagnóstico de utilização — Dinamize Marketing','resumo',p_resumo,'marca','DZCS-'||d.cliente_key||'-C'||d.ciclo,
        'link',base_url||'/dcs/cliente/'||d.cliente_key,
        'data',(now() AT TIME ZONE 'America/Sao_Paulo')::date);
    -- Uma atividade por cliente e ciclo (chave única). Reconclusão: atualiza o relatório; se já registrado (até
    -- 'concluido'), a atividade existente é reaberta para reenvio (correção #3, implementada desde 18/11).
    INSERT INTO public.dcs_jobs AS t(tipo,chave,payload,status,criado_por)
    VALUES ('pipedrive_atividade_diagnostico', 'DZCS-'||d.cliente_key||'-C'||d.ciclo, payload, CASE WHEN ativa THEN 'pendente' ELSE 'aguardando_autorizacao' END, auth.uid())
    ON CONFLICT (chave) DO UPDATE SET payload=excluded.payload,
      status=CASE WHEN t.status='processando' THEN t.status WHEN ativa THEN 'pendente' ELSE 'aguardando_autorizacao' END,
      tentativas=CASE WHEN t.status='processando' THEN t.tentativas ELSE 0 END, proxima_tentativa=now(), erro=NULL, atualizado_em=now()
    RETURNING id INTO j;

    -- Correção #1 da auditoria: resumo consolidado do plano de ação (não uma nota por ação individual — ver
    -- docs/PIPEDRIVE_INTEGRATION_AUDIT.md seção H). Um único registro por cliente (não por ciclo), atualizado
    -- a cada conclusão/revisão de diagnóstico. Nasce com o mesmo gate (pipedrive_escrita.ativa); nenhuma
    -- escrita real é habilitada por esta migration.
    SELECT jsonb_build_object(
      'total', count(*) FILTER (WHERE NOT obsoleta AND status<>'implementado'),
      'criticas', count(*) FILTER (WHERE NOT obsoleta AND status<>'implementado' AND prioridade='critica'),
      'implementadas', count(*) FILTER (WHERE status='implementado'),
      'atrasadas', count(*) FILTER (WHERE NOT obsoleta AND status NOT IN ('implementado','nao_aprovado') AND prazo < (now() AT TIME ZONE 'America/Sao_Paulo')::date)
    ) INTO resumo_acoes FROM public.dcs_acoes WHERE cliente_key=d.cliente_key;

    INSERT INTO public.dcs_jobs AS t(tipo,chave,payload,status,criado_por)
    VALUES ('pipedrive_atividade_acao', 'DZCS-ACOES-'||d.cliente_key,
      jsonb_build_object('deal_id',c.deal_id,'org_id',c.org_id,'person_id',c.person_id,'cliente',c.nome,
        'subject','CS | Plano de ação — Dinamize Marketing', 'marca','DZCS-ACOES-'||d.cliente_key,
        'link',base_url||'/dcs/cliente/'||d.cliente_key, 'data',(now() AT TIME ZONE 'America/Sao_Paulo')::date)
        || resumo_acoes,
      CASE WHEN ativa THEN 'pendente' ELSE 'aguardando_autorizacao' END, auth.uid())
    ON CONFLICT (chave) DO UPDATE SET payload=excluded.payload,
      status=CASE WHEN t.status='processando' THEN t.status WHEN ativa THEN 'pendente' ELSE 'aguardando_autorizacao' END,
      tentativas=CASE WHEN t.status='processando' THEN t.tentativas ELSE 0 END, proxima_tentativa=now(), erro=NULL, atualizado_em=now();
  END IF;
  RETURN j; END $$;

-- dcs_reprocessar_registro passa a reprocessar também o resumo do plano de ação do mesmo cliente.
CREATE OR REPLACE FUNCTION public.dcs_reprocessar_registro(p_diag uuid) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE d public.dcs_diagnosticos; ativa boolean; n int; BEGIN
  SELECT * INTO d FROM public.dcs_diagnosticos WHERE id=p_diag;
  IF d.id IS NULL OR (d.analista_id<>auth.uid() AND NOT public.dcs_eh_admin()) THEN RAISE EXCEPTION 'Sem permissão' USING ERRCODE='42501'; END IF;
  ativa := coalesce((SELECT (valor->>'ativa')::boolean FROM public.dcs_config WHERE chave='pipedrive_escrita'),false);
  UPDATE public.dcs_jobs SET status=CASE WHEN ativa THEN 'pendente' ELSE 'aguardando_autorizacao' END, tentativas=0, proxima_tentativa=now(), erro=NULL, atualizado_em=now()
   WHERE chave IN ('DZCS-'||d.cliente_key||'-C'||d.ciclo, 'DZCS-ACOES-'||d.cliente_key) AND status IN ('falha','ambiguo','aguardando_autorizacao');
  GET DIAGNOSTICS n = ROW_COUNT;
  PERFORM public.dcs_auditar('job', 'DZCS-'||d.cliente_key||'-C'||d.ciclo, 'reprocessar', jsonb_build_object('ativa',ativa));
  RETURN CASE WHEN n=0 THEN 'nada' WHEN ativa THEN 'pendente' ELSE 'aguardando_autorizacao' END;
END $$;
