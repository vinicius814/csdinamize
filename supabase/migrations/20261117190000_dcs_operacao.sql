-- Dinamize CS — operação de análises (aditiva). Corrige: Master/admin legado não podia assumir nem receber análises
-- (a transferência exigia cadastro em dcs_membros). Acrescenta: atribuir análise ainda não iniciada, assumir, ação manual,
-- tipos de atividade do Pipedrive para classificação configurável e leitura das regras ativas pelo n8n.

-- Perfil/visibilidade/edição de OUTRO usuário (uso interno das funções; mesma regra de dcs_perfil/dcs_pode_ver).
CREATE OR REPLACE FUNCTION public.dcs_perfil_de(p_user uuid) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT CASE
    WHEN NOT EXISTS (SELECT 1 FROM public.account_access a WHERE a.user_id=p_user AND a.status='ativo') THEN NULL
    WHEN EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id=p_user AND r.role IN ('admin','superadmin')) THEN 'admin'
    ELSE (SELECT m.perfil FROM public.dcs_membros m WHERE m.user_id=p_user AND m.ativo)
  END $$;
CREATE OR REPLACE FUNCTION public.dcs_pode_atuar_de(p_user uuid, p_owner integer, p_key text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT CASE
    WHEN public.dcs_perfil_de(p_user) IS NULL THEN false
    WHEN public.dcs_perfil_de(p_user)='admin' THEN true
    ELSE EXISTS (SELECT 1 FROM public.dcs_membros m WHERE m.user_id=p_user AND m.pode_editar
                 AND (p_owner = ANY(m.carteiras) OR p_key = ANY(m.clientes)))
  END $$;

-- Redistribuir (admin): destino precisa ter perfil ativo, permissão de edição e acesso ao cliente. Inclui Master/admin.
CREATE OR REPLACE FUNCTION public.dcs_transferir_analise(p_id uuid, p_para uuid, p_motivo text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE d public.dcs_diagnosticos; c public.dcs_clientes; BEGIN
  IF NOT public.dcs_eh_admin() THEN RAISE EXCEPTION 'Somente administradores' USING ERRCODE='42501'; END IF;
  SELECT * INTO d FROM public.dcs_diagnosticos WHERE id=p_id FOR UPDATE;
  IF d.id IS NULL OR d.status<>'em_analise' THEN RAISE EXCEPTION 'Somente análises em andamento'; END IF;
  SELECT * INTO c FROM public.dcs_clientes WHERE key=d.cliente_key;
  IF NOT public.dcs_pode_atuar_de(p_para, c.owner_id, c.key) THEN RAISE EXCEPTION 'O destino não tem acesso de edição a este cliente'; END IF;
  IF d.analista_id = p_para THEN RETURN; END IF;
  UPDATE public.dcs_diagnosticos SET analista_id=p_para, versao=versao+1 WHERE id=p_id;
  INSERT INTO public.dcs_diagnosticos_eventos(diagnostico_id,ator,tipo,dados)
  VALUES (p_id,auth.uid(),'transferir',jsonb_build_object('de',d.analista_id,'para',p_para,'motivo',p_motivo));
END $$;

-- Atribuir (admin) uma análise ainda não iniciada: cria o ciclo e vincula o analista escolhido.
CREATE OR REPLACE FUNCTION public.dcs_atribuir_analise(p_key text, p_para uuid) RETURNS public.dcs_diagnosticos LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c public.dcs_clientes; d public.dcs_diagnosticos; BEGIN
  IF NOT public.dcs_eh_admin() THEN RAISE EXCEPTION 'Somente administradores' USING ERRCODE='42501'; END IF;
  SELECT * INTO c FROM public.dcs_clientes WHERE key=p_key AND ativo;
  IF c.key IS NULL THEN RAISE EXCEPTION 'Cliente não encontrado ou inativo'; END IF;
  IF EXISTS (SELECT 1 FROM public.dcs_diagnosticos WHERE cliente_key=p_key AND status='em_analise') THEN
    RAISE EXCEPTION 'Já existe análise em andamento: use Redistribuir' USING ERRCODE='P0001';
  END IF;
  IF NOT public.dcs_pode_atuar_de(p_para, c.owner_id, c.key) THEN RAISE EXCEPTION 'O destino não tem acesso de edição a este cliente'; END IF;
  d := public.dcs_iniciar_analise(p_key);
  IF d.analista_id <> p_para THEN
    UPDATE public.dcs_diagnosticos SET analista_id=p_para, versao=versao+1 WHERE id=d.id RETURNING * INTO d;
    INSERT INTO public.dcs_diagnosticos_eventos(diagnostico_id,ator,tipo,dados) VALUES (d.id,auth.uid(),'atribuir',jsonb_build_object('para',p_para));
  END IF;
  RETURN d;
END $$;

-- Ação manual no plano (fora do ciclo de conclusão). Preservada nas próximas conclusões (manual=true).
CREATE OR REPLACE FUNCTION public.dcs_criar_acao(p_key text, p_categoria text, p_problema text, p_acao text, p_prioridade text,
  p_complexidade text, p_responsavel text, p_prazo date, p_ganho_rapido boolean) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c public.dcs_clientes; ciclo int; v uuid; BEGIN
  SELECT * INTO c FROM public.dcs_clientes WHERE key=p_key;
  IF c.key IS NULL OR NOT public.dcs_pode_ver(c.owner_id,c.key) THEN RAISE EXCEPTION 'Cliente não encontrado ou sem permissão' USING ERRCODE='42501'; END IF;
  IF coalesce(trim(p_acao),'')='' OR coalesce(trim(p_problema),'')='' THEN RAISE EXCEPTION 'Informe o problema e a ação'; END IF;
  SELECT coalesce(max(d.ciclo),0) INTO ciclo FROM public.dcs_diagnosticos d WHERE d.cliente_key=p_key;
  INSERT INTO public.dcs_acoes(cliente_key,rec_id,categoria,problema,acao,prioridade,complexidade,quem,ganho_rapido,responsavel,prazo,manual,primeiro_ciclo,ultimo_ciclo)
  VALUES (p_key,'manual_'||replace(gen_random_uuid()::text,'-',''),coalesce(nullif(p_categoria,''),'res'),left(p_problema,2000),left(p_acao,2000),
          p_prioridade,nullif(p_complexidade,''),'ambos',coalesce(p_ganho_rapido,false),nullif(p_responsavel,''),p_prazo,true,ciclo,ciclo)
  RETURNING id INTO v;
  INSERT INTO public.dcs_acoes_eventos(acao_id,ator,tipo,dados) VALUES (v,auth.uid(),'criar',jsonb_build_object('manual',true));
  RETURN v;
END $$;

-- Tipos de atividade vistos no Pipedrive (o n8n registra); a classificação fica em dcs_regras.config.cov.modes.
CREATE TABLE IF NOT EXISTS public.dcs_tipos_atividade (
  chave text PRIMARY KEY, nome text, ocorrencias integer NOT NULL DEFAULT 0, visto_em timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.dcs_tipos_atividade ENABLE ROW LEVEL SECURITY;
CREATE POLICY dcs_tipos_ler ON public.dcs_tipos_atividade FOR SELECT TO authenticated USING (public.dcs_perfil() IS NOT NULL);
REVOKE ALL ON public.dcs_tipos_atividade FROM anon; REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.dcs_tipos_atividade FROM authenticated;
GRANT SELECT ON public.dcs_tipos_atividade TO authenticated; GRANT ALL ON public.dcs_tipos_atividade TO service_role;
CREATE OR REPLACE FUNCTION public.dcs_registrar_tipos_atividade(p_tipos jsonb) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE n int; BEGIN
  INSERT INTO public.dcs_tipos_atividade(chave,nome,ocorrencias,visto_em)
  SELECT x->>'chave', nullif(x->>'nome',''), coalesce((x->>'ocorrencias')::int,0), now() FROM jsonb_array_elements(coalesce(p_tipos,'[]')) x WHERE coalesce(x->>'chave','')<>''
  ON CONFLICT (chave) DO UPDATE SET nome=coalesce(excluded.nome,dcs_tipos_atividade.nome), ocorrencias=excluded.ocorrencias, visto_em=now();
  GET DIAGNOSTICS n = ROW_COUNT; RETURN n; END $$;
-- Regras ativas para o n8n (classificação configurável sem alterar código).
CREATE OR REPLACE FUNCTION public.dcs_regras_ativas() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT coalesce((SELECT config FROM public.dcs_regras WHERE ativa), '{}'::jsonb) $$;

INSERT INTO public.dcs_tipos_atividade(chave,nome) VALUES
 ('contato_efetivo','Contato efetivo'),('reunio_acompanhamento','Reunião de acompanhamento'),('reunio_3___ativao','Reunião (ativação/CS)'),
 ('email1','E-mail / mensagem'),('tarefa','Tarefa'),('anlise','Análise'),('upgrade','Upgrade'),('downgrade','Downgrade'),
 ('no_show_implementao','No-show'),('ativao_concluda','Ativação concluída'),('case','Case'),('implementao_concluda1','Implementação concluída')
ON CONFLICT (chave) DO NOTHING;

REVOKE ALL ON FUNCTION public.dcs_perfil_de(uuid), public.dcs_pode_atuar_de(uuid,integer,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.dcs_transferir_analise(uuid,uuid,text), public.dcs_atribuir_analise(text,uuid),
  public.dcs_criar_acao(text,text,text,text,text,text,text,date,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dcs_transferir_analise(uuid,uuid,text), public.dcs_atribuir_analise(text,uuid),
  public.dcs_criar_acao(text,text,text,text,text,text,text,date,boolean) TO authenticated;
REVOKE ALL ON FUNCTION public.dcs_registrar_tipos_atividade(jsonb), public.dcs_regras_ativas() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.dcs_registrar_tipos_atividade(jsonb), public.dcs_regras_ativas() TO service_role;
