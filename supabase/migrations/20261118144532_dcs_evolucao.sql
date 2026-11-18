-- Dinamize CS — evolução operacional (18/11/2026). Aditiva e não destrutiva.
-- 1) Usuários: pré-cadastro por e-mail aplicado no primeiro login verificado; gestão completa pelo admin.
-- 2) Registro no Pipedrive: relatório atualizado na fila ao reconcluir; atividade vinculada ao analista; status e reprocessamento.
-- 3) Contas sem utilização: status de utilização, acompanhamento recorrente e alertas sem duplicidade.


-- ============ 0. Administrador Master principal ============
-- Transfere o Master para outra conta já ativa, com e-mail verificado e login Google. A conta anterior continua como Administrador
-- (não é excluída) e a troca é registrada em auditoria. O gatilho dcs_garantir_master impede ficar sem Master ativo.
CREATE OR REPLACE FUNCTION public.dcs_transferir_master(p_novo uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE e text; BEGIN
  IF NOT public.dcs_eh_master() THEN RAISE EXCEPTION 'Somente o Administrador Master' USING ERRCODE='42501'; END IF;
  IF p_novo = auth.uid() THEN RAISE EXCEPTION 'A conta já é o Master'; END IF;
  SELECT lower(u.email) INTO e FROM auth.users u WHERE u.id=p_novo AND u.email_confirmed_at IS NOT NULL;
  IF e IS NULL THEN RAISE EXCEPTION 'Conta de destino inexistente ou sem e-mail verificado'; END IF;
  IF NOT EXISTS (SELECT 1 FROM auth.identities i WHERE i.user_id=p_novo AND i.provider='google') THEN
    RAISE EXCEPTION 'A conta de destino ainda não entrou com o Google';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.account_access a WHERE a.user_id=p_novo AND a.status='ativo') THEN
    RAISE EXCEPTION 'A conta de destino não está ativa';
  END IF;
  -- 1º promove o novo; 2º rebaixa o atual para Administrador (nunca há instante sem Master).
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=p_novo) THEN
    UPDATE public.user_roles SET role='superadmin' WHERE user_id=p_novo;
  ELSE
    INSERT INTO public.user_roles(user_id, role) VALUES (p_novo, 'superadmin');
  END IF;
  UPDATE public.user_roles SET role='admin' WHERE user_id=auth.uid() AND role='superadmin';
  INSERT INTO public.dcs_config(chave,valor) VALUES ('master_principal', jsonb_build_object('user_id',p_novo,'email',e,'desde',now(),'anterior',auth.uid()))
  ON CONFLICT (chave) DO UPDATE SET valor=excluded.valor;
  PERFORM public.dcs_auditar('master', p_novo::text, 'transferir', jsonb_build_object('de',auth.uid(),'para',p_novo,'email',e));
END $$;
REVOKE ALL ON FUNCTION public.dcs_transferir_master(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dcs_transferir_master(uuid) TO authenticated;

-- ============ 1. Usuários ============
CREATE TABLE IF NOT EXISTS public.dcs_pre_cadastros (
  email text PRIMARY KEY CHECK (email = lower(email) AND email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  nome text,
  perfil text NOT NULL CHECK (perfil IN ('admin','cs','contas')),
  financeiro boolean NOT NULL DEFAULT false,
  pode_editar boolean NOT NULL DEFAULT true,
  pode_exportar boolean NOT NULL DEFAULT false,
  ativo boolean NOT NULL DEFAULT true,
  carteiras integer[] NOT NULL DEFAULT '{}',
  clientes text[] NOT NULL DEFAULT '{}',
  pipedrive_user_id integer,
  criado_por uuid, criado_em timestamptz NOT NULL DEFAULT now(), atualizado_em timestamptz NOT NULL DEFAULT now(),
  convite_enviado_em timestamptz, aplicado_em timestamptz, aplicado_user uuid, revogado_em timestamptz
);
ALTER TABLE public.dcs_pre_cadastros ENABLE ROW LEVEL SECURITY;
CREATE POLICY dcs_pre_ler ON public.dcs_pre_cadastros FOR SELECT TO authenticated USING (public.dcs_eh_admin());
REVOKE ALL ON public.dcs_pre_cadastros FROM anon; REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.dcs_pre_cadastros FROM authenticated;
GRANT SELECT ON public.dcs_pre_cadastros TO authenticated; GRANT ALL ON public.dcs_pre_cadastros TO service_role;

-- Cria/edita um usuário do Dinamize CS. Se o e-mail já tem conta, aplica direto; senão guarda o pré-cadastro.
CREATE OR REPLACE FUNCTION public.dcs_salvar_usuario(p_email text, p_nome text, p_perfil text, p_financeiro boolean, p_editar boolean,
  p_exportar boolean, p_ativo boolean, p_carteiras integer[], p_clientes text[], p_pipedrive integer) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE e text := lower(trim(p_email)); u uuid; BEGIN
  IF NOT public.dcs_eh_admin() THEN RAISE EXCEPTION 'Somente administradores' USING ERRCODE='42501'; END IF;
  IF e !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN RAISE EXCEPTION 'E-mail inválido'; END IF;
  IF p_perfil NOT IN ('admin','cs','contas') THEN RAISE EXCEPTION 'Perfil inválido'; END IF;
  IF p_perfil='admin' AND NOT public.dcs_eh_master() THEN
    RAISE EXCEPTION 'Somente o Administrador Master concede o perfil Administrador' USING ERRCODE='42501';
  END IF;
  SELECT id INTO u FROM auth.users WHERE lower(email)=e;
  IF u IS NOT NULL THEN
    IF u = auth.uid() THEN RAISE EXCEPTION 'Não altere o seu próprio acesso' USING ERRCODE='42501'; END IF;
    IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=u AND role='superadmin') THEN
      RAISE EXCEPTION 'O Administrador Master não pode ser alterado por esta tela' USING ERRCODE='42501';
    END IF;
    PERFORM public.dcs_salvar_permissoes(u, p_perfil, p_financeiro, p_editar, p_exportar, p_ativo, p_carteiras, p_clientes,
      (SELECT m.modulos FROM public.dcs_membros m WHERE m.user_id=u));
    UPDATE public.dcs_membros SET pipedrive_user_id=p_pipedrive WHERE user_id=u;
    IF coalesce(trim(p_nome),'')<>'' THEN UPDATE public.profiles SET nome=trim(p_nome) WHERE id=u AND coalesce(nome,'') IN ('', split_part(email,'@',1)); END IF;
    IF p_ativo THEN UPDATE public.account_access SET status='ativo' WHERE user_id=u AND status='pendente'; END IF;
    RETURN jsonb_build_object('modo','aplicado','user_id',u);
  END IF;
  INSERT INTO public.dcs_pre_cadastros(email,nome,perfil,financeiro,pode_editar,pode_exportar,ativo,carteiras,clientes,pipedrive_user_id,criado_por)
  VALUES (e,nullif(trim(p_nome),''),p_perfil,p_financeiro,p_editar,p_exportar,p_ativo,coalesce(p_carteiras,'{}'),coalesce(p_clientes,'{}'),p_pipedrive,auth.uid())
  ON CONFLICT (email) DO UPDATE SET nome=excluded.nome, perfil=excluded.perfil, financeiro=excluded.financeiro, pode_editar=excluded.pode_editar,
    pode_exportar=excluded.pode_exportar, ativo=excluded.ativo, carteiras=excluded.carteiras, clientes=excluded.clientes,
    pipedrive_user_id=excluded.pipedrive_user_id, revogado_em=NULL, atualizado_em=now();
  PERFORM public.dcs_auditar('pre_cadastro', e, 'salvar', jsonb_build_object('perfil',p_perfil,'financeiro',p_financeiro,'editar',p_editar,
    'exportar',p_exportar,'ativo',p_ativo,'carteiras',p_carteiras,'clientes',p_clientes,'pipedrive',p_pipedrive));
  RETURN jsonb_build_object('modo','pre_cadastro','email',e);
END $$;

CREATE OR REPLACE FUNCTION public.dcs_revogar_pre_cadastro(p_email text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
  IF NOT public.dcs_eh_admin() THEN RAISE EXCEPTION 'Somente administradores' USING ERRCODE='42501'; END IF;
  UPDATE public.dcs_pre_cadastros SET revogado_em=now(), ativo=false, atualizado_em=now() WHERE email=lower(trim(p_email)) AND aplicado_em IS NULL;
  PERFORM public.dcs_auditar('pre_cadastro', lower(trim(p_email)), 'revogar', NULL);
END $$;

CREATE OR REPLACE FUNCTION public.dcs_registrar_convite(p_email text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
  IF NOT public.dcs_eh_admin() THEN RAISE EXCEPTION 'Somente administradores' USING ERRCODE='42501'; END IF;
  UPDATE public.dcs_pre_cadastros SET convite_enviado_em=now() WHERE email=lower(trim(p_email));
  PERFORM public.dcs_auditar('pre_cadastro', lower(trim(p_email)), 'convite', NULL);
END $$;

-- Aplica o pré-cadastro ao usuário logado. A identidade vem do Supabase Auth (e-mail verificado), nunca da interface.
CREATE OR REPLACE FUNCTION public.dcs_reivindicar_acesso() RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE e text; p public.dcs_pre_cadastros; BEGIN
  SELECT lower(email) INTO e FROM auth.users WHERE id=auth.uid() AND email_confirmed_at IS NOT NULL;
  IF e IS NULL THEN RETURN false; END IF;
  SELECT * INTO p FROM public.dcs_pre_cadastros WHERE email=e AND aplicado_em IS NULL AND revogado_em IS NULL AND ativo FOR UPDATE;
  IF p.email IS NULL THEN RETURN false; END IF;
  INSERT INTO public.dcs_membros(user_id,perfil,financeiro,pode_editar,pode_exportar,ativo,carteiras,clientes,pipedrive_user_id,convidado_por)
  VALUES (auth.uid(),p.perfil,p.financeiro,p.pode_editar,p.pode_exportar,true,p.carteiras,p.clientes,p.pipedrive_user_id,p.criado_por)
  ON CONFLICT (user_id) DO UPDATE SET perfil=excluded.perfil, financeiro=excluded.financeiro, pode_editar=excluded.pode_editar, pode_exportar=excluded.pode_exportar,
    ativo=true, carteiras=excluded.carteiras, clientes=excluded.clientes, pipedrive_user_id=excluded.pipedrive_user_id, atualizado_em=now();
  UPDATE public.account_access SET status='ativo' WHERE user_id=auth.uid() AND status='pendente';
  IF p.nome IS NOT NULL THEN UPDATE public.profiles SET nome=p.nome WHERE id=auth.uid() AND coalesce(nome,'') IN ('', split_part(email,'@',1)); END IF;
  UPDATE public.dcs_pre_cadastros SET aplicado_em=now(), aplicado_user=auth.uid() WHERE email=e;
  INSERT INTO public.dcs_auditoria(ator,entidade,entidade_id,acao,dados) VALUES (auth.uid(),'pre_cadastro',e,'aplicado',jsonb_build_object('perfil',p.perfil));
  RETURN true;
END $$;

-- Lista de usuários com o vínculo do Pipedrive (substitui a versão anterior; só leitura de metadados).
DROP FUNCTION IF EXISTS public.dcs_listar_usuarios();
CREATE FUNCTION public.dcs_listar_usuarios() RETURNS TABLE(user_id uuid, nome text, email text, status text, papel text, ultimo_acesso timestamptz,
  perfil text, financeiro boolean, pode_editar boolean, pode_exportar boolean, ativo boolean, carteiras integer[], clientes text[], modulos text[],
  pipedrive_user_id integer, master_principal boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE mp uuid := (SELECT nullif(valor->>'user_id','')::uuid FROM public.dcs_config WHERE chave='master_principal'); BEGIN
  IF NOT public.dcs_eh_admin() THEN RAISE EXCEPTION 'Somente administradores' USING ERRCODE='42501'; END IF;
  RETURN QUERY SELECT p.id, p.nome, p.email, coalesce(a.status,'pendente'), coalesce(r.role::text,'user'), a.last_access_at,
    CASE WHEN r.role IN ('superadmin','admin') THEN 'admin' ELSE m.perfil END, coalesce(m.financeiro, r.role IN ('superadmin','admin')),
    coalesce(m.pode_editar, true), coalesce(m.pode_exportar, r.role IN ('superadmin','admin')), coalesce(m.ativo,false) OR r.role IN ('superadmin','admin'),
    coalesce(m.carteiras,'{}'), coalesce(m.clientes,'{}'), m.modulos,
    coalesce(m.pipedrive_user_id, (SELECT x.pipedrive_user_id FROM public.dcs_responsaveis x WHERE lower(x.email)=lower(p.email) LIMIT 1)),
    p.id = mp
  FROM public.profiles p LEFT JOIN public.account_access a ON a.user_id=p.id LEFT JOIN public.user_roles r ON r.user_id=p.id
  LEFT JOIN public.dcs_membros m ON m.user_id=p.id ORDER BY p.nome;
END $$;

-- ============ 2. Registro no Pipedrive ============
-- Usuário do Pipedrive do analista: vínculo explícito em dcs_membros ou e-mail igual ao do responsável sincronizado (nunca só pelo nome).
CREATE OR REPLACE FUNCTION public.dcs_pipedrive_do_usuario(p_user uuid) RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT coalesce(
    (SELECT m.pipedrive_user_id FROM public.dcs_membros m WHERE m.user_id=p_user AND m.pipedrive_user_id IS NOT NULL),
    (SELECT r.pipedrive_user_id FROM public.dcs_responsaveis r JOIN auth.users u ON lower(u.email)=lower(r.email) WHERE u.id=p_user AND r.ativo LIMIT 1)) $$;

CREATE OR REPLACE FUNCTION public.dcs_concluir_analise(p_id uuid, p_versao integer, p_resumo text, p_derivado jsonb, p_acoes jsonb, p_proxima_revisao date, p_registrar_pipedrive boolean)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE d public.dcs_diagnosticos; c public.dcs_clientes; j uuid; x jsonb; aid uuid; ativa boolean; payload jsonb; BEGIN
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
    ativa := coalesce((SELECT (valor->>'ativa')::boolean FROM public.dcs_config WHERE chave='pipedrive_escrita'),false);
    payload := jsonb_build_object('diagnostico_id',p_id,'deal_id',c.deal_id,'org_id',c.org_id,'person_id',c.person_id,'owner_id',c.owner_id,
        'user_id',public.dcs_pipedrive_do_usuario(d.analista_id),'ciclo',d.ciclo,'cliente',c.nome,
        'subject','CS | Diagnóstico de utilização — Dinamize Marketing','resumo',p_resumo,'marca','DZCS-'||d.cliente_key||'-C'||d.ciclo,
        'data',(now() AT TIME ZONE 'America/Sao_Paulo')::date);
    -- Uma atividade por cliente e ciclo (chave única). Reconclusão: atualiza o relatório; se já registrado, a atividade existente é atualizada.
    INSERT INTO public.dcs_jobs AS t(tipo,chave,payload,status,criado_por)
    VALUES ('pipedrive_atividade_diagnostico', 'DZCS-'||d.cliente_key||'-C'||d.ciclo, payload, CASE WHEN ativa THEN 'pendente' ELSE 'aguardando_autorizacao' END, auth.uid())
    ON CONFLICT (chave) DO UPDATE SET payload=excluded.payload,
      status=CASE WHEN t.status='processando' THEN t.status WHEN ativa THEN 'pendente' ELSE 'aguardando_autorizacao' END,
      tentativas=CASE WHEN t.status='processando' THEN t.tentativas ELSE 0 END, proxima_tentativa=now(), erro=NULL, atualizado_em=now()
    RETURNING id INTO j;
  END IF;
  RETURN j; END $$;

-- Situação do registro no Pipedrive de um diagnóstico (para quem vê o cliente).
CREATE OR REPLACE FUNCTION public.dcs_status_registro(p_diag uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE d public.dcs_diagnosticos; c public.dcs_clientes; j public.dcs_jobs; BEGIN
  SELECT * INTO d FROM public.dcs_diagnosticos WHERE id=p_diag;
  SELECT * INTO c FROM public.dcs_clientes WHERE key=d.cliente_key;
  IF d.id IS NULL OR NOT public.dcs_pode_ver(c.owner_id,c.key) THEN RETURN NULL; END IF;
  SELECT * INTO j FROM public.dcs_jobs WHERE chave='DZCS-'||d.cliente_key||'-C'||d.ciclo;
  IF j.id IS NULL THEN RETURN jsonb_build_object('status','sem_registro'); END IF;
  RETURN jsonb_build_object('status',j.status,'tentativas',j.tentativas,'erro',j.erro,'atualizado_em',j.atualizado_em,
    'activity_id',j.resultado->'activity_id','deal_id',coalesce(j.resultado->'deal_id',j.payload->'deal_id'),
    'escrita_ativa',coalesce((SELECT (valor->>'ativa')::boolean FROM public.dcs_config WHERE chave='pipedrive_escrita'),false));
END $$;

-- Reprocessar (admin ou analista do diagnóstico). Só volta para a fila se a gravação estiver ativa.
CREATE OR REPLACE FUNCTION public.dcs_reprocessar_registro(p_diag uuid) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE d public.dcs_diagnosticos; ativa boolean; n int; BEGIN
  SELECT * INTO d FROM public.dcs_diagnosticos WHERE id=p_diag;
  IF d.id IS NULL OR (d.analista_id<>auth.uid() AND NOT public.dcs_eh_admin()) THEN RAISE EXCEPTION 'Sem permissão' USING ERRCODE='42501'; END IF;
  ativa := coalesce((SELECT (valor->>'ativa')::boolean FROM public.dcs_config WHERE chave='pipedrive_escrita'),false);
  UPDATE public.dcs_jobs SET status=CASE WHEN ativa THEN 'pendente' ELSE 'aguardando_autorizacao' END, tentativas=0, proxima_tentativa=now(), erro=NULL, atualizado_em=now()
   WHERE chave='DZCS-'||d.cliente_key||'-C'||d.ciclo AND status IN ('falha','ambiguo','aguardando_autorizacao');
  GET DIAGNOSTICS n = ROW_COUNT;
  PERFORM public.dcs_auditar('job', 'DZCS-'||d.cliente_key||'-C'||d.ciclo, 'reprocessar', jsonb_build_object('ativa',ativa));
  RETURN CASE WHEN n=0 THEN 'nada' WHEN ativa THEN 'pendente' ELSE 'aguardando_autorizacao' END;
END $$;

-- Ativar/desativar gravação real no Pipedrive (somente Master). Não libera automaticamente registros antigos.
CREATE OR REPLACE FUNCTION public.dcs_definir_escrita_pipedrive(p_ativa boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
  IF NOT public.dcs_eh_master() THEN RAISE EXCEPTION 'Somente o Administrador Master' USING ERRCODE='42501'; END IF;
  INSERT INTO public.dcs_config(chave,valor) VALUES ('pipedrive_escrita', jsonb_build_object('ativa',p_ativa))
  ON CONFLICT (chave) DO UPDATE SET valor=jsonb_build_object('ativa',p_ativa);
  PERFORM public.dcs_auditar('config','pipedrive_escrita', CASE WHEN p_ativa THEN 'ativar' ELSE 'desativar' END, NULL);
END $$;

-- ============ 3. Contas sem utilização ============
CREATE TABLE IF NOT EXISTS public.dcs_utilizacao (
  cliente_key text PRIMARY KEY REFERENCES public.dcs_clientes(key) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'nao_verificado' CHECK (status IN ('nao_verificado','em_uso','sem_uso')),
  acompanhamento text CHECK (acompanhamento IN ('aguardando','em_dia','retomada_em_andamento','retomada')),
  sem_uso_desde date,
  ultima_utilizacao date,
  ultima_desconhecida boolean NOT NULL DEFAULT false,
  motivo text, observacoes text, evidencias text, acao_retomada text,
  responsavel_id uuid, proxima_revisao date, intervalo_dias integer CHECK (intervalo_dias IS NULL OR intervalo_dias BETWEEN 1 AND 365),
  ultimo_acompanhamento timestamptz, recuperado_em date,
  atualizado_em timestamptz NOT NULL DEFAULT now(), atualizado_por uuid, versao integer NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS public.dcs_utilizacao_eventos (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  cliente_key text NOT NULL REFERENCES public.dcs_clientes(key) ON DELETE CASCADE,
  em timestamptz NOT NULL DEFAULT now(), ator uuid,
  tipo text NOT NULL CHECK (tipo IN ('marcar','revisar','em_uso','editar')),
  resultado text CHECK (resultado IS NULL OR resultado IN ('continua','parcial','retomou','nao_validado')),
  dados jsonb
);
CREATE INDEX IF NOT EXISTS dcs_utilizacao_eventos_cliente ON public.dcs_utilizacao_eventos(cliente_key, em DESC);
ALTER TABLE public.dcs_utilizacao ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dcs_utilizacao_eventos ENABLE ROW LEVEL SECURITY;
CREATE POLICY dcs_util_ler ON public.dcs_utilizacao FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.dcs_clientes c WHERE c.key=cliente_key AND public.dcs_pode_ver(c.owner_id,c.key)));
CREATE POLICY dcs_util_ev_ler ON public.dcs_utilizacao_eventos FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.dcs_clientes c WHERE c.key=cliente_key AND public.dcs_pode_ver(c.owner_id,c.key)));
REVOKE ALL ON public.dcs_utilizacao, public.dcs_utilizacao_eventos FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.dcs_utilizacao, public.dcs_utilizacao_eventos FROM authenticated;
GRANT SELECT ON public.dcs_utilizacao, public.dcs_utilizacao_eventos TO authenticated;
GRANT ALL ON public.dcs_utilizacao, public.dcs_utilizacao_eventos TO service_role;

CREATE OR REPLACE FUNCTION public.dcs_exigir_atuacao(p_key text) RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE c public.dcs_clientes; BEGIN
  SELECT * INTO c FROM public.dcs_clientes WHERE key=p_key;
  IF c.key IS NULL OR NOT public.dcs_pode_ver(c.owner_id,c.key) OR NOT public.dcs_pode_editar() THEN
    RAISE EXCEPTION 'Cliente não encontrado ou sem permissão de edição' USING ERRCODE='42501';
  END IF;
END $$;

-- Marcar (ou editar) conta sem utilização. A data da última utilização pode ser desconhecida (nunca inventada).
CREATE OR REPLACE FUNCTION public.dcs_marcar_sem_utilizacao(p_key text, p_ultima date, p_desconhecida boolean, p_motivo text, p_obs text,
  p_evidencias text, p_responsavel uuid, p_proxima date, p_acao text, p_intervalo integer) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE hoje date := (now() AT TIME ZONE 'America/Sao_Paulo')::date; ant public.dcs_utilizacao; BEGIN
  PERFORM public.dcs_exigir_atuacao(p_key);
  IF coalesce(trim(p_motivo),'')='' THEN RAISE EXCEPTION 'Informe o motivo'; END IF;
  IF p_proxima IS NULL OR p_proxima < hoje THEN RAISE EXCEPTION 'Informe a próxima revisão (hoje ou depois)'; END IF;
  IF NOT coalesce(p_desconhecida,false) AND p_ultima IS NULL THEN RAISE EXCEPTION 'Informe a última utilização ou marque como desconhecida'; END IF;
  IF p_ultima > hoje THEN RAISE EXCEPTION 'A última utilização não pode ser futura'; END IF;
  SELECT * INTO ant FROM public.dcs_utilizacao WHERE cliente_key=p_key FOR UPDATE;
  INSERT INTO public.dcs_utilizacao AS t(cliente_key,status,acompanhamento,sem_uso_desde,ultima_utilizacao,ultima_desconhecida,motivo,observacoes,evidencias,
    acao_retomada,responsavel_id,proxima_revisao,intervalo_dias,ultimo_acompanhamento,atualizado_por)
  VALUES (p_key,'sem_uso','aguardando',hoje,CASE WHEN p_desconhecida THEN NULL ELSE p_ultima END,coalesce(p_desconhecida,false),p_motivo,p_obs,p_evidencias,
    p_acao,coalesce(p_responsavel,auth.uid()),p_proxima,p_intervalo,now(),auth.uid())
  ON CONFLICT (cliente_key) DO UPDATE SET status='sem_uso',
    acompanhamento=CASE WHEN t.status='sem_uso' THEN t.acompanhamento ELSE 'aguardando' END,
    sem_uso_desde=CASE WHEN t.status='sem_uso' THEN t.sem_uso_desde ELSE hoje END,
    ultima_utilizacao=excluded.ultima_utilizacao, ultima_desconhecida=excluded.ultima_desconhecida, motivo=excluded.motivo, observacoes=excluded.observacoes,
    evidencias=excluded.evidencias, acao_retomada=excluded.acao_retomada, responsavel_id=excluded.responsavel_id, proxima_revisao=excluded.proxima_revisao,
    intervalo_dias=excluded.intervalo_dias, recuperado_em=CASE WHEN t.status='sem_uso' THEN t.recuperado_em ELSE NULL END,
    atualizado_em=now(), atualizado_por=auth.uid(), versao=t.versao+1;
  INSERT INTO public.dcs_utilizacao_eventos(cliente_key,ator,tipo,dados) VALUES (p_key,auth.uid(), CASE WHEN ant.status='sem_uso' THEN 'editar' ELSE 'marcar' END,
    jsonb_build_object('motivo',p_motivo,'ultima_utilizacao',p_ultima,'desconhecida',p_desconhecida,'proxima_revisao',p_proxima,'acao',p_acao,'obs',p_obs,'evidencias',p_evidencias));
END $$;

-- Revisão simplificada de uma conta sem utilização.
CREATE OR REPLACE FUNCTION public.dcs_revisar_utilizacao(p_key text, p_resultado text, p_ultima date, p_obs text, p_proxima date) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE hoje date := (now() AT TIME ZONE 'America/Sao_Paulo')::date; u public.dcs_utilizacao; BEGIN
  PERFORM public.dcs_exigir_atuacao(p_key);
  SELECT * INTO u FROM public.dcs_utilizacao WHERE cliente_key=p_key FOR UPDATE;
  IF u.cliente_key IS NULL OR u.status<>'sem_uso' THEN RAISE EXCEPTION 'A conta não está marcada como sem utilização'; END IF;
  IF p_resultado NOT IN ('continua','parcial','retomou','nao_validado') THEN RAISE EXCEPTION 'Resultado inválido'; END IF;
  IF p_resultado<>'retomou' AND (p_proxima IS NULL OR p_proxima < hoje) THEN RAISE EXCEPTION 'Programe a próxima revisão'; END IF;
  IF p_ultima > hoje THEN RAISE EXCEPTION 'A última utilização não pode ser futura'; END IF;
  UPDATE public.dcs_utilizacao SET
    status=CASE WHEN p_resultado='retomou' THEN 'em_uso' ELSE 'sem_uso' END,
    acompanhamento=CASE p_resultado WHEN 'retomou' THEN 'retomada' WHEN 'parcial' THEN 'retomada_em_andamento' ELSE 'em_dia' END,
    ultima_utilizacao=coalesce(p_ultima, ultima_utilizacao), ultima_desconhecida=CASE WHEN p_ultima IS NOT NULL THEN false ELSE ultima_desconhecida END,
    proxima_revisao=CASE WHEN p_resultado='retomou' THEN NULL ELSE p_proxima END,
    recuperado_em=CASE WHEN p_resultado='retomou' THEN hoje ELSE NULL END,
    ultimo_acompanhamento=now(), atualizado_em=now(), atualizado_por=auth.uid(), versao=versao+1
  WHERE cliente_key=p_key;
  INSERT INTO public.dcs_utilizacao_eventos(cliente_key,ator,tipo,resultado,dados)
  VALUES (p_key,auth.uid(),'revisar',p_resultado,jsonb_build_object('ultima_utilizacao',p_ultima,'obs',p_obs,'proxima_revisao',p_proxima));
END $$;

-- Confirma utilização (conta verificada em uso), sem passar pela condição de risco.
CREATE OR REPLACE FUNCTION public.dcs_confirmar_utilizacao(p_key text, p_obs text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
  PERFORM public.dcs_exigir_atuacao(p_key);
  IF EXISTS (SELECT 1 FROM public.dcs_utilizacao WHERE cliente_key=p_key AND status='sem_uso') THEN
    RAISE EXCEPTION 'Conta sem utilização: registre a retomada pela revisão';
  END IF;
  INSERT INTO public.dcs_utilizacao AS t(cliente_key,status,ultimo_acompanhamento,atualizado_por) VALUES (p_key,'em_uso',now(),auth.uid())
  ON CONFLICT (cliente_key) DO UPDATE SET status='em_uso', ultimo_acompanhamento=now(), atualizado_em=now(), atualizado_por=auth.uid(), versao=t.versao+1;
  INSERT INTO public.dcs_utilizacao_eventos(cliente_key,ator,tipo,dados) VALUES (p_key,auth.uid(),'em_uso',jsonb_build_object('obs',p_obs));
END $$;

-- Alertas: inclui revisões vencidas de contas sem utilização. Recalculados por inteiro (sem duplicar ocorrências).
ALTER TABLE public.dcs_alertas DROP CONSTRAINT IF EXISTS dcs_alertas_tipo_check;
ALTER TABLE public.dcs_alertas ADD CONSTRAINT dcs_alertas_tipo_check
  CHECK (tipo IN ('revisao_vencida','acao_atrasada','cobertura_critica','oportunidade_critica','utilizacao_revisao'));
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
   WHERE u.status='sem_uso' AND u.proxima_revisao<hoje;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n; END $$;

-- ============ Permissões ============
REVOKE ALL ON FUNCTION public.dcs_salvar_usuario(text,text,text,boolean,boolean,boolean,boolean,integer[],text[],integer), public.dcs_revogar_pre_cadastro(text),
  public.dcs_registrar_convite(text), public.dcs_reivindicar_acesso(), public.dcs_listar_usuarios(), public.dcs_status_registro(uuid), public.dcs_reprocessar_registro(uuid),
  public.dcs_definir_escrita_pipedrive(boolean), public.dcs_marcar_sem_utilizacao(text,date,boolean,text,text,text,uuid,date,text,integer),
  public.dcs_revisar_utilizacao(text,text,date,text,date), public.dcs_confirmar_utilizacao(text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dcs_salvar_usuario(text,text,text,boolean,boolean,boolean,boolean,integer[],text[],integer), public.dcs_revogar_pre_cadastro(text),
  public.dcs_registrar_convite(text), public.dcs_reivindicar_acesso(), public.dcs_listar_usuarios(), public.dcs_status_registro(uuid), public.dcs_reprocessar_registro(uuid),
  public.dcs_definir_escrita_pipedrive(boolean), public.dcs_marcar_sem_utilizacao(text,date,boolean,text,text,text,uuid,date,text,integer),
  public.dcs_revisar_utilizacao(text,text,date,text,date), public.dcs_confirmar_utilizacao(text,text) TO authenticated;
REVOKE ALL ON FUNCTION public.dcs_pipedrive_do_usuario(uuid), public.dcs_exigir_atuacao(text) FROM PUBLIC, anon, authenticated;
