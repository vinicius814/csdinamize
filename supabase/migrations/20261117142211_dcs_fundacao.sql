-- Dinamize CS — Fase 1: fundação do banco (aditiva). Não altera nem remove estruturas do Munin.
-- Rollback: supabase/rollback/20261116230000_dcs_fundacao.down.sql
-- Convenções: prefixo dcs_; RLS em todas as tabelas; escrita só por funções SECURITY DEFINER validadas;
-- dados financeiros em tabela separada; regras versionadas; histórico append-only.

-- ===================== Acesso =====================
CREATE TABLE public.dcs_membros (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  perfil text NOT NULL CHECK (perfil IN ('admin','cs','contas')),
  financeiro boolean NOT NULL DEFAULT false,
  ativo boolean NOT NULL DEFAULT true,
  carteiras integer[] NOT NULL DEFAULT '{}',   -- owner_id do Pipedrive
  clientes text[] NOT NULL DEFAULT '{}',       -- dcs_clientes.key
  modulos text[],                              -- null = padrão do perfil
  pipedrive_user_id integer,
  convidado_por uuid REFERENCES public.profiles(id),
  convite_expira_em timestamptz,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.dcs_membros ENABLE ROW LEVEL SECURITY;

-- Conta ativa no Munin + membro ativo do Dinamize CS (superadmin/admin do Munin herdam admin).
CREATE OR REPLACE FUNCTION public.dcs_perfil() RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT CASE
    WHEN NOT EXISTS (SELECT 1 FROM public.account_access a WHERE a.user_id=auth.uid() AND a.status='ativo') THEN NULL
    WHEN EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id=auth.uid() AND r.role IN ('admin','superadmin')) THEN 'admin'
    ELSE (SELECT m.perfil FROM public.dcs_membros m WHERE m.user_id=auth.uid() AND m.ativo
          AND (m.convite_expira_em IS NULL OR m.convite_expira_em>now() OR EXISTS (SELECT 1 FROM public.account_access a WHERE a.user_id=m.user_id AND a.last_access_at IS NOT NULL)))
  END $$;
CREATE OR REPLACE FUNCTION public.dcs_eh_admin() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT public.dcs_perfil()='admin' $$;
CREATE OR REPLACE FUNCTION public.dcs_ve_financeiro() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT public.dcs_perfil()='admin' OR (public.dcs_perfil() IS NOT NULL AND EXISTS (SELECT 1 FROM public.dcs_membros m WHERE m.user_id=auth.uid() AND m.financeiro)) $$;
CREATE OR REPLACE FUNCTION public.dcs_pode_ver(p_owner integer, p_key text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT CASE
    WHEN public.dcs_perfil() IS NULL THEN false
    WHEN public.dcs_perfil()='admin' THEN true
    ELSE EXISTS (SELECT 1 FROM public.dcs_membros m WHERE m.user_id=auth.uid() AND (p_owner = ANY(m.carteiras) OR p_key = ANY(m.clientes)))
  END $$;
REVOKE ALL ON FUNCTION public.dcs_perfil(), public.dcs_eh_admin(), public.dcs_ve_financeiro(), public.dcs_pode_ver(integer,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dcs_perfil(), public.dcs_eh_admin(), public.dcs_ve_financeiro(), public.dcs_pode_ver(integer,text) TO authenticated, service_role;

CREATE POLICY dcs_membros_ler ON public.dcs_membros FOR SELECT TO authenticated USING (user_id=auth.uid() OR public.dcs_eh_admin());
GRANT SELECT ON public.dcs_membros TO authenticated; GRANT ALL ON public.dcs_membros TO service_role;

-- ===================== Auditoria (append-only) =====================
CREATE TABLE public.dcs_auditoria (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  em timestamptz NOT NULL DEFAULT now(),
  ator uuid,
  entidade text NOT NULL,
  entidade_id text NOT NULL,
  acao text NOT NULL,
  dados jsonb
);
CREATE INDEX dcs_auditoria_ent ON public.dcs_auditoria(entidade, entidade_id, em DESC);
ALTER TABLE public.dcs_auditoria ENABLE ROW LEVEL SECURITY;
CREATE POLICY dcs_auditoria_admin ON public.dcs_auditoria FOR SELECT TO authenticated USING (public.dcs_eh_admin());
GRANT SELECT ON public.dcs_auditoria TO authenticated; GRANT ALL ON public.dcs_auditoria TO service_role;
CREATE OR REPLACE FUNCTION public.dcs_auditar(p_ent text, p_id text, p_acao text, p_dados jsonb) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
  INSERT INTO public.dcs_auditoria(ator,entidade,entidade_id,acao,dados) VALUES (auth.uid(),p_ent,p_id,p_acao,p_dados) $$;
REVOKE ALL ON FUNCTION public.dcs_auditar(text,text,text,jsonb) FROM PUBLIC, anon, authenticated;

-- ===================== Regras versionadas =====================
CREATE TABLE public.dcs_regras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  versao text NOT NULL UNIQUE,
  config jsonb NOT NULL,            -- pesos, faixas, créditos, referências, cobertura, etapas...
  metodologia text NOT NULL,        -- versão do motor (REGRAS_VERSAO em src/lib/dcs/motor.ts)
  ativa boolean NOT NULL DEFAULT false,
  criado_por uuid,
  criado_em timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX dcs_regras_uma_ativa ON public.dcs_regras(ativa) WHERE ativa;
ALTER TABLE public.dcs_regras ENABLE ROW LEVEL SECURITY;
CREATE POLICY dcs_regras_ler ON public.dcs_regras FOR SELECT TO authenticated USING (public.dcs_perfil() IS NOT NULL);
GRANT SELECT ON public.dcs_regras TO authenticated; GRANT ALL ON public.dcs_regras TO service_role;
INSERT INTO public.dcs_regras(versao, config, metodologia, ativa) VALUES ('1', '{}'::jsonb, 'v1-artefato+c1', true);

-- Nova versão de regras: nunca altera a anterior (diagnósticos guardam regras_id).
CREATE OR REPLACE FUNCTION public.dcs_publicar_regras(p_config jsonb, p_metodologia text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v uuid; n int; BEGIN
  IF NOT public.dcs_eh_admin() THEN RAISE EXCEPTION 'Somente administradores' USING ERRCODE='42501'; END IF;
  IF jsonb_typeof(p_config)<>'object' THEN RAISE EXCEPTION 'Configuração inválida'; END IF;
  PERFORM pg_advisory_xact_lock(927301);
  SELECT count(*)+1 INTO n FROM public.dcs_regras;
  UPDATE public.dcs_regras SET ativa=false WHERE ativa;
  INSERT INTO public.dcs_regras(versao,config,metodologia,ativa,criado_por) VALUES (n::text,p_config,p_metodologia,true,auth.uid()) RETURNING id INTO v;
  PERFORM public.dcs_auditar('regras', v::text, 'publicar', jsonb_build_object('versao',n));
  RETURN v; END $$;
REVOKE ALL ON FUNCTION public.dcs_publicar_regras(jsonb,text) FROM PUBLIC, anon; GRANT EXECUTE ON FUNCTION public.dcs_publicar_regras(jsonb,text) TO authenticated;

-- ===================== Carteira (Pipedrive → n8n → Supabase) =====================
CREATE TABLE public.dcs_clientes (
  key text PRIMARY KEY,                 -- org_id do Pipedrive, ou 'd'+deal_id sem organização
  org_id bigint,
  nome text NOT NULL,
  codigo text,
  deal_id bigint NOT NULL,
  deal_ids bigint[] NOT NULL,
  stage_id integer NOT NULL,
  owner_id integer,
  owner_nome text,
  person_id bigint,
  label_ids integer[] NOT NULL DEFAULT '{}',
  segmento text NOT NULL DEFAULT 'ecommerce',
  ativo boolean NOT NULL DEFAULT true,
  inativado_em timestamptz,
  sync_id uuid,
  atualizado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX dcs_clientes_owner ON public.dcs_clientes(owner_id) WHERE ativo;
ALTER TABLE public.dcs_clientes ENABLE ROW LEVEL SECURITY;
CREATE POLICY dcs_clientes_ler ON public.dcs_clientes FOR SELECT TO authenticated USING (public.dcs_pode_ver(owner_id, key));
GRANT SELECT ON public.dcs_clientes TO authenticated; GRANT ALL ON public.dcs_clientes TO service_role;

-- Financeiro isolado: sem permissão financeira a linha não existe para o usuário (API ou navegador).
CREATE TABLE public.dcs_clientes_financeiro (
  key text PRIMARY KEY REFERENCES public.dcs_clientes(key) ON DELETE CASCADE,
  mrr numeric(18,2),                    -- soma de deal.value (MRR confirmado em docs/regras-operacao-cs.md); null se algum negócio sem valor
  origem text NOT NULL DEFAULT 'deal.value',
  atualizado_em timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.dcs_clientes_financeiro ENABLE ROW LEVEL SECURITY;
CREATE POLICY dcs_fin_ler ON public.dcs_clientes_financeiro FOR SELECT TO authenticated
  USING (public.dcs_ve_financeiro() AND EXISTS (SELECT 1 FROM public.dcs_clientes c WHERE c.key=dcs_clientes_financeiro.key AND public.dcs_pode_ver(c.owner_id,c.key)));
GRANT SELECT ON public.dcs_clientes_financeiro TO authenticated; GRANT ALL ON public.dcs_clientes_financeiro TO service_role;

CREATE TABLE public.dcs_sync_execucoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL CHECK (tipo IN ('carteira','responsaveis','cobertura')),
  modo text NOT NULL DEFAULT 'completa' CHECK (modo IN ('completa','incremental','webhook')),
  status text NOT NULL DEFAULT 'executando' CHECK (status IN ('executando','sucesso','falha','parcial')),
  iniciado_em timestamptz NOT NULL DEFAULT now(),
  concluido_em timestamptz,
  lidos integer, criados integer, alterados integer, inativados integer,
  completo boolean,
  detalhes jsonb,
  erro text
);
CREATE UNIQUE INDEX dcs_sync_um_por_tipo ON public.dcs_sync_execucoes(tipo) WHERE status='executando';
ALTER TABLE public.dcs_sync_execucoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY dcs_sync_ler ON public.dcs_sync_execucoes FOR SELECT TO authenticated USING (public.dcs_perfil() IS NOT NULL);
GRANT SELECT ON public.dcs_sync_execucoes TO authenticated; GRANT ALL ON public.dcs_sync_execucoes TO service_role;

CREATE OR REPLACE FUNCTION public.dcs_iniciar_sync(p_tipo text, p_modo text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v uuid; BEGIN
  UPDATE public.dcs_sync_execucoes SET status='falha', concluido_em=now(), erro='Tempo limite; dados anteriores preservados'
   WHERE tipo=p_tipo AND status='executando' AND iniciado_em<now()-interval '30 minutes';
  INSERT INTO public.dcs_sync_execucoes(tipo,modo) VALUES (p_tipo,p_modo) RETURNING id INTO v;  -- índice único impede concorrência
  RETURN v; END $$;

-- Publica a carteira consolidada (n8n workflow 01/02). p_rows: [{key,org_id,nome,codigo,deal_id,deal_ids,stage_id,owner_id,owner_nome,person_id,label_ids,mrr}]
-- Só inativa ausentes quando p_completo = true e o modo é 'completa' (correção C5).
CREATE OR REPLACE FUNCTION public.dcs_publicar_carteira(p_run uuid, p_rows jsonb, p_lidos integer, p_completo boolean) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r record; v_modo text; v_ins boolean; c int:=0; u int:=0; i int:=0; BEGIN
  SELECT modo INTO v_modo FROM public.dcs_sync_execucoes WHERE id=p_run AND tipo='carteira' AND status='executando' FOR UPDATE;
  IF v_modo IS NULL THEN RAISE EXCEPTION 'Sincronização não está em execução'; END IF;
  IF jsonb_typeof(p_rows)<>'array' THEN RAISE EXCEPTION 'Payload inválido'; END IF;
  FOR r IN SELECT * FROM jsonb_to_recordset(p_rows) AS x(key text, org_id bigint, nome text, codigo text, deal_id bigint, deal_ids bigint[], stage_id integer, owner_id integer, owner_nome text, person_id bigint, label_ids integer[], mrr numeric) LOOP
    IF r.key IS NULL OR r.nome IS NULL OR r.deal_id IS NULL THEN RAISE EXCEPTION 'Linha inválida: %', r.key; END IF;
    INSERT INTO public.dcs_clientes AS t(key,org_id,nome,codigo,deal_id,deal_ids,stage_id,owner_id,owner_nome,person_id,label_ids,ativo,inativado_em,sync_id,atualizado_em)
    VALUES (r.key,r.org_id,r.nome,r.codigo,r.deal_id,coalesce(r.deal_ids,ARRAY[r.deal_id]),r.stage_id,r.owner_id,r.owner_nome,r.person_id,coalesce(r.label_ids,'{}'),true,NULL,p_run,now())
    ON CONFLICT (key) DO UPDATE SET org_id=excluded.org_id,nome=excluded.nome,codigo=excluded.codigo,deal_id=excluded.deal_id,deal_ids=excluded.deal_ids,stage_id=excluded.stage_id,
      owner_id=excluded.owner_id,owner_nome=excluded.owner_nome,person_id=excluded.person_id,label_ids=excluded.label_ids,ativo=true,inativado_em=NULL,sync_id=p_run,atualizado_em=now()
    WHERE (t.org_id,t.nome,t.codigo,t.deal_id,t.deal_ids,t.stage_id,t.owner_id,t.owner_nome,t.person_id,t.label_ids,t.ativo) IS DISTINCT FROM
          (excluded.org_id,excluded.nome,excluded.codigo,excluded.deal_id,excluded.deal_ids,excluded.stage_id,excluded.owner_id,excluded.owner_nome,excluded.person_id,excluded.label_ids,true)
    RETURNING (xmax = 0) INTO v_ins;
    IF FOUND THEN IF v_ins THEN c:=c+1; ELSE u:=u+1; END IF; END IF;
    UPDATE public.dcs_clientes SET sync_id=p_run WHERE key=r.key;
    INSERT INTO public.dcs_clientes_financeiro(key,mrr,atualizado_em) VALUES (r.key,r.mrr,now())
      ON CONFLICT (key) DO UPDATE SET mrr=excluded.mrr, atualizado_em=now() WHERE dcs_clientes_financeiro.mrr IS DISTINCT FROM excluded.mrr;
  END LOOP;
  IF p_completo AND v_modo='completa' THEN
    UPDATE public.dcs_clientes SET ativo=false, inativado_em=now() WHERE ativo AND sync_id IS DISTINCT FROM p_run;
    GET DIAGNOSTICS i = ROW_COUNT;
  END IF;
  UPDATE public.dcs_sync_execucoes SET status=CASE WHEN p_completo THEN 'sucesso' ELSE 'parcial' END, concluido_em=now(), lidos=p_lidos,
    criados=c, alterados=u, inativados=i, completo=p_completo WHERE id=p_run;
  RETURN jsonb_build_object('criados',c,'alterados',u,'inativados',i); END $$;

CREATE OR REPLACE FUNCTION public.dcs_falhar_sync(p_run uuid, p_erro text) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
  UPDATE public.dcs_sync_execucoes SET status='falha', concluido_em=now(), erro=left(p_erro,2000) WHERE id=p_run AND status='executando' $$;

-- ===================== Cobertura =====================
CREATE TABLE public.dcs_cobertura (
  key text PRIMARY KEY REFERENCES public.dcs_clientes(key) ON DELETE CASCADE,
  ultimo_efetivo jsonb,     -- {id,date,type,subject,owner}
  ultimo_incerto jsonb,     -- atividade concluída sem evidência suficiente
  ultima_tentativa jsonb,   -- tentativa sem sucesso (palavras de exclusão)
  proximo jsonb,            -- próximo contato agendado
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  sync_id uuid
);
ALTER TABLE public.dcs_cobertura ENABLE ROW LEVEL SECURITY;
CREATE POLICY dcs_cob_ler ON public.dcs_cobertura FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.dcs_clientes c WHERE c.key=dcs_cobertura.key AND public.dcs_pode_ver(c.owner_id,c.key)));
GRANT SELECT ON public.dcs_cobertura TO authenticated; GRANT ALL ON public.dcs_cobertura TO service_role;

CREATE OR REPLACE FUNCTION public.dcs_publicar_cobertura(p_run uuid, p_rows jsonb, p_completo boolean, p_detalhes jsonb) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE n int; BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.dcs_sync_execucoes WHERE id=p_run AND tipo='cobertura' AND status='executando') THEN RAISE EXCEPTION 'Sincronização não está em execução'; END IF;
  INSERT INTO public.dcs_cobertura(key,ultimo_efetivo,ultimo_incerto,ultima_tentativa,proximo,atualizado_em,sync_id)
  SELECT x.key,x.ultimo_efetivo,x.ultimo_incerto,x.ultima_tentativa,x.proximo,now(),p_run
    FROM jsonb_to_recordset(p_rows) AS x(key text, ultimo_efetivo jsonb, ultimo_incerto jsonb, ultima_tentativa jsonb, proximo jsonb)
    JOIN public.dcs_clientes c ON c.key=x.key
  ON CONFLICT (key) DO UPDATE SET ultimo_efetivo=excluded.ultimo_efetivo, ultimo_incerto=excluded.ultimo_incerto,
    ultima_tentativa=excluded.ultima_tentativa, proximo=excluded.proximo, atualizado_em=now(), sync_id=p_run;
  GET DIAGNOSTICS n = ROW_COUNT;
  UPDATE public.dcs_sync_execucoes SET status=CASE WHEN p_completo THEN 'sucesso' ELSE 'parcial' END, concluido_em=now(), alterados=n, completo=p_completo, detalhes=p_detalhes WHERE id=p_run;
  RETURN n; END $$;

-- ===================== Diagnósticos (ciclos, nunca sobrescritos) =====================
CREATE TABLE public.dcs_diagnosticos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_key text NOT NULL REFERENCES public.dcs_clientes(key),
  ciclo integer NOT NULL CHECK (ciclo >= 1),
  status text NOT NULL DEFAULT 'em_analise' CHECK (status IN ('em_analise','concluido')),
  analista_id uuid NOT NULL REFERENCES public.profiles(id),
  regras_id uuid NOT NULL REFERENCES public.dcs_regras(id),
  itens jsonb NOT NULL DEFAULT '{}',
  metricas jsonb NOT NULL DEFAULT '{}',
  resultados jsonb NOT NULL DEFAULT '{}',
  meta jsonb NOT NULL DEFAULT '{}',
  derivado jsonb,                 -- saída de motor.derivado() no último salvamento
  resumo text,                    -- resumo profissional na conclusão
  indice integer CHECK (indice BETWEEN 0 AND 100),
  completude integer CHECK (completude BETWEEN 0 AND 100),
  versao integer NOT NULL DEFAULT 1,  -- controle otimista de concorrência
  iniciado_em timestamptz NOT NULL DEFAULT now(),
  salvo_em timestamptz NOT NULL DEFAULT now(),
  concluido_em timestamptz,
  proxima_revisao date,
  UNIQUE (cliente_key, ciclo)
);
CREATE UNIQUE INDEX dcs_diag_um_aberto ON public.dcs_diagnosticos(cliente_key) WHERE status='em_analise';
CREATE INDEX dcs_diag_analista ON public.dcs_diagnosticos(analista_id, status);
ALTER TABLE public.dcs_diagnosticos ENABLE ROW LEVEL SECURITY;
CREATE POLICY dcs_diag_ler ON public.dcs_diagnosticos FOR SELECT TO authenticated
  USING (analista_id=auth.uid() AND public.dcs_perfil() IS NOT NULL
         OR EXISTS (SELECT 1 FROM public.dcs_clientes c WHERE c.key=cliente_key AND public.dcs_pode_ver(c.owner_id,c.key)));
GRANT SELECT ON public.dcs_diagnosticos TO authenticated; GRANT ALL ON public.dcs_diagnosticos TO service_role;

CREATE TABLE public.dcs_diagnosticos_eventos (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  diagnostico_id uuid NOT NULL REFERENCES public.dcs_diagnosticos(id),
  em timestamptz NOT NULL DEFAULT now(),
  ator uuid,
  tipo text NOT NULL,     -- iniciar, salvar, concluir, reabrir, transferir
  dados jsonb
);
CREATE INDEX dcs_diag_ev ON public.dcs_diagnosticos_eventos(diagnostico_id, em);
ALTER TABLE public.dcs_diagnosticos_eventos ENABLE ROW LEVEL SECURITY;
CREATE POLICY dcs_diag_ev_ler ON public.dcs_diagnosticos_eventos FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.dcs_diagnosticos d WHERE d.id=diagnostico_id));  -- herda a RLS do diagnóstico
GRANT SELECT ON public.dcs_diagnosticos_eventos TO authenticated; GRANT ALL ON public.dcs_diagnosticos_eventos TO service_role;

-- Inicia (ou retoma) a análise do cliente. Impede dois analistas na mesma análise.
CREATE OR REPLACE FUNCTION public.dcs_iniciar_analise(p_key text) RETURNS public.dcs_diagnosticos LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c public.dcs_clientes; d public.dcs_diagnosticos; ant public.dcs_diagnosticos; reg uuid; BEGIN
  SELECT * INTO c FROM public.dcs_clientes WHERE key=p_key AND ativo FOR UPDATE;
  IF c.key IS NULL OR NOT public.dcs_pode_ver(c.owner_id,c.key) THEN RAISE EXCEPTION 'Cliente não encontrado ou sem permissão' USING ERRCODE='42501'; END IF;
  SELECT * INTO d FROM public.dcs_diagnosticos WHERE cliente_key=p_key AND status='em_analise';
  IF d.id IS NOT NULL THEN
    IF d.analista_id<>auth.uid() THEN RAISE EXCEPTION 'Análise em andamento por outro analista' USING ERRCODE='P0001'; END IF;
    RETURN d;
  END IF;
  SELECT * INTO ant FROM public.dcs_diagnosticos WHERE cliente_key=p_key ORDER BY ciclo DESC LIMIT 1;
  SELECT id INTO reg FROM public.dcs_regras WHERE ativa;
  -- Novo ciclo parte das respostas anteriores (evidências preservadas no ciclo antigo, que fica imutável).
  INSERT INTO public.dcs_diagnosticos(cliente_key,ciclo,analista_id,regras_id,itens,metricas,resultados,meta)
  VALUES (p_key, coalesce(ant.ciclo,0)+1, auth.uid(), reg, coalesce(ant.itens,'{}'), '{}', coalesce(ant.resultados,'{}'), '{}')
  RETURNING * INTO d;
  INSERT INTO public.dcs_diagnosticos_eventos(diagnostico_id,ator,tipo,dados) VALUES (d.id,auth.uid(),'iniciar',jsonb_build_object('ciclo',d.ciclo,'base',ant.id));
  RETURN d; END $$;

-- Salvamento automático com controle otimista: falha se outra edição foi gravada antes.
CREATE OR REPLACE FUNCTION public.dcs_salvar_diagnostico(p_id uuid, p_versao integer, p_itens jsonb, p_metricas jsonb, p_resultados jsonb, p_meta jsonb, p_derivado jsonb)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE d public.dcs_diagnosticos; BEGIN
  SELECT * INTO d FROM public.dcs_diagnosticos WHERE id=p_id FOR UPDATE;
  IF d.id IS NULL THEN RAISE EXCEPTION 'Diagnóstico inexistente'; END IF;
  IF d.status<>'em_analise' THEN RAISE EXCEPTION 'Diagnóstico concluído: reabra para editar' USING ERRCODE='P0002'; END IF;
  IF d.analista_id<>auth.uid() AND NOT public.dcs_eh_admin() THEN RAISE EXCEPTION 'Somente o analista responsável edita esta análise' USING ERRCODE='42501'; END IF;
  IF d.versao<>p_versao THEN RAISE EXCEPTION 'Conflito de edição: versão % no servidor', d.versao USING ERRCODE='40001'; END IF;
  IF jsonb_typeof(p_itens)<>'object' OR jsonb_typeof(p_metricas)<>'object' THEN RAISE EXCEPTION 'Payload inválido'; END IF;
  UPDATE public.dcs_diagnosticos SET itens=p_itens, metricas=p_metricas, resultados=coalesce(p_resultados,'{}'), meta=coalesce(p_meta,'{}'),
    derivado=p_derivado, indice=nullif(p_derivado->>'score','')::int, completude=nullif(p_derivado->>'completion','')::int,
    versao=versao+1, salvo_em=now() WHERE id=p_id;
  RETURN p_versao+1; END $$;

-- ===================== Plano de ação =====================
CREATE TABLE public.dcs_acoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_key text NOT NULL REFERENCES public.dcs_clientes(key),
  rec_id text NOT NULL,                -- id determinístico do motor (item ou x_*), ou manual_*
  categoria text NOT NULL,
  problema text NOT NULL, acao text NOT NULL, beneficio text,
  prioridade text NOT NULL CHECK (prioridade IN ('critica','alta','media','baixa')),
  complexidade text CHECK (complexidade IN ('baixa','media','alta')),
  quem text CHECK (quem IN ('dinamize','cliente','ambos')),
  ganho_rapido boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'aguardando_contato' CHECK (status IN ('aguardando_contato','aguardando_cliente','aguardando_aprovacao','em_implementacao','aguardando_ativacao','implementado','nao_aprovado')),
  responsavel text, prazo date, observacoes text,
  manual boolean NOT NULL DEFAULT false,
  obsoleta boolean NOT NULL DEFAULT false, obsoleta_em date,
  reincidencias integer NOT NULL DEFAULT 0,
  primeiro_ciclo integer NOT NULL, ultimo_ciclo integer NOT NULL,
  versao integer NOT NULL DEFAULT 1,
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cliente_key, rec_id)
);
CREATE INDEX dcs_acoes_aberta ON public.dcs_acoes(cliente_key) WHERE NOT obsoleta AND status<>'implementado';
ALTER TABLE public.dcs_acoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY dcs_acoes_ler ON public.dcs_acoes FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.dcs_clientes c WHERE c.key=cliente_key AND public.dcs_pode_ver(c.owner_id,c.key)));
GRANT SELECT ON public.dcs_acoes TO authenticated; GRANT ALL ON public.dcs_acoes TO service_role;

CREATE TABLE public.dcs_acoes_eventos (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  acao_id uuid NOT NULL REFERENCES public.dcs_acoes(id),
  em timestamptz NOT NULL DEFAULT now(), ator uuid, tipo text NOT NULL, dados jsonb
);
ALTER TABLE public.dcs_acoes_eventos ENABLE ROW LEVEL SECURITY;
CREATE POLICY dcs_acoes_ev_ler ON public.dcs_acoes_eventos FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.dcs_acoes a WHERE a.id=acao_id));
GRANT SELECT ON public.dcs_acoes_eventos TO authenticated; GRANT ALL ON public.dcs_acoes_eventos TO service_role;

-- Atualiza status/responsável/prazo/observações (independe do status do diagnóstico).
CREATE OR REPLACE FUNCTION public.dcs_atualizar_acao(p_id uuid, p_versao integer, p_campos jsonb) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE a public.dcs_acoes; c public.dcs_clientes; BEGIN
  SELECT * INTO a FROM public.dcs_acoes WHERE id=p_id FOR UPDATE;
  SELECT * INTO c FROM public.dcs_clientes WHERE key=a.cliente_key;
  IF a.id IS NULL OR NOT public.dcs_pode_ver(c.owner_id,c.key) THEN RAISE EXCEPTION 'Sem permissão' USING ERRCODE='42501'; END IF;
  IF a.versao<>p_versao THEN RAISE EXCEPTION 'Conflito de edição' USING ERRCODE='40001'; END IF;
  IF p_campos - ARRAY['status','responsavel','prazo','observacoes','prioridade'] <> '{}'::jsonb THEN RAISE EXCEPTION 'Campo não editável'; END IF;
  UPDATE public.dcs_acoes SET status=coalesce(p_campos->>'status',status), responsavel=CASE WHEN p_campos ? 'responsavel' THEN p_campos->>'responsavel' ELSE responsavel END,
    prazo=CASE WHEN p_campos ? 'prazo' THEN nullif(p_campos->>'prazo','')::date ELSE prazo END,
    observacoes=CASE WHEN p_campos ? 'observacoes' THEN p_campos->>'observacoes' ELSE observacoes END,
    prioridade=coalesce(p_campos->>'prioridade',prioridade), versao=versao+1, atualizado_em=now() WHERE id=p_id;
  INSERT INTO public.dcs_acoes_eventos(acao_id,ator,tipo,dados) VALUES (p_id,auth.uid(),'atualizar',p_campos);
  RETURN p_versao+1; END $$;

-- ===================== Fila de integrações (outbox para o n8n) =====================
CREATE TABLE public.dcs_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL CHECK (tipo IN ('pipedrive_atividade_diagnostico','mensagem_ia')),
  chave text NOT NULL UNIQUE,          -- idempotência (ex.: DZCS-<key>-C<ciclo>)
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'aguardando_autorizacao' CHECK (status IN ('aguardando_autorizacao','pendente','processando','concluido','falha','ambiguo','cancelado')),
  tentativas integer NOT NULL DEFAULT 0,
  proxima_tentativa timestamptz NOT NULL DEFAULT now(),
  travado_em timestamptz,
  resultado jsonb,                     -- ex.: {"activity_id": 123}
  erro text,
  criado_por uuid, criado_em timestamptz NOT NULL DEFAULT now(), atualizado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX dcs_jobs_fila ON public.dcs_jobs(status, proxima_tentativa);
ALTER TABLE public.dcs_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY dcs_jobs_admin ON public.dcs_jobs FOR SELECT TO authenticated USING (public.dcs_eh_admin());
GRANT SELECT ON public.dcs_jobs TO authenticated; GRANT ALL ON public.dcs_jobs TO service_role;

CREATE TABLE public.dcs_integracao_logs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  em timestamptz NOT NULL DEFAULT now(),
  origem text NOT NULL, nivel text NOT NULL CHECK (nivel IN ('info','aviso','erro')),
  job_id uuid REFERENCES public.dcs_jobs(id), sync_id uuid, mensagem text NOT NULL, dados jsonb
);
CREATE INDEX dcs_logs_em ON public.dcs_integracao_logs(em DESC);
ALTER TABLE public.dcs_integracao_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY dcs_logs_admin ON public.dcs_integracao_logs FOR SELECT TO authenticated USING (public.dcs_eh_admin());
GRANT SELECT ON public.dcs_integracao_logs TO authenticated; GRANT ALL ON public.dcs_integracao_logs TO service_role;

-- Conclusão atômica: congela o ciclo, grava o plano mesclado (motor.mesclarPlano) e enfileira a atividade do Pipedrive.
-- p_acoes: [{rec_id,categoria,problema,acao,beneficio,prioridade,complexidade,quem,ganho_rapido,prazo,manual,obsoleta,obsoleta_em,reincidencias,primeiro_ciclo,ultimo_ciclo,status,observacoes}]
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

CREATE OR REPLACE FUNCTION public.dcs_reabrir_analise(p_id uuid, p_motivo text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE d public.dcs_diagnosticos; BEGIN
  SELECT * INTO d FROM public.dcs_diagnosticos WHERE id=p_id FOR UPDATE;
  IF d.id IS NULL OR d.status<>'concluido' THEN RAISE EXCEPTION 'Diagnóstico não concluído'; END IF;
  IF d.analista_id<>auth.uid() AND NOT public.dcs_eh_admin() THEN RAISE EXCEPTION 'Sem permissão' USING ERRCODE='42501'; END IF;
  IF EXISTS (SELECT 1 FROM public.dcs_diagnosticos WHERE cliente_key=d.cliente_key AND ciclo>d.ciclo) THEN RAISE EXCEPTION 'Somente o ciclo mais recente pode ser reaberto'; END IF;
  UPDATE public.dcs_diagnosticos SET status='em_analise', versao=versao+1 WHERE id=p_id;
  INSERT INTO public.dcs_diagnosticos_eventos(diagnostico_id,ator,tipo,dados) VALUES (p_id,auth.uid(),'reabrir',jsonb_build_object('motivo',p_motivo,'resumo_anterior',d.resumo,'indice_anterior',d.indice));
END $$;

CREATE OR REPLACE FUNCTION public.dcs_transferir_analise(p_id uuid, p_para uuid, p_motivo text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE d public.dcs_diagnosticos; BEGIN
  IF NOT public.dcs_eh_admin() THEN RAISE EXCEPTION 'Somente administradores' USING ERRCODE='42501'; END IF;
  SELECT * INTO d FROM public.dcs_diagnosticos WHERE id=p_id FOR UPDATE;
  IF d.id IS NULL OR d.status<>'em_analise' THEN RAISE EXCEPTION 'Somente análises em andamento'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.dcs_membros WHERE user_id=p_para AND ativo) THEN RAISE EXCEPTION 'Destino inválido'; END IF;
  UPDATE public.dcs_diagnosticos SET analista_id=p_para, versao=versao+1 WHERE id=p_id;
  INSERT INTO public.dcs_diagnosticos_eventos(diagnostico_id,ator,tipo,dados) VALUES (p_id,auth.uid(),'transferir',jsonb_build_object('de',d.analista_id,'para',p_para,'motivo',p_motivo));
END $$;

-- ===================== Configurações, mensagens e preferências =====================
CREATE TABLE public.dcs_config (chave text PRIMARY KEY, valor jsonb NOT NULL, atualizado_por uuid, atualizado_em timestamptz NOT NULL DEFAULT now());
ALTER TABLE public.dcs_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY dcs_config_ler ON public.dcs_config FOR SELECT TO authenticated USING (public.dcs_eh_admin());
GRANT SELECT ON public.dcs_config TO authenticated; GRANT ALL ON public.dcs_config TO service_role;
INSERT INTO public.dcs_config(chave,valor) VALUES ('pipedrive_escrita','{"ativa":false}'), ('ia_mensagens','{"ativa":false}');

CREATE TABLE public.dcs_mensagens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  diagnostico_id uuid NOT NULL REFERENCES public.dcs_diagnosticos(id),
  canal text NOT NULL CHECK (canal IN ('whatsapp','email')),
  assunto text, texto text NOT NULL,
  origem text NOT NULL CHECK (origem IN ('template','ia','editado')),
  criado_por uuid NOT NULL DEFAULT auth.uid(), criado_em timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.dcs_mensagens ENABLE ROW LEVEL SECURITY;
CREATE POLICY dcs_msg_ler ON public.dcs_mensagens FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.dcs_diagnosticos d WHERE d.id=diagnostico_id));
CREATE POLICY dcs_msg_criar ON public.dcs_mensagens FOR INSERT TO authenticated WITH CHECK (criado_por=auth.uid() AND EXISTS (SELECT 1 FROM public.dcs_diagnosticos d WHERE d.id=diagnostico_id));
GRANT SELECT, INSERT ON public.dcs_mensagens TO authenticated; GRANT ALL ON public.dcs_mensagens TO service_role;

CREATE TABLE public.dcs_preferencias (user_id uuid PRIMARY KEY DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE, valor jsonb NOT NULL DEFAULT '{}', atualizado_em timestamptz NOT NULL DEFAULT now());
ALTER TABLE public.dcs_preferencias ENABLE ROW LEVEL SECURITY;
CREATE POLICY dcs_pref_dono ON public.dcs_preferencias FOR ALL TO authenticated USING (user_id=auth.uid()) WITH CHECK (user_id=auth.uid());
GRANT SELECT, INSERT, UPDATE ON public.dcs_preferencias TO authenticated; GRANT ALL ON public.dcs_preferencias TO service_role;

-- Funções chamadas pelo app: authenticated. Funções de integração: somente service_role (n8n via chave em credencial do n8n).
REVOKE ALL ON FUNCTION public.dcs_iniciar_analise(text), public.dcs_salvar_diagnostico(uuid,integer,jsonb,jsonb,jsonb,jsonb,jsonb),
  public.dcs_atualizar_acao(uuid,integer,jsonb), public.dcs_concluir_analise(uuid,integer,text,jsonb,jsonb,date,boolean),
  public.dcs_reabrir_analise(uuid,text), public.dcs_transferir_analise(uuid,uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dcs_iniciar_analise(text), public.dcs_salvar_diagnostico(uuid,integer,jsonb,jsonb,jsonb,jsonb,jsonb),
  public.dcs_atualizar_acao(uuid,integer,jsonb), public.dcs_concluir_analise(uuid,integer,text,jsonb,jsonb,date,boolean),
  public.dcs_reabrir_analise(uuid,text), public.dcs_transferir_analise(uuid,uuid,text) TO authenticated;
REVOKE ALL ON FUNCTION public.dcs_iniciar_sync(text,text), public.dcs_publicar_carteira(uuid,jsonb,integer,boolean),
  public.dcs_falhar_sync(uuid,text), public.dcs_publicar_cobertura(uuid,jsonb,boolean,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.dcs_iniciar_sync(text,text), public.dcs_publicar_carteira(uuid,jsonb,integer,boolean),
  public.dcs_falhar_sync(uuid,text), public.dcs_publicar_cobertura(uuid,jsonb,boolean,jsonb) TO service_role;

-- Fila: o n8n reserva jobs com SKIP LOCKED (sem duplo processamento) e devolve o resultado.
CREATE OR REPLACE FUNCTION public.dcs_reservar_jobs(p_tipo text, p_limite integer DEFAULT 10) RETURNS SETOF public.dcs_jobs LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
  UPDATE public.dcs_jobs j SET status='processando', travado_em=now(), tentativas=tentativas+1, atualizado_em=now()
  WHERE j.id IN (SELECT id FROM public.dcs_jobs WHERE tipo=p_tipo AND (status IN ('pendente','falha') AND proxima_tentativa<=now() AND tentativas<5
                   OR status='processando' AND travado_em<now()-interval '15 minutes') ORDER BY criado_em LIMIT p_limite FOR UPDATE SKIP LOCKED)
  RETURNING j.* $$;
CREATE OR REPLACE FUNCTION public.dcs_finalizar_job(p_id uuid, p_status text, p_resultado jsonb, p_erro text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
  IF p_status NOT IN ('concluido','falha','ambiguo') THEN RAISE EXCEPTION 'Status inválido'; END IF;
  UPDATE public.dcs_jobs SET status=p_status, resultado=coalesce(p_resultado,resultado), erro=left(p_erro,2000), travado_em=NULL, atualizado_em=now(),
    proxima_tentativa=now() + make_interval(mins => (power(2, least(tentativas,6)))::int)  -- backoff exponencial
  WHERE id=p_id AND status='processando';
  INSERT INTO public.dcs_integracao_logs(origem,nivel,job_id,mensagem,dados) VALUES ('n8n', CASE p_status WHEN 'concluido' THEN 'info' ELSE 'erro' END, p_id, p_status, coalesce(p_resultado,'{}')||jsonb_build_object('erro',p_erro));
END $$;
REVOKE ALL ON FUNCTION public.dcs_reservar_jobs(text,integer), public.dcs_finalizar_job(uuid,text,jsonb,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.dcs_reservar_jobs(text,integer), public.dcs_finalizar_job(uuid,text,jsonb,text) TO service_role;

-- Admin libera/reprocessa jobs.
CREATE OR REPLACE FUNCTION public.dcs_liberar_job(p_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
  IF NOT public.dcs_eh_admin() THEN RAISE EXCEPTION 'Somente administradores' USING ERRCODE='42501'; END IF;
  UPDATE public.dcs_jobs SET status='pendente', proxima_tentativa=now(), tentativas=0, atualizado_em=now() WHERE id=p_id AND status IN ('aguardando_autorizacao','falha');
  PERFORM public.dcs_auditar('job', p_id::text, 'liberar', NULL);
END $$;
REVOKE ALL ON FUNCTION public.dcs_liberar_job(uuid) FROM PUBLIC, anon; GRANT EXECUTE ON FUNCTION public.dcs_liberar_job(uuid) TO authenticated;

-- Gestão de membros (admin), com auditoria.
CREATE OR REPLACE FUNCTION public.dcs_salvar_membro(p_user uuid, p_perfil text, p_financeiro boolean, p_ativo boolean, p_carteiras integer[], p_clientes text[], p_modulos text[], p_pipedrive integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
  IF NOT public.dcs_eh_admin() THEN RAISE EXCEPTION 'Somente administradores' USING ERRCODE='42501'; END IF;
  INSERT INTO public.dcs_membros(user_id,perfil,financeiro,ativo,carteiras,clientes,modulos,pipedrive_user_id,convidado_por,convite_expira_em)
  VALUES (p_user,p_perfil,p_financeiro,p_ativo,coalesce(p_carteiras,'{}'),coalesce(p_clientes,'{}'),p_modulos,p_pipedrive,auth.uid(),now()+interval '7 days')
  ON CONFLICT (user_id) DO UPDATE SET perfil=excluded.perfil, financeiro=excluded.financeiro, ativo=excluded.ativo, carteiras=excluded.carteiras,
    clientes=excluded.clientes, modulos=excluded.modulos, pipedrive_user_id=excluded.pipedrive_user_id, atualizado_em=now();
  PERFORM public.dcs_auditar('membro', p_user::text, 'salvar', jsonb_build_object('perfil',p_perfil,'financeiro',p_financeiro,'ativo',p_ativo,'carteiras',p_carteiras,'clientes',p_clientes,'modulos',p_modulos));
END $$;
REVOKE ALL ON FUNCTION public.dcs_salvar_membro(uuid,text,boolean,boolean,integer[],text[],text[],integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dcs_salvar_membro(uuid,text,boolean,boolean,integer[],text[],text[],integer) TO authenticated;

-- Endurecimento: o Supabase concede ALL (inclusive TRUNCATE, fora do alcance da RLS) a anon/authenticated por padrão.
DO $$ DECLARE t text; BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename LIKE 'dcs\_%' LOOP
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
    EXECUTE format('REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.%I FROM authenticated', t);
  END LOOP;
END $$;
GRANT INSERT ON public.dcs_mensagens TO authenticated;
GRANT INSERT, UPDATE ON public.dcs_preferencias TO authenticated;
