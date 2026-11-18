-- Rollback de 20261118144532_dcs_evolucao e 20261118150803_dcs_meu_acesso_pipedrive.
-- ATENÇÃO: remove pré-cadastros e o acompanhamento de contas sem utilização. Faça backup antes:
--   CREATE TABLE backup_dcs_utilizacao AS TABLE public.dcs_utilizacao; (idem eventos e pré-cadastros)
BEGIN;
DROP FUNCTION IF EXISTS public.dcs_transferir_master(uuid), public.dcs_salvar_usuario(text,text,text,boolean,boolean,boolean,boolean,integer[],text[],integer),
  public.dcs_revogar_pre_cadastro(text), public.dcs_registrar_convite(text), public.dcs_reivindicar_acesso(), public.dcs_status_registro(uuid),
  public.dcs_reprocessar_registro(uuid), public.dcs_definir_escrita_pipedrive(boolean), public.dcs_marcar_sem_utilizacao(text,date,boolean,text,text,text,uuid,date,text,integer),
  public.dcs_revisar_utilizacao(text,text,date,text,date), public.dcs_confirmar_utilizacao(text,text), public.dcs_exigir_atuacao(text);
DELETE FROM public.dcs_alertas WHERE tipo='utilizacao_revisao';
ALTER TABLE public.dcs_alertas DROP CONSTRAINT IF EXISTS dcs_alertas_tipo_check;
ALTER TABLE public.dcs_alertas ADD CONSTRAINT dcs_alertas_tipo_check CHECK (tipo IN ('revisao_vencida','acao_atrasada','cobertura_critica','oportunidade_critica'));
DROP TABLE IF EXISTS public.dcs_utilizacao_eventos, public.dcs_utilizacao, public.dcs_pre_cadastros;
DELETE FROM public.dcs_config WHERE chave='master_principal';
-- Definições anteriores
CREATE OR REPLACE FUNCTION public.dcs_atualizar_alertas() RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE hoje date := (now() AT TIME ZONE 'America/Sao_Paulo')::date; lim int; n int; BEGIN
  SELECT coalesce((config->'cov'->>'pendente')::int, 60) INTO lim FROM public.dcs_regras WHERE ativa;
  DELETE FROM public.dcs_alertas WHERE true;  -- pg_safeupdate exige WHERE
  INSERT INTO public.dcs_alertas(tipo,cliente_key,referencia,detalhe)
  SELECT 'revisao_vencida', d.cliente_key, d.id::text, jsonb_build_object('proxima_revisao',d.proxima_revisao,'ciclo',d.ciclo)
    FROM public.dcs_diagnosticos d JOIN public.dcs_clientes c ON c.key=d.cliente_key AND c.ativo
   WHERE d.status='concluido' AND d.proxima_revisao<hoje
     AND NOT EXISTS (SELECT 1 FROM public.dcs_diagnosticos n WHERE n.cliente_key=d.cliente_key AND n.ciclo>d.ciclo)
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
   WHERE NOT a.obsoleta AND a.prioridade='critica' AND a.status NOT IN ('implementado','nao_aprovado');
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n; END $$;
CREATE OR REPLACE FUNCTION public.dcs_concluir_analise(p_id uuid, p_versao integer, p_resumo text, p_derivado jsonb, p_acoes jsonb, p_proxima_revisao date, p_registrar_pipedrive boolean)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE d public.dcs_diagnosticos; c public.dcs_clientes; j uuid; x jsonb; aid uuid; BEGIN
  SELECT * INTO d FROM public.dcs_diagnosticos WHERE id=p_id FOR UPDATE;
  IF d.id IS NULL OR d.status<>'em_analise' THEN RAISE EXCEPTION 'Diagnóstico não está em análise'; END IF;
  IF d.analista_id<>auth.uid() AND NOT public.dcs_eh_admin() THEN RAISE EXCEPTION 'Sem permissão' USING ERRCODE='42501'; END IF;
  IF d.versao<>p_versao THEN RAISE EXCEPTION 'Conflito de edição' USING ERRCODE='40001'; END IF;
  SELECT * INTO c FROM public.dcs_clientes WHERE key=d.cliente_key;
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
    -- Fica 'aguardando_autorizacao' até um admin liberar gravações reais no Pipedrive (settings dcs.pipedrive_escrita).
    INSERT INTO public.dcs_jobs(tipo,chave,payload,status,criado_por)
    VALUES ('pipedrive_atividade_diagnostico', 'DZCS-'||d.cliente_key||'-C'||d.ciclo,
      jsonb_build_object('diagnostico_id',p_id,'deal_id',c.deal_id,'org_id',c.org_id,'person_id',c.person_id,'owner_id',c.owner_id,
        'subject','CS | Diagnóstico de utilização — Dinamize Marketing','resumo',p_resumo,'marca','DZCS-'||d.cliente_key||'-C'||d.ciclo),
      CASE WHEN coalesce((SELECT (valor->>'ativa')::boolean FROM public.dcs_config WHERE chave='pipedrive_escrita'),false) THEN 'pendente' ELSE 'aguardando_autorizacao' END,
      auth.uid())
    ON CONFLICT (chave) DO NOTHING RETURNING id INTO j;
  END IF;
  RETURN j; END $$;
DROP FUNCTION IF EXISTS public.dcs_listar_usuarios();
CREATE FUNCTION public.dcs_listar_usuarios() RETURNS TABLE(user_id uuid, nome text, email text, status text, papel text, ultimo_acesso timestamptz,
  perfil text, financeiro boolean, pode_editar boolean, pode_exportar boolean, ativo boolean, carteiras integer[], clientes text[], modulos text[])
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NOT public.dcs_eh_admin() THEN RAISE EXCEPTION 'Somente administradores' USING ERRCODE='42501'; END IF;
  RETURN QUERY SELECT p.id, p.nome, p.email, coalesce(a.status,'pendente'), coalesce(r.role::text,'user'), a.last_access_at,
    CASE WHEN r.role IN ('superadmin','admin') THEN 'admin' ELSE m.perfil END, coalesce(m.financeiro, r.role IN ('superadmin','admin')),
    coalesce(m.pode_editar, true), coalesce(m.pode_exportar, r.role IN ('superadmin','admin')), coalesce(m.ativo,false) OR r.role IN ('superadmin','admin'),
    coalesce(m.carteiras,'{}'), coalesce(m.clientes,'{}'), m.modulos
  FROM public.profiles p LEFT JOIN public.account_access a ON a.user_id=p.id LEFT JOIN public.user_roles r ON r.user_id=p.id
  LEFT JOIN public.dcs_membros m ON m.user_id=p.id ORDER BY p.nome;
END $$;
GRANT EXECUTE ON FUNCTION public.dcs_listar_usuarios() TO authenticated; REVOKE ALL ON FUNCTION public.dcs_listar_usuarios() FROM PUBLIC, anon;
CREATE OR REPLACE FUNCTION public.dcs_meu_acesso() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT jsonb_build_object('perfil', public.dcs_perfil(), 'master', public.dcs_eh_master(), 'financeiro', coalesce(public.dcs_ve_financeiro(),false),
    'editar', public.dcs_pode_editar(),
    'exportar', CASE WHEN public.dcs_perfil()='admin' THEN true ELSE coalesce((SELECT m.pode_exportar FROM public.dcs_membros m WHERE m.user_id=auth.uid()),false) END,
    'modulos', (SELECT m.modulos FROM public.dcs_membros m WHERE m.user_id=auth.uid())) $$;
DROP FUNCTION IF EXISTS public.dcs_pipedrive_do_usuario(uuid);
COMMIT;
