-- Publica negocios do funil Onboarding (pipeline_id=1) em dcs_pipeline_onboarding.
-- Espelha dcs_publicar_carteira; reusa dcs_iniciar_sync/dcs_falhar_sync com p_tipo='onboarding'.
create or replace function public.dcs_publicar_pipeline_onboarding(p_run uuid, p_rows jsonb, p_lidos integer, p_completo boolean)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare r record; v_modo text; v_ins boolean; c int:=0; u int:=0; i int:=0;
begin
  select modo into v_modo from public.dcs_sync_execucoes where id=p_run and tipo='onboarding' and status='executando' for update;
  if v_modo is null then raise exception 'Sincronizacao nao esta em execucao'; end if;
  if jsonb_typeof(p_rows)<>'array' then raise exception 'Payload invalido'; end if;
  for r in select * from jsonb_to_recordset(p_rows) as x(key text, org_id bigint, deal_id bigint, stage_id integer, owner_id integer, owner_nome text, titulo text, entrada_etapa_em timestamptz) loop
    if r.key is null or r.deal_id is null or r.stage_id is null then raise exception 'Linha invalida: %', r.key; end if;
    insert into public.dcs_pipeline_onboarding as t(key,org_id,deal_id,stage_id,owner_id,owner_nome,titulo,entrada_etapa_em,ativo,inativado_em,sync_id,atualizado_em)
    values (r.key,r.org_id,r.deal_id,r.stage_id,r.owner_id,r.owner_nome,r.titulo,r.entrada_etapa_em,true,null,p_run,now())
    on conflict (key) do update set org_id=excluded.org_id,deal_id=excluded.deal_id,stage_id=excluded.stage_id,owner_id=excluded.owner_id,
      owner_nome=excluded.owner_nome,titulo=excluded.titulo,entrada_etapa_em=excluded.entrada_etapa_em,ativo=true,inativado_em=null,sync_id=p_run,atualizado_em=now()
    where (t.org_id,t.deal_id,t.stage_id,t.owner_id,t.owner_nome,t.titulo,t.ativo) is distinct from
          (excluded.org_id,excluded.deal_id,excluded.stage_id,excluded.owner_id,excluded.owner_nome,excluded.titulo,true)
    returning (xmax = 0) into v_ins;
    if found then if v_ins then c:=c+1; else u:=u+1; end if; end if;
    update public.dcs_pipeline_onboarding set sync_id=p_run where key=r.key;
  end loop;
  if p_completo and v_modo='completa' then
    update public.dcs_pipeline_onboarding set ativo=false, inativado_em=now() where ativo and sync_id is distinct from p_run;
    get diagnostics i = row_count;
  end if;
  update public.dcs_sync_execucoes set status=case when p_completo then 'sucesso' else 'parcial' end, concluido_em=now(), lidos=p_lidos,
    criados=c, alterados=u, inativados=i, completo=p_completo where id=p_run;
  return jsonb_build_object('criados',c,'alterados',u,'inativados',i);
end $function$;

revoke all on function public.dcs_publicar_pipeline_onboarding(uuid, jsonb, integer, boolean) from public;
