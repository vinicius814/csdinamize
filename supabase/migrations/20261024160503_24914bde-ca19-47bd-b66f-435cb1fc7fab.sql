DO $patch$ DECLARE ddl text; cols text[] := array['org_id','org_nome','titulo','pipeline_id','stage_id','owner_id','owner_nome','status','valor','perfil_conta','ultimo_contato_efetivo','ultima_reuniao_cs','data_contratacao','stage_change_time','add_time','proxima_atividade_data','atividades_vencidas','atividades_abertas','ultima_atividade_concluida','ultimo_email_recebido','ultimo_email_enviado','contato_efetivo','origem_contato']; a text; b text; BEGIN
 SELECT pg_get_functiondef('public.cs_publicar_snapshot(uuid,jsonb,integer)'::regprocedure) INTO ddl;
 SELECT string_agg('cs_snapshot.'||c,','), string_agg('excluded.'||c,',') INTO a,b FROM unnest(cols) c;
 IF position('origem_contato text);' in ddl)=0 OR position('sync_id=run,atualizado_em=now();' in ddl)=0 OR position('DELETE FROM public.cs_snapshot WHERE sync_id<>run;' in ddl)=0 THEN RAISE EXCEPTION 'Trecho esperado não encontrado'; END IF;
 ddl:=replace(ddl,'origem_contato text);','origem_contato text); CREATE INDEX ON novos(deal_id); ANALYZE novos;');
 ddl:=replace(ddl,'sync_id=run,atualizado_em=now();','sync_id=run,atualizado_em=now() WHERE ('||a||') IS DISTINCT FROM ('||b||');');
 ddl:=replace(ddl,'DELETE FROM public.cs_snapshot WHERE sync_id<>run;','DELETE FROM public.cs_snapshot s WHERE NOT EXISTS(SELECT 1 FROM novos n WHERE n.deal_id=s.deal_id);');
 EXECUTE ddl;
END $patch$;