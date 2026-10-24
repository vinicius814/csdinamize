DO $patch$ DECLARE ddl text; BEGIN
 SELECT pg_get_functiondef('public.cs_publicar_tudo(uuid,jsonb,jsonb,integer)'::regprocedure) INTO ddl;
 IF position('NOT EXISTS(SELECT 1 FROM jsonb_to_recordset(rows) x(deal_id bigint,pipeline_id integer,status text) WHERE' in ddl)=0 OR position('WITH dominios AS MATERIALIZED (SELECT x.deal_id, coalesce(x.contato_dominios,''{}''::text[]) d FROM jsonb_to_recordset(rows) x(deal_id bigint,contato_dominios text[]))' in ddl)=0 THEN RAISE EXCEPTION 'Trecho esperado não encontrado'; END IF;
 ddl:=replace(ddl,'IF jsonb_typeof(atividades)<>''array'' THEN RAISE EXCEPTION ''Atividades inválidas''; END IF;','IF jsonb_typeof(atividades)<>''array'' THEN RAISE EXCEPTION ''Atividades inválidas''; END IF;
 CREATE TEMP TABLE entrada ON COMMIT DROP AS SELECT x.deal_id,x.pipeline_id,x.status,coalesce(x.contato_dominios,''{}''::text[]) d FROM jsonb_to_recordset(rows) x(deal_id bigint,pipeline_id integer,status text,contato_dominios text[]);
 CREATE UNIQUE INDEX ON entrada(deal_id); ANALYZE entrada;');
 ddl:=replace(ddl,'NOT EXISTS(SELECT 1 FROM jsonb_to_recordset(rows) x(deal_id bigint,pipeline_id integer,status text) WHERE','NOT EXISTS(SELECT 1 FROM entrada x WHERE');
 ddl:=replace(ddl,'WITH dominios AS MATERIALIZED (SELECT x.deal_id, coalesce(x.contato_dominios,''{}''::text[]) d FROM jsonb_to_recordset(rows) x(deal_id bigint,contato_dominios text[]))','WITH dominios AS (SELECT deal_id,d FROM entrada)');
 EXECUTE ddl;
END $patch$;