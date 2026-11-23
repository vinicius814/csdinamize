-- dcs_cancelamentos: negocios do funil CS (pipeline_id=15) na etapa "Cancelados" (stage_id=105,
-- validada direto no Pipedrive em 23/11/2026 - tem lost_reason/lost_time reais). Aditivo, nao
-- altera dcs_clientes. Historico: upsert simples, sem inativar/excluir (cancelamento nao "desfaz").
-- key segue a mesma convencao de dcs_clientes (org_id como texto, ou "d"+deal_id sem org) para a
-- mesma RLS por carteira valer aqui.
create table if not exists public.dcs_cancelamentos (
  deal_id bigint primary key,
  key text not null,
  org_id bigint,
  owner_id integer,
  owner_nome text,
  nome text,
  codigo text,
  valor numeric,
  motivo text,
  cancelado_em date,
  sync_id uuid,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

comment on table public.dcs_cancelamentos is
  'Negocios do funil CS (pipeline_id=15) na etapa Cancelados (stage_id=105), com motivo (lost_reason) e data (lost_time) reais do Pipedrive. Fonte: workflow n8n dedicado. Historico - nunca excluido pelo sync. Base da Prioridade 5 (Cancelamentos e retencao).';

alter table public.dcs_cancelamentos enable row level security;

create policy dcs_cancelamentos_ler on public.dcs_cancelamentos
  for select
  using (public.dcs_pode_ver(owner_id, key));

create index if not exists dcs_cancelamentos_key_idx on public.dcs_cancelamentos (key);
create index if not exists dcs_cancelamentos_owner_id_idx on public.dcs_cancelamentos (owner_id);
create index if not exists dcs_cancelamentos_cancelado_em_idx on public.dcs_cancelamentos (cancelado_em);

revoke all on public.dcs_cancelamentos from public;

create or replace function public.dcs_publicar_cancelamentos(p_run uuid, p_rows jsonb, p_lidos integer, p_completo boolean)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare r record; v_modo text; v_ins boolean; c int:=0; u int:=0;
begin
  select modo into v_modo from public.dcs_sync_execucoes where id=p_run and tipo='cancelamentos' and status='executando' for update;
  if v_modo is null then raise exception 'Sincronizacao nao esta em execucao'; end if;
  if jsonb_typeof(p_rows)<>'array' then raise exception 'Payload invalido'; end if;
  for r in select * from jsonb_to_recordset(p_rows) as x(deal_id bigint, key text, org_id bigint, owner_id integer, owner_nome text, nome text, codigo text, valor numeric, motivo text, cancelado_em date) loop
    if r.deal_id is null or r.key is null then raise exception 'Linha invalida: %', r.deal_id; end if;
    insert into public.dcs_cancelamentos as t(deal_id,key,org_id,owner_id,owner_nome,nome,codigo,valor,motivo,cancelado_em,sync_id,criado_em,atualizado_em)
    values (r.deal_id,r.key,r.org_id,r.owner_id,r.owner_nome,r.nome,r.codigo,r.valor,r.motivo,r.cancelado_em,p_run,now(),now())
    on conflict (deal_id) do update set key=excluded.key,org_id=excluded.org_id,owner_id=excluded.owner_id,owner_nome=excluded.owner_nome,
      nome=excluded.nome,codigo=excluded.codigo,valor=excluded.valor,motivo=excluded.motivo,cancelado_em=excluded.cancelado_em,sync_id=p_run,atualizado_em=now()
    where (t.key,t.org_id,t.owner_id,t.owner_nome,t.nome,t.codigo,t.valor,t.motivo,t.cancelado_em) is distinct from
          (excluded.key,excluded.org_id,excluded.owner_id,excluded.owner_nome,excluded.nome,excluded.codigo,excluded.valor,excluded.motivo,excluded.cancelado_em)
    returning (xmax = 0) into v_ins;
    if found then if v_ins then c:=c+1; else u:=u+1; end if; end if;
    update public.dcs_cancelamentos set sync_id=p_run where deal_id=r.deal_id;
  end loop;
  update public.dcs_sync_execucoes set status=case when p_completo then 'sucesso' else 'parcial' end, concluido_em=now(), lidos=p_lidos,
    criados=c, alterados=u, inativados=0, completo=p_completo where id=p_run;
  return jsonb_build_object('criados',c,'alterados',u);
end $function$;

revoke all on function public.dcs_publicar_cancelamentos(uuid, jsonb, integer, boolean) from public;
