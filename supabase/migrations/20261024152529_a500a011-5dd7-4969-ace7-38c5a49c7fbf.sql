DO $patch$ DECLARE ddl text; BEGIN
 SELECT pg_get_functiondef('public.cs_publicar_tudo(uuid,jsonb,jsonb,integer)'::regprocedure) INTO ddl;
 ddl:=replace(ddl,'UPDATE public.cs_snapshot s SET contato_dominios=t.d FROM (SELECT (x->>''deal_id'')::bigint id, coalesce(array(SELECT jsonb_array_elements_text(coalesce(x->''contato_dominios'',''[]''::jsonb))),''{}'') d FROM jsonb_array_elements(rows) x) t WHERE t.id=s.deal_id;', 'WITH dominios AS MATERIALIZED (SELECT x.deal_id, coalesce(x.contato_dominios,''{}''::text[]) d FROM jsonb_to_recordset(rows) x(deal_id bigint,contato_dominios text[])) UPDATE public.cs_snapshot s SET contato_dominios=t.d FROM dominios t WHERE t.deal_id=s.deal_id AND s.contato_dominios IS DISTINCT FROM t.d;');
 IF position('WITH dominios AS MATERIALIZED' in ddl)=0 THEN RAISE EXCEPTION 'Trecho esperado não encontrado'; END IF;
 EXECUTE ddl;
END $patch$;