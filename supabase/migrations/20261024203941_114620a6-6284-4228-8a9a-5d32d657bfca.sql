create table public.cs_auditoria_progresso (deal_id bigint not null, desde date not null, ate date not null, verificado_em timestamptz not null default now(), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), primary key(deal_id,desde,ate));
grant all on public.cs_auditoria_progresso to service_role;
alter table public.cs_auditoria_progresso enable row level security;
create policy audit_progress_service on public.cs_auditoria_progresso for all to service_role using(true) with check(true);
create function public.cs_audit_progress_touch() returns trigger language plpgsql set search_path=public as $$ begin new.updated_at=now(); return new; end $$;
create trigger cs_audit_progress_updated before update on public.cs_auditoria_progresso for each row execute function public.cs_audit_progress_touch();
create function public.cs_publicar_auditoria(eventos jsonb, negocios bigint[], desde date, ate date) returns void language plpgsql set search_path=public as $$
begin
insert into public.cs_auditoria_eventos(evento_id,tipo,deal_id,org_id,pipeline_id,owner_id,cliente,negocio,owner_nome,dia,ocorrido_em,estado,fonte,motivo,mrr_anterior,mrr_posterior,mrr_perdido,valor_anterior,valor_posterior,status,activity_id)
select evento_id,tipo,deal_id,org_id,pipeline_id,owner_id,cliente,negocio,owner_nome,dia,ocorrido_em,estado,fonte,motivo,mrr_anterior,mrr_posterior,mrr_perdido,valor_anterior,valor_posterior,status,activity_id from jsonb_populate_recordset(null::public.cs_auditoria_eventos,eventos)
on conflict(evento_id) do update set org_id=excluded.org_id,pipeline_id=excluded.pipeline_id,owner_id=excluded.owner_id,cliente=excluded.cliente,negocio=excluded.negocio,owner_nome=excluded.owner_nome,dia=excluded.dia,ocorrido_em=excluded.ocorrido_em,estado=excluded.estado,fonte=excluded.fonte,motivo=excluded.motivo,mrr_anterior=excluded.mrr_anterior,mrr_posterior=excluded.mrr_posterior,mrr_perdido=excluded.mrr_perdido,valor_anterior=excluded.valor_anterior,valor_posterior=excluded.valor_posterior,status=excluded.status,activity_id=excluded.activity_id,atualizado_em=now();
insert into public.cs_auditoria_progresso(deal_id,desde,ate) select unnest(negocios),desde,ate on conflict(deal_id,desde,ate) do update set verificado_em=now();
end $$;
revoke all on function public.cs_publicar_auditoria(jsonb,bigint[],date,date) from public,anon,authenticated;
grant execute on function public.cs_publicar_auditoria(jsonb,bigint[],date,date) to service_role;