-- dcs_atividades: atividades abertas (nao concluidas) do Pipedrive ligadas a clientes do funil CS
-- (dcs_clientes, pipeline_id=15). Aditivo, nao altera dcs_cobertura (que guarda so o resumo
-- ultimo contato/proximo) nem dcs_clientes. Fonte: workflow n8n dedicado (ainda a criar),
-- full-replace por execucao (mesma semantica de dcs_pipeline_onboarding).
create table if not exists public.dcs_atividades (
  id bigint primary key,
  cliente_key text not null,
  owner_id integer,
  owner_nome text,
  data date,
  tipo text,
  assunto text,
  ativo boolean not null default true,
  sync_id uuid,
  atualizado_em timestamptz not null default now()
);

comment on table public.dcs_atividades is
  'Atividades abertas (done=false) do Pipedrive ligadas a clientes do funil CS (dcs_clientes). Full-replace por execucao do workflow dedicado. Usado pela central de Atividades e pendencias (Prioridade 4). Nao duplica dcs_cobertura (resumo de ultimo contato/proximo).';

alter table public.dcs_atividades enable row level security;

create policy dcs_atividades_ler on public.dcs_atividades
  for select
  using (public.dcs_pode_ver(owner_id, cliente_key));

create index if not exists dcs_atividades_cliente_key_idx on public.dcs_atividades (cliente_key);
create index if not exists dcs_atividades_owner_id_idx on public.dcs_atividades (owner_id);
create index if not exists dcs_atividades_data_idx on public.dcs_atividades (data);

revoke all on public.dcs_atividades from public;

create or replace function public.dcs_publicar_atividades(p_run uuid, p_rows jsonb, p_lidos integer, p_completo boolean)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare r record; v_modo text; v_ins boolean; c int:=0; u int:=0; i int:=0;
begin
  select modo into v_modo from public.dcs_sync_execucoes where id=p_run and tipo='atividades' and status='executando' for update;
  if v_modo is null then raise exception 'Sincronizacao nao esta em execucao'; end if;
  if jsonb_typeof(p_rows)<>'array' then raise exception 'Payload invalido'; end if;
  for r in select * from jsonb_to_recordset(p_rows) as x(id bigint, cliente_key text, owner_id integer, owner_nome text, data date, tipo text, assunto text) loop
    if r.id is null or r.cliente_key is null then raise exception 'Linha invalida: %', r.id; end if;
    insert into public.dcs_atividades as t(id,cliente_key,owner_id,owner_nome,data,tipo,assunto,ativo,sync_id,atualizado_em)
    values (r.id,r.cliente_key,r.owner_id,r.owner_nome,r.data,r.tipo,r.assunto,true,p_run,now())
    on conflict (id) do update set cliente_key=excluded.cliente_key,owner_id=excluded.owner_id,owner_nome=excluded.owner_nome,
      data=excluded.data,tipo=excluded.tipo,assunto=excluded.assunto,ativo=true,sync_id=p_run,atualizado_em=now()
    where (t.cliente_key,t.owner_id,t.owner_nome,t.data,t.tipo,t.assunto,t.ativo) is distinct from
          (excluded.cliente_key,excluded.owner_id,excluded.owner_nome,excluded.data,excluded.tipo,excluded.assunto,true)
    returning (xmax = 0) into v_ins;
    if found then if v_ins then c:=c+1; else u:=u+1; end if; end if;
    update public.dcs_atividades set sync_id=p_run where id=r.id;
  end loop;
  if p_completo and v_modo='completa' then
    delete from public.dcs_atividades where sync_id is distinct from p_run;
    get diagnostics i = row_count;
  end if;
  update public.dcs_sync_execucoes set status=case when p_completo then 'sucesso' else 'parcial' end, concluido_em=now(), lidos=p_lidos,
    criados=c, alterados=u, inativados=i, completo=p_completo where id=p_run;
  return jsonb_build_object('criados',c,'alterados',u,'excluidos',i);
end $function$;

revoke all on function public.dcs_publicar_atividades(uuid, jsonb, integer, boolean) from public;
