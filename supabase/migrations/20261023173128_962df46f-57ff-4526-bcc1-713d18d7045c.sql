CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;
CREATE TABLE public.areas(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL REFERENCES public.profiles(id),nome text NOT NULL,cor text NOT NULL DEFAULT 'azul',icone text NOT NULL DEFAULT 'briefcase',created_at timestamptz NOT NULL DEFAULT now(),atualizado_em timestamptz NOT NULL DEFAULT now(),UNIQUE(user_id,nome));
GRANT SELECT,INSERT,UPDATE,DELETE ON public.areas TO authenticated; GRANT ALL ON public.areas TO service_role;
ALTER TABLE public.areas ENABLE ROW LEVEL SECURITY;
CREATE POLICY areas_own ON public.areas FOR ALL TO authenticated USING(user_id=auth.uid() AND public.account_active()) WITH CHECK(user_id=auth.uid() AND public.account_active());
CREATE TABLE public.itens(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL REFERENCES public.profiles(id),tipo text NOT NULL DEFAULT 'nota',titulo text NOT NULL,conteudo text NOT NULL DEFAULT '',area_id uuid REFERENCES public.areas(id) ON DELETE SET NULL,status text NOT NULL DEFAULT 'aberto',data_alvo timestamptz,pessoa text,prioridade integer NOT NULL DEFAULT 2,origem text NOT NULL DEFAULT 'manual',projeto_id uuid REFERENCES public.itens(id) ON DELETE SET NULL,embedding extensions.vector(3072),potencial integer NOT NULL DEFAULT 3,proximo_passo text,legacy_nota_id uuid UNIQUE,legacy_data jsonb,created_at timestamptz NOT NULL DEFAULT now(),atualizado_em timestamptz NOT NULL DEFAULT now());
GRANT SELECT,INSERT,UPDATE,DELETE ON public.itens TO authenticated; GRANT ALL ON public.itens TO service_role;
ALTER TABLE public.itens ENABLE ROW LEVEL SECURITY;
CREATE POLICY itens_own ON public.itens FOR ALL TO authenticated USING(user_id=auth.uid() AND public.account_active()) WITH CHECK(user_id=auth.uid() AND public.account_active());
CREATE TABLE public.ligacoes(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL REFERENCES public.profiles(id),item_a uuid NOT NULL REFERENCES public.itens(id) ON DELETE CASCADE,item_b uuid NOT NULL REFERENCES public.itens(id) ON DELETE CASCADE,motivo text NOT NULL,origem text NOT NULL DEFAULT 'sugerida',created_at timestamptz NOT NULL DEFAULT now(),atualizado_em timestamptz NOT NULL DEFAULT now(),UNIQUE(item_a,item_b));
GRANT SELECT,INSERT,UPDATE,DELETE ON public.ligacoes TO authenticated; GRANT ALL ON public.ligacoes TO service_role;
ALTER TABLE public.ligacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY ligacoes_own ON public.ligacoes FOR ALL TO authenticated USING(user_id=auth.uid() AND public.account_active()) WITH CHECK(user_id=auth.uid() AND public.account_active());
CREATE TABLE public.conversas(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL REFERENCES public.profiles(id),titulo text NOT NULL DEFAULT 'Nova conversa',area_id uuid REFERENCES public.areas(id) ON DELETE SET NULL,resumo text NOT NULL DEFAULT '',fixada boolean NOT NULL DEFAULT false,arquivada boolean NOT NULL DEFAULT false,created_at timestamptz NOT NULL DEFAULT now(),atualizado_em timestamptz NOT NULL DEFAULT now());
GRANT SELECT,INSERT,UPDATE,DELETE ON public.conversas TO authenticated; GRANT ALL ON public.conversas TO service_role;
ALTER TABLE public.conversas ENABLE ROW LEVEL SECURITY;
CREATE POLICY conversas_own ON public.conversas FOR ALL TO authenticated USING(user_id=auth.uid() AND public.account_active()) WITH CHECK(user_id=auth.uid() AND public.account_active());
ALTER TABLE public.mensagens ADD COLUMN conversa_id uuid REFERENCES public.conversas(id) ON DELETE SET NULL;
CREATE TABLE public.preferencias_munim(user_id uuid PRIMARY KEY REFERENCES public.profiles(id),autonomia jsonb NOT NULL DEFAULT '{"ideia":"anotar","lembrete":"anotar","compromisso":"perguntar","promessa":"anotar","atividade":"anotar","projeto":"perguntar","nota":"anotar"}',perguntas_dia integer NOT NULL DEFAULT 3,sugestoes_dia integer NOT NULL DEFAULT 3,telegram_inicio time NOT NULL DEFAULT '08:00',telegram_fim time NOT NULL DEFAULT '20:00',memoria_compacta text NOT NULL DEFAULT '',memoria_atualizada_em timestamptz,pergunta_respondida_em date,ai_pausada boolean NOT NULL DEFAULT false,ai_erro text,created_at timestamptz NOT NULL DEFAULT now(),atualizado_em timestamptz NOT NULL DEFAULT now());
GRANT SELECT,INSERT,UPDATE ON public.preferencias_munim TO authenticated; GRANT ALL ON public.preferencias_munim TO service_role;
ALTER TABLE public.preferencias_munim ENABLE ROW LEVEL SECURITY;
CREATE POLICY preferencias_own ON public.preferencias_munim FOR ALL TO authenticated USING(user_id=auth.uid() AND public.account_active()) WITH CHECK(user_id=auth.uid() AND public.account_active());
CREATE TABLE public.item_embeddings(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL REFERENCES public.profiles(id),item_id uuid NOT NULL REFERENCES public.itens(id) ON DELETE CASCADE,chunk_index integer NOT NULL,conteudo text NOT NULL,embedding extensions.vector(3072) NOT NULL,model text NOT NULL DEFAULT 'google/gemini-embedding-2',created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(item_id,chunk_index));
GRANT SELECT ON public.item_embeddings TO authenticated; GRANT ALL ON public.item_embeddings TO service_role;
ALTER TABLE public.item_embeddings ENABLE ROW LEVEL SECURITY;
CREATE POLICY embeddings_own ON public.item_embeddings FOR SELECT TO authenticated USING(user_id=auth.uid() AND public.account_active());
CREATE FUNCTION public.validar_munim_relacoes() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN
IF TG_OP='UPDATE' AND NEW.user_id IS DISTINCT FROM OLD.user_id THEN RAISE EXCEPTION 'Dono protegido'; END IF;
IF TG_TABLE_NAME IN ('itens','conversas') THEN
IF NEW.area_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.areas WHERE id=NEW.area_id AND user_id=NEW.user_id) THEN RAISE EXCEPTION 'Área inválida'; END IF;
END IF;
IF TG_TABLE_NAME='itens' THEN
IF NEW.tipo NOT IN ('ideia','lembrete','compromisso','promessa','atividade','projeto','nota') OR NEW.status NOT IN ('aberto','em andamento','concluído','arquivado') OR NEW.origem NOT IN ('chat','telegram','manual') OR length(NEW.titulo) NOT BETWEEN 1 AND 200 OR NEW.prioridade NOT BETWEEN 1 AND 3 THEN RAISE EXCEPTION 'Item inválido'; END IF;
IF NEW.projeto_id IS NOT NULL AND (NEW.projeto_id=NEW.id OR NOT EXISTS(SELECT 1 FROM public.itens WHERE id=NEW.projeto_id AND user_id=NEW.user_id AND tipo='projeto')) THEN RAISE EXCEPTION 'Projeto inválido'; END IF;
ELSIF TG_TABLE_NAME='ligacoes' THEN
IF NEW.item_a=NEW.item_b OR NEW.origem NOT IN ('sugerida','confirmada') OR NOT EXISTS(SELECT 1 FROM public.itens WHERE id=NEW.item_a AND user_id=NEW.user_id) OR NOT EXISTS(SELECT 1 FROM public.itens WHERE id=NEW.item_b AND user_id=NEW.user_id) THEN RAISE EXCEPTION 'Ligação inválida'; END IF;
ELSIF TG_TABLE_NAME='preferencias_munim' THEN
IF NEW.perguntas_dia NOT BETWEEN 0 AND 20 OR NEW.sugestoes_dia NOT BETWEEN 0 AND 20 OR length(NEW.memoria_compacta)>2000 THEN RAISE EXCEPTION 'Limites inválidos'; END IF;
END IF;NEW.atualizado_em=now();RETURN NEW; END $$;
CREATE TRIGGER areas_updated BEFORE UPDATE ON public.areas FOR EACH ROW EXECUTE FUNCTION public.tocar_atualizado_em();
CREATE TRIGGER itens_validate BEFORE INSERT OR UPDATE ON public.itens FOR EACH ROW EXECUTE FUNCTION public.validar_munim_relacoes();
CREATE TRIGGER ligacoes_validate BEFORE INSERT OR UPDATE ON public.ligacoes FOR EACH ROW EXECUTE FUNCTION public.validar_munim_relacoes();
CREATE TRIGGER conversas_validate BEFORE INSERT OR UPDATE ON public.conversas FOR EACH ROW EXECUTE FUNCTION public.validar_munim_relacoes();
CREATE TRIGGER preferencias_validate BEFORE INSERT OR UPDATE ON public.preferencias_munim FOR EACH ROW EXECUTE FUNCTION public.validar_munim_relacoes();
CREATE FUNCTION public.validar_mensagem_conversa() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN IF NEW.conversa_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.conversas WHERE id=NEW.conversa_id AND user_id=NEW.user_id) THEN RAISE EXCEPTION 'Conversa inválida'; END IF;RETURN NEW;END $$;
CREATE TRIGGER mensagens_conversa_own BEFORE INSERT OR UPDATE ON public.mensagens FOR EACH ROW EXECUTE FUNCTION public.validar_mensagem_conversa();
INSERT INTO public.areas(user_id,nome) SELECT DISTINCT user_id,coalesce(nullif(trim(area),''),'Pessoal') FROM public.notas ON CONFLICT DO NOTHING;
INSERT INTO public.itens(id,user_id,tipo,titulo,conteudo,area_id,data_alvo,origem,legacy_nota_id,legacy_data,created_at) SELECT n.id,n.user_id,CASE WHEN n.subcategoria IN ('ideia','projeto') THEN n.subcategoria WHEN n.lembrete_em IS NOT NULL THEN 'lembrete' ELSE 'nota' END,coalesce(nullif(n.titulo,''),'Sem título'),coalesce(n.corpo_md,n.resumo,''),a.id,n.lembrete_em,'manual',n.id,to_jsonb(n),n.created_at FROM public.notas n LEFT JOIN public.areas a ON a.user_id=n.user_id AND a.nome=coalesce(nullif(trim(n.area),''),'Pessoal');
INSERT INTO public.conversas(user_id,titulo) SELECT DISTINCT user_id,'Conversas anteriores' FROM public.mensagens;
UPDATE public.mensagens m SET conversa_id=c.id FROM public.conversas c WHERE c.user_id=m.user_id AND c.titulo='Conversas anteriores';
INSERT INTO public.preferencias_munim(user_id) SELECT id FROM public.profiles ON CONFLICT DO NOTHING;
CREATE INDEX itens_user_date ON public.itens(user_id,data_alvo);CREATE INDEX mensagens_topic ON public.mensagens(user_id,conversa_id,created_at);
CREATE INDEX item_embedding_hnsw ON public.item_embeddings USING hnsw ((embedding::extensions.halfvec(3072)) extensions.halfvec_cosine_ops);
CREATE FUNCTION public.buscar_itens_semanticos(uid uuid,query_embedding extensions.vector(3072),limite integer DEFAULT 10) RETURNS TABLE(id uuid,titulo text,conteudo text,tipo text,similaridade double precision) LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public,extensions AS $$ SELECT i.id,i.titulo,i.conteudo,i.tipo,max(1-(e.embedding::halfvec(3072)<=>query_embedding::halfvec(3072))) FROM public.item_embeddings e JOIN public.itens i ON i.id=e.item_id WHERE e.user_id=uid AND i.user_id=uid AND i.status<>'arquivado' GROUP BY i.id ORDER BY max(1-(e.embedding::halfvec(3072)<=>query_embedding::halfvec(3072))) DESC LIMIT least(greatest(limite,1),10) $$;
REVOKE ALL ON FUNCTION public.buscar_itens_semanticos(uuid,extensions.vector,integer) FROM PUBLIC,anon,authenticated;GRANT EXECUTE ON FUNCTION public.buscar_itens_semanticos(uuid,extensions.vector,integer) TO service_role;
REVOKE ALL ON public.areas,public.itens,public.ligacoes,public.conversas,public.preferencias_munim,public.item_embeddings FROM anon;