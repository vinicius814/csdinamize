-- Dinamize CS — funções usadas pelos workflows n8n 04, 05, 07 e 08 (aditiva).

CREATE TABLE public.dcs_responsaveis (
  pipedrive_user_id integer PRIMARY KEY,
  nome text NOT NULL,
  email text,
  ativo boolean NOT NULL,
  visto_em timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.dcs_responsaveis ENABLE ROW LEVEL SECURITY;
-- Somente nome/ativo interessam ao app; e-mail fica restrito a administradores pela view abaixo.
CREATE POLICY dcs_resp_ler ON public.dcs_responsaveis FOR SELECT TO authenticated USING (public.dcs_eh_admin());
GRANT SELECT ON public.dcs_responsaveis TO authenticated; GRANT ALL ON public.dcs_responsaveis TO service_role;
CREATE VIEW public.dcs_responsaveis_publico WITH (security_barrier) AS
  SELECT pipedrive_user_id, nome, ativo FROM public.dcs_responsaveis WHERE public.dcs_perfil() IS NOT NULL;
GRANT SELECT ON public.dcs_responsaveis_publico TO authenticated;

CREATE OR REPLACE FUNCTION public.dcs_publicar_responsaveis(p_run uuid, p_users jsonb) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE n int; BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.dcs_sync_execucoes WHERE id=p_run AND tipo='responsaveis' AND status='executando') THEN RAISE EXCEPTION 'Sincronização não está em execução'; END IF;
  IF jsonb_typeof(p_users)<>'array' OR jsonb_array_length(p_users)=0 THEN RAISE EXCEPTION 'Lista de usuários vazia: nada alterado'; END IF;
  INSERT INTO public.dcs_responsaveis(pipedrive_user_id,nome,email,ativo,visto_em)
  SELECT x.id, x.nome, x.email, x.ativo, now() FROM jsonb_to_recordset(p_users) AS x(id integer, nome text, email text, ativo boolean) WHERE x.id IS NOT NULL
  ON CONFLICT (pipedrive_user_id) DO UPDATE SET nome=excluded.nome, email=excluded.email, ativo=excluded.ativo, visto_em=now();
  GET DIAGNOSTICS n = ROW_COUNT;
  -- Nomes exibidos na carteira acompanham o Pipedrive (o vínculo é pelo ID, nunca pelo nome).
  UPDATE public.dcs_clientes c SET owner_nome=r.nome FROM public.dcs_responsaveis r WHERE c.owner_id=r.pipedrive_user_id AND c.owner_nome IS DISTINCT FROM r.nome;
  UPDATE public.dcs_sync_execucoes SET status='sucesso', concluido_em=now(), lidos=n, completo=true WHERE id=p_run;
  RETURN n; END $$;

CREATE OR REPLACE FUNCTION public.dcs_clientes_para_cobertura() RETURNS TABLE(key text, deal_ids bigint[], org_id bigint, person_id bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT key, deal_ids, org_id, person_id FROM public.dcs_clientes WHERE ativo $$;

CREATE OR REPLACE FUNCTION public.dcs_registrar_log(p_origem text, p_nivel text, p_mensagem text, p_dados jsonb) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
  INSERT INTO public.dcs_integracao_logs(origem,nivel,mensagem,dados) VALUES (left(p_origem,120), CASE WHEN p_nivel IN ('info','aviso','erro') THEN p_nivel ELSE 'erro' END, left(coalesce(p_mensagem,'(sem mensagem)'),2000), p_dados) $$;

-- Jobs ambíguos voltam à fila: o workflow 06 confere pela marca DZCS antes de criar (sem duplicar).
CREATE OR REPLACE FUNCTION public.dcs_reenfileirar_jobs() RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE n int; BEGIN
  UPDATE public.dcs_jobs SET status='pendente', travado_em=NULL, atualizado_em=now()
   WHERE (status='ambiguo' OR status='processando' AND travado_em<now()-interval '15 minutes') AND tentativas<5;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF EXISTS (SELECT 1 FROM public.dcs_jobs WHERE status IN ('falha','ambiguo') AND tentativas>=5) THEN
    INSERT INTO public.dcs_integracao_logs(origem,nivel,mensagem) VALUES ('fila','erro','Há operações com 5 tentativas sem sucesso: reprocessar manualmente em Configurações → Integrações');
  END IF;
  RETURN n; END $$;

-- Alertas internos (workflow 08). Recalculados por inteiro a cada execução.
CREATE TABLE public.dcs_alertas (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tipo text NOT NULL CHECK (tipo IN ('revisao_vencida','acao_atrasada','cobertura_critica','oportunidade_critica')),
  cliente_key text NOT NULL REFERENCES public.dcs_clientes(key) ON DELETE CASCADE,
  referencia text,
  detalhe jsonb,
  gerado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tipo, cliente_key, referencia)
);
ALTER TABLE public.dcs_alertas ENABLE ROW LEVEL SECURITY;
CREATE POLICY dcs_alertas_ler ON public.dcs_alertas FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.dcs_clientes c WHERE c.key=cliente_key AND public.dcs_pode_ver(c.owner_id,c.key)));
GRANT SELECT ON public.dcs_alertas TO authenticated; GRANT ALL ON public.dcs_alertas TO service_role;

CREATE OR REPLACE FUNCTION public.dcs_atualizar_alertas() RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE hoje date := (now() AT TIME ZONE 'America/Sao_Paulo')::date; lim int; n int; BEGIN
  SELECT coalesce((config->'cov'->>'pendente')::int, 60) INTO lim FROM public.dcs_regras WHERE ativa;
  DELETE FROM public.dcs_alertas;
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
  SELECT 'cobertura_critica', c.key, NULL, jsonb_build_object('ultimo_efetivo',cb.ultimo_efetivo->>'date')
    FROM public.dcs_clientes c LEFT JOIN public.dcs_cobertura cb ON cb.key=c.key
   WHERE c.ativo AND cb.key IS NOT NULL AND (cb.ultimo_efetivo IS NULL OR (cb.ultimo_efetivo->>'date')::date < hoje-lim)
  UNION ALL
  SELECT 'oportunidade_critica', a.cliente_key, a.id::text, jsonb_build_object('acao',a.acao)
    FROM public.dcs_acoes a JOIN public.dcs_clientes c ON c.key=a.cliente_key AND c.ativo
   WHERE NOT a.obsoleta AND a.prioridade='critica' AND a.status NOT IN ('implementado','nao_aprovado');
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n; END $$;

REVOKE ALL ON FUNCTION public.dcs_publicar_responsaveis(uuid,jsonb), public.dcs_clientes_para_cobertura(), public.dcs_registrar_log(text,text,text,jsonb),
  public.dcs_reenfileirar_jobs(), public.dcs_atualizar_alertas() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.dcs_publicar_responsaveis(uuid,jsonb), public.dcs_clientes_para_cobertura(), public.dcs_registrar_log(text,text,text,jsonb),
  public.dcs_reenfileirar_jobs(), public.dcs_atualizar_alertas() TO service_role;

REVOKE ALL ON public.dcs_responsaveis, public.dcs_alertas, public.dcs_responsaveis_publico FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.dcs_responsaveis, public.dcs_alertas FROM authenticated;
