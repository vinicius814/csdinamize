create table public.cs_auditoria_eventos (evento_id text primary key, tipo text not null, deal_id bigint not null, org_id bigint, pipeline_id integer not null, owner_id integer not null, cliente text not null, negocio text not null, owner_nome text, dia date not null, ocorrido_em timestamptz not null, estado text not null, fonte text not null, motivo text not null, mrr_anterior numeric, mrr_posterior numeric, mrr_perdido numeric, valor_anterior numeric, valor_posterior numeric, status text, activity_id bigint, created_at timestamptz not null default now(), atualizado_em timestamptz not null default now());
grant select on public.cs_auditoria_eventos to authenticated;
grant all on public.cs_auditoria_eventos to service_role;
alter table public.cs_auditoria_eventos enable row level security;
create policy cs_auditoria_leitura on public.cs_auditoria_eventos for select to authenticated using (public.cs_pode_ver(owner_id,pipeline_id));
create index cs_auditoria_filtros on public.cs_auditoria_eventos (pipeline_id,owner_id,dia);
create or replace function public.cs_auditoria_timestamp() returns trigger language plpgsql set search_path=public as $$ begin new.atualizado_em=now(); return new; end $$;
create trigger cs_auditoria_atualizar before update on public.cs_auditoria_eventos for each row execute function public.cs_auditoria_timestamp();