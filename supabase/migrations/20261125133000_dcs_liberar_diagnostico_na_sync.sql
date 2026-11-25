-- D42 (25/11/2026, autorizado pelo Vinícius): diagnósticos concluídos aguardando envio ao Pipedrive
-- (status='aguardando_autorizacao') passam a ser liberados automaticamente a cada pedido de atualização da
-- carteira (botão "Atualizar carteira" → dcs_solicitar_sync('carteira')), sem exigir a ativação geral do
-- Master (dcs_config.pipedrive_escrita). Escopo: só diagnósticos (pipedrive_atividade_diagnostico); o resumo
-- do plano de ação (pipedrive_atividade_acao) continua exigindo a ativação do Master, como já funcionava.
-- Quem pode clicar no botão é quem já tem a permissão 'integracoes' hoje (sem mudança de permissão).
-- Aditivo: nenhuma tabela/coluna nova, só o comportamento de dcs_solicitar_sync para p_tipo='carteira'.

CREATE OR REPLACE FUNCTION public.dcs_solicitar_sync(p_tipo text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v uuid; n int; BEGIN
  IF NOT public.dcs_pode('integracoes') THEN RAISE EXCEPTION 'permissão necessária (integracoes)' USING ERRCODE='42501'; END IF;
  IF p_tipo NOT IN ('carteira','cobertura','responsaveis') THEN RAISE EXCEPTION 'Tipo inválido'; END IF;
  IF p_tipo='carteira' THEN
    UPDATE public.dcs_jobs SET status='pendente', tentativas=0, proxima_tentativa=now(), erro=NULL, atualizado_em=now()
     WHERE tipo='pipedrive_atividade_diagnostico' AND status='aguardando_autorizacao';
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n>0 THEN PERFORM public.dcs_auditar('job','fila','liberar_por_sync',jsonb_build_object('n',n,'tipo','pipedrive_atividade_diagnostico')); END IF;
  END IF;
  SELECT id INTO v FROM public.dcs_solicitacoes_sync WHERE tipo=p_tipo AND status IN ('pendente','em_execucao');
  IF v IS NOT NULL THEN RETURN v; END IF;
  INSERT INTO public.dcs_solicitacoes_sync(tipo,solicitado_por) VALUES (p_tipo,auth.uid()) RETURNING id INTO v;
  PERFORM public.dcs_auditar('sync', v::text, 'solicitar', jsonb_build_object('tipo',p_tipo));
  RETURN v;
END $$;
