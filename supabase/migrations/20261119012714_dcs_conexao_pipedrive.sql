-- Dinamize CS — Central de conexão com o Pipedrive e vínculos de usuários (D40). Aditiva, sem DROP.
-- Arquitetura: conexão institucional única (credencial no n8n) + vínculo de cada colaborador ao seu usuário do Pipedrive.
-- O navegador nunca recebe tokens: testes e atualizações são pedidos em fila e executados pelo n8n.

-- 1. Testes de conexão (pedido pela interface, executado pelo workflow 12; só leituras no Pipedrive).
CREATE TABLE IF NOT EXISTS public.dcs_testes_conexao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitado_por uuid,
  solicitado_em timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','em_execucao','concluido','falha')),
  atendido_em timestamptz,
  concluido_em timestamptz,
  resultado jsonb,
  erro text
);
CREATE UNIQUE INDEX IF NOT EXISTS dcs_teste_um_aberto ON public.dcs_testes_conexao ((true)) WHERE status IN ('pendente','em_execucao');
ALTER TABLE public.dcs_testes_conexao ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS dcs_testes_ler ON public.dcs_testes_conexao;
CREATE POLICY dcs_testes_ler ON public.dcs_testes_conexao FOR SELECT TO authenticated USING (public.dcs_pode('integracoes'));
REVOKE ALL ON public.dcs_testes_conexao FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.dcs_testes_conexao FROM authenticated;

CREATE OR REPLACE FUNCTION public.dcs_solicitar_teste_conexao() RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v uuid; BEGIN
  IF NOT public.dcs_pode('integracoes') THEN RAISE EXCEPTION 'permissão necessária (integracoes)' USING ERRCODE='42501'; END IF;
  SELECT id INTO v FROM public.dcs_testes_conexao WHERE status IN ('pendente','em_execucao');
  IF v IS NOT NULL THEN RETURN v; END IF;
  INSERT INTO public.dcs_testes_conexao(solicitado_por) VALUES (auth.uid()) RETURNING id INTO v;
  PERFORM public.dcs_auditar('integracao', v::text, 'testar_conexao', NULL);
  RETURN v;
END $$;

-- Serviço (n8n): reservar e concluir. Resultado só com rótulos e contagens; o workflow nunca envia tokens.
CREATE OR REPLACE FUNCTION public.dcs_atender_testes_conexao() RETURNS SETOF public.dcs_testes_conexao LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
  UPDATE public.dcs_testes_conexao SET status='falha', erro='Sem retorno do n8n em 15 minutos', concluido_em=now()
   WHERE status='em_execucao' AND atendido_em < now() - interval '15 minutes';
  UPDATE public.dcs_testes_conexao t SET status='em_execucao', atendido_em=now()
   WHERE t.id IN (SELECT id FROM public.dcs_testes_conexao WHERE status='pendente' ORDER BY solicitado_em LIMIT 1 FOR UPDATE SKIP LOCKED)
  RETURNING t.* $$;
CREATE OR REPLACE FUNCTION public.dcs_concluir_teste_conexao(p_id uuid, p_resultado jsonb, p_erro text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF p_resultado IS NOT NULL AND (p_resultado::text ~* '(api_token|access_token|refresh_token|authorization|bearer\s)') THEN
    RAISE EXCEPTION 'Resultado recusado: contém campo de credencial';
  END IF;
  UPDATE public.dcs_testes_conexao
     SET status=CASE WHEN p_erro IS NULL THEN 'concluido' ELSE 'falha' END, resultado=p_resultado, erro=left(p_erro,2000), concluido_em=now()
   WHERE id=p_id AND status='em_execucao';
  INSERT INTO public.dcs_integracao_logs(origem,nivel,mensagem,dados)
  VALUES ('n8n-12', CASE WHEN p_erro IS NULL THEN 'info' ELSE 'erro' END, coalesce(left(p_erro,300),'Teste de conexão concluído'),
          jsonb_build_object('teste',p_id));
END $$;

-- 2. Pedidos de atualização: permissão granular 'integracoes' (antes: perfil admin), mesma fila e idempotência.
CREATE OR REPLACE FUNCTION public.dcs_solicitar_sync(p_tipo text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v uuid; BEGIN
  IF NOT public.dcs_pode('integracoes') THEN RAISE EXCEPTION 'permissão necessária (integracoes)' USING ERRCODE='42501'; END IF;
  IF p_tipo NOT IN ('carteira','cobertura','responsaveis') THEN RAISE EXCEPTION 'Tipo inválido'; END IF;
  SELECT id INTO v FROM public.dcs_solicitacoes_sync WHERE tipo=p_tipo AND status IN ('pendente','em_execucao');
  IF v IS NOT NULL THEN RETURN v; END IF;
  INSERT INTO public.dcs_solicitacoes_sync(tipo,solicitado_por) VALUES (p_tipo,auth.uid()) RETURNING id INTO v;
  PERFORM public.dcs_auditar('sync', v::text, 'solicitar', jsonb_build_object('tipo',p_tipo));
  RETURN v;
END $$;

-- 3. Situação da integração para a central (somente quem tem 'integracoes').
CREATE OR REPLACE FUNCTION public.dcs_status_conexao() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NOT public.dcs_pode('integracoes') THEN RAISE EXCEPTION 'permissão necessária (integracoes)' USING ERRCODE='42501'; END IF;
  RETURN jsonb_build_object(
    'metodo', 'Conexão institucional (credencial da conta Pipedrive da Dinamize guardada no n8n)',
    'escrita_ativa', coalesce((SELECT (valor->>'ativa')::boolean FROM public.dcs_config WHERE chave='pipedrive_escrita'), false),
    'ultimo_teste', (SELECT to_jsonb(t) - 'solicitado_por' FROM public.dcs_testes_conexao t ORDER BY solicitado_em DESC LIMIT 1),
    'sincronizacoes', coalesce((SELECT jsonb_agg(x ORDER BY x->>'tipo') FROM (
        SELECT jsonb_build_object('tipo',tipo,
          'ultimo_status',(array_agg(status ORDER BY iniciado_em DESC))[1],
          'ultima_execucao',max(iniciado_em),
          'ultimo_sucesso',max(concluido_em) FILTER (WHERE status='sucesso'),
          'ultimo_completo',bool_or(completo) FILTER (WHERE status='sucesso' AND iniciado_em > now()-interval '2 days'),
          'falhas_7d',count(*) FILTER (WHERE status='falha' AND iniciado_em > now()-interval '7 days')) x
        FROM public.dcs_sync_execucoes GROUP BY tipo) s), '[]'::jsonb),
    'pedidos_abertos', coalesce((SELECT jsonb_agg(tipo) FROM public.dcs_solicitacoes_sync WHERE status IN ('pendente','em_execucao')), '[]'::jsonb),
    'registros', jsonb_build_object(
      'aguardando_autorizacao', (SELECT count(*) FROM public.dcs_jobs WHERE status='aguardando_autorizacao'),
      'pendentes', (SELECT count(*) FROM public.dcs_jobs WHERE status IN ('pendente','processando')),
      'falha_recuperavel', (SELECT count(*) FROM public.dcs_jobs WHERE status='falha' AND tentativas < 5),
      'falha_definitiva', (SELECT count(*) FROM public.dcs_jobs WHERE status='falha' AND tentativas >= 5),
      'aguardando_conferencia', (SELECT count(*) FROM public.dcs_jobs WHERE status='ambiguo'),
      'confirmados', (SELECT count(*) FROM public.dcs_jobs WHERE status='concluido')),
    'erros_recentes', coalesce((SELECT jsonb_agg(x) FROM (
        SELECT em, origem, left(mensagem,240) mensagem FROM public.dcs_integracao_logs
         WHERE nivel='erro' AND em > now()-interval '30 days' AND origem NOT ILIKE 'Example%'
         ORDER BY em DESC LIMIT 10) x), '[]'::jsonb)
  );
END $$;

-- 4. Vínculos com usuários do Pipedrive: identificador oficial (id), validado pelo e-mail; sem duplicidade nova.
CREATE OR REPLACE FUNCTION public.dcs_metodo_vinculo(p_email_app text, p_email_pd text) RETURNS text LANGUAGE sql IMMUTABLE SET search_path=public AS $$
  SELECT CASE
    WHEN p_email_pd IS NULL OR p_email_app IS NULL THEN 'manual'
    WHEN lower(p_email_app)=lower(p_email_pd) THEN 'email'
    WHEN split_part(lower(p_email_app),'@',1)=split_part(lower(p_email_pd),'@',1)
         AND split_part(lower(p_email_app),'@',2) ~ '^dinamize\.' AND split_part(lower(p_email_pd),'@',2) ~ '^dinamize\.' THEN 'email_dominio'
    ELSE 'manual' END $$;

CREATE OR REPLACE FUNCTION public.dcs_validar_vinculo_pd() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_outro uuid; BEGIN
  IF NEW.pipedrive_user_id IS NULL THEN RETURN NEW; END IF;
  IF TG_OP='UPDATE' AND OLD.pipedrive_user_id IS NOT DISTINCT FROM NEW.pipedrive_user_id THEN RETURN NEW; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.dcs_responsaveis WHERE pipedrive_user_id=NEW.pipedrive_user_id) THEN
    RAISE EXCEPTION 'Usuário do Pipedrive inexistente na última sincronização de responsáveis' USING ERRCODE='22023';
  END IF;
  IF TG_TABLE_NAME='dcs_membros' THEN
    SELECT user_id INTO v_outro FROM public.dcs_membros WHERE pipedrive_user_id=NEW.pipedrive_user_id AND ativo AND user_id<>NEW.user_id LIMIT 1;
  ELSE
    SELECT user_id INTO v_outro FROM public.dcs_membros WHERE pipedrive_user_id=NEW.pipedrive_user_id AND ativo LIMIT 1;
  END IF;
  IF v_outro IS NOT NULL THEN
    -- No 1º acesso o vínculo conflitante é descartado (o acesso não pode falhar por isso); o admin revincula depois.
    IF TG_TABLE_NAME='dcs_membros' AND current_setting('dcs.reivindicando', true)='1' THEN
      NEW.pipedrive_user_id := NULL; RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Este usuário do Pipedrive já está vinculado a outra pessoa no Dinamize CS' USING ERRCODE='23505';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS dcs_membros_vinculo_pd ON public.dcs_membros;
CREATE TRIGGER dcs_membros_vinculo_pd BEFORE INSERT OR UPDATE OF pipedrive_user_id ON public.dcs_membros
  FOR EACH ROW EXECUTE FUNCTION public.dcs_validar_vinculo_pd();
DROP TRIGGER IF EXISTS dcs_pre_vinculo_pd ON public.dcs_pre_cadastros;
CREATE TRIGGER dcs_pre_vinculo_pd BEFORE INSERT OR UPDATE OF pipedrive_user_id ON public.dcs_pre_cadastros
  FOR EACH ROW EXECUTE FUNCTION public.dcs_validar_vinculo_pd();

-- Minha conexão: só os meus dados (e-mail do Pipedrive apenas do meu próprio vínculo).
CREATE OR REPLACE FUNCTION public.dcs_minha_conexao_pipedrive() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE m record; r record; v_email text; BEGIN
  IF public.dcs_perfil() IS NULL THEN RETURN NULL; END IF;
  SELECT * INTO m FROM public.dcs_membros WHERE user_id=auth.uid();
  SELECT email INTO v_email FROM auth.users WHERE id=auth.uid();
  IF m.pipedrive_user_id IS NULL THEN
    RETURN jsonb_build_object('vinculado',false,'conexao','institucional');
  END IF;
  SELECT * INTO r FROM public.dcs_responsaveis WHERE pipedrive_user_id=m.pipedrive_user_id;
  RETURN jsonb_build_object(
    'vinculado', true, 'conexao', 'institucional',
    'pipedrive_user_id', m.pipedrive_user_id, 'nome', r.nome, 'email', r.email,
    'ativo_no_pipedrive', r.ativo, 'visto_em', r.visto_em,
    'metodo', public.dcs_metodo_vinculo(v_email, r.email),
    'compartilhado', EXISTS (SELECT 1 FROM public.dcs_membros x WHERE x.pipedrive_user_id=m.pipedrive_user_id AND x.ativo AND x.user_id<>auth.uid()));
END $$;

-- Vínculos para a gestão de usuários (somente 'usuarios').
CREATE OR REPLACE FUNCTION public.dcs_vinculos_pipedrive() RETURNS TABLE(user_id uuid, pipedrive_user_id integer, nome_pipedrive text, metodo text, compartilhado boolean, ativo_no_pipedrive boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$ BEGIN
  IF NOT public.dcs_pode('usuarios') THEN RAISE EXCEPTION 'permissão necessária (usuarios)' USING ERRCODE='42501'; END IF;
  RETURN QUERY
  SELECT m.user_id, m.pipedrive_user_id, r.nome,
         CASE WHEN m.pipedrive_user_id IS NULL THEN 'sem_vinculo' ELSE public.dcs_metodo_vinculo(u.email, r.email) END,
         m.pipedrive_user_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.dcs_membros x WHERE x.pipedrive_user_id=m.pipedrive_user_id AND x.ativo AND x.user_id<>m.user_id),
         r.ativo
    FROM public.dcs_membros m JOIN auth.users u ON u.id=m.user_id
    LEFT JOIN public.dcs_responsaveis r ON r.pipedrive_user_id=m.pipedrive_user_id;
END $$;

REVOKE ALL ON FUNCTION public.dcs_solicitar_teste_conexao(), public.dcs_status_conexao(), public.dcs_minha_conexao_pipedrive(),
  public.dcs_vinculos_pipedrive(), public.dcs_atender_testes_conexao(), public.dcs_concluir_teste_conexao(uuid,jsonb,text),
  public.dcs_validar_vinculo_pd() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dcs_solicitar_teste_conexao(), public.dcs_status_conexao(), public.dcs_minha_conexao_pipedrive(),
  public.dcs_vinculos_pipedrive() TO authenticated;
REVOKE ALL ON FUNCTION public.dcs_atender_testes_conexao(), public.dcs_concluir_teste_conexao(uuid,jsonb,text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.dcs_atender_testes_conexao(), public.dcs_concluir_teste_conexao(uuid,jsonb,text) TO service_role;
