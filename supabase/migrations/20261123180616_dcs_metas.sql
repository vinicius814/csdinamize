-- Metas (Prioridade 9, versao enxuta): metas mensais sobre indicadores ja confiaveis e reais
-- (cobertura em dia e taxa de implementacao de acoes - ja calculados em Inteligencia gerencial;
-- onboarding concluido, derivado de dcs_pipeline_onboarding quando o sync estiver ativo). Sem
-- meta de churn/MRR - nao ha base de receita recorrente confirmada para isso.
create table if not exists public.dcs_metas (
  id bigint generated always as identity primary key,
  periodo text not null,
  indicador text not null check (indicador in ('cobertura_em_dia_pct','implementacao_pct','onboarding_concluido_pct')),
  meta_valor numeric not null check (meta_valor >= 0 and meta_valor <= 100),
  definido_por uuid references auth.users(id),
  atualizado_em timestamptz not null default now(),
  unique (periodo, indicador)
);
comment on table public.dcs_metas is
  'Metas mensais (Prioridade 9) sobre indicadores reais já calculados no produto: cobertura em dia (%), taxa de implementação de ações (%) e % de onboarding concluído. Definidas por quem tem permissão "config". Sem meta de churn/MRR.';
alter table public.dcs_metas enable row level security;
-- Leitura: qualquer usuário autenticado do DCS pode ver as metas (são metas da operação, não dados de cliente).
create policy dcs_metas_ler on public.dcs_metas for select to authenticated
  using (exists (select 1 from public.dcs_membros m where m.user_id = auth.uid() and m.ativo));
revoke insert, update, delete, truncate, references, trigger on public.dcs_metas from authenticated;
revoke all on public.dcs_metas from anon;
grant select on public.dcs_metas to authenticated;
grant all on public.dcs_metas to service_role;

create or replace function public.dcs_definir_meta(p_periodo text, p_indicador text, p_valor numeric)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.dcs_pode('config') then raise exception 'Sem permissão' using errcode = '42501'; end if;
  if p_periodo !~ '^\d{4}-\d{2}$' then raise exception 'Período inválido (use AAAA-MM)'; end if;
  if p_indicador not in ('cobertura_em_dia_pct','implementacao_pct','onboarding_concluido_pct') then
    raise exception 'Indicador inválido';
  end if;
  if p_valor < 0 or p_valor > 100 then raise exception 'Meta deve estar entre 0 e 100'; end if;
  insert into public.dcs_metas(periodo, indicador, meta_valor, definido_por, atualizado_em)
  values (p_periodo, p_indicador, p_valor, auth.uid(), now())
  on conflict (periodo, indicador) do update set meta_valor = excluded.meta_valor, definido_por = auth.uid(), atualizado_em = now();
end $$;
revoke all on function public.dcs_definir_meta(text, text, numeric) from public, anon;
grant execute on function public.dcs_definir_meta(text, text, numeric) to authenticated;
