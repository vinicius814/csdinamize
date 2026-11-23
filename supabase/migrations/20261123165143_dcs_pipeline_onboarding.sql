-- dcs_pipeline_onboarding: negocios do funil Onboarding (pipeline_id=1) do Pipedrive.
-- Aditivo: nao altera dcs_clientes (funil Customer Success, pipeline_id=15) nem dcs_onboarding
-- (que ja existe e e o tour guiado do app - nome diferente de proposito para nao colidir).
-- Convencao de key/RLS igual a dcs_clientes (reaproveita dcs_pode_ver).
create table if not exists public.dcs_pipeline_onboarding (
  key text primary key,
  org_id bigint not null,
  deal_id bigint not null,
  stage_id integer not null,
  owner_id integer,
  owner_nome text,
  titulo text,
  entrada_etapa_em timestamptz,
  ativo boolean not null default true,
  inativado_em timestamptz,
  sync_id uuid,
  atualizado_em timestamptz not null default now()
);

comment on table public.dcs_pipeline_onboarding is
  'Negocios do funil Onboarding (pipeline_id=1) no Pipedrive, sincronizados por workflow dedicado (ainda a criar). Aditivo: nao altera dcs_clientes (funil 15) nem dcs_onboarding (tour guiado do app). Ligado a dcs_clientes por org_id quando a mesma organizacao tem conta em CS.';

alter table public.dcs_pipeline_onboarding enable row level security;

create policy dcs_pipeline_onboarding_ler on public.dcs_pipeline_onboarding
  for select
  using (public.dcs_pode_ver(owner_id, key));

create index if not exists dcs_pipeline_onboarding_org_id_idx on public.dcs_pipeline_onboarding (org_id);
create index if not exists dcs_pipeline_onboarding_owner_id_idx on public.dcs_pipeline_onboarding (owner_id);
