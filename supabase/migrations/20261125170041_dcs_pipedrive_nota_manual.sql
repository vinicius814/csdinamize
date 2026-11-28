-- D51 (25/11/2026): escrita manual no Pipedrive pela ficha do cliente (Cliente 360).
-- Esta migration já está aplicada em produção desde 25/11/2026; este arquivo só traz o
-- código-fonte para o repositório, que ficou faltando quando a sessão anterior encerrou sem
-- git push (ver docs/DECISIONS.md, D51).
--
-- Nota manual de texto livre do analista, represada como job 'pipedrive_nota_manual' até o
-- próximo "Atualizar carteira" (dcs_solicitar_sync) liberá-la — mesmo mecanismo já usado para
-- diagnósticos concluídos (D42). dcs_solicitar_sync foi atualizada separadamente, em produção,
-- para também liberar jobs desse tipo; a definição completa dessa função não está reproduzida
-- aqui para não arriscar divergir do que está live — confira a função atual no banco antes de
-- reaplicar esta migration do zero em outro ambiente.

create table if not exists public.dcs_notas_cliente (
  id uuid primary key default gen_random_uuid(),
  cliente_key text not null references public.dcs_clientes(key),
  autor_id uuid not null references auth.users(id),
  texto text not null,
  job_id uuid references public.dcs_jobs(id),
  criado_em timestamptz not null default now()
);

alter table public.dcs_notas_cliente enable row level security;

create policy dcs_notas_ler on public.dcs_notas_cliente
  for select to authenticated
  using (
    exists (
      select 1 from public.dcs_clientes c
      where c.key = dcs_notas_cliente.cliente_key
        and public.dcs_pode_ver(c.owner_id, c.key)
    )
  );

create or replace function public.dcs_notas_cliente_listar(p_cliente_key text)
returns table(
  id uuid,
  texto text,
  autor_id uuid,
  autor_nome text,
  criado_em timestamptz,
  status text,
  erro text
)
language sql
stable security definer
set search_path to 'public'
as $function$
  select n.id, n.texto, n.autor_id, p.nome, n.criado_em, coalesce(j.status, 'aguardando_autorizacao'), j.erro
  from public.dcs_notas_cliente n
  join public.dcs_clientes c on c.key = n.cliente_key
  left join public.dcs_jobs j on j.id = n.job_id
  left join public.profiles p on p.id = n.autor_id
  where n.cliente_key = p_cliente_key and public.dcs_pode_ver(c.owner_id, c.key)
  order by n.criado_em desc
$function$;

create or replace function public.dcs_registrar_nota_cliente(p_cliente_key text, p_texto text)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  c public.dcs_clientes;
  v_nota uuid;
  v_job uuid;
  base_url text;
  texto_limpo text;
begin
  select * into c from public.dcs_clientes where key = p_cliente_key;
  if c.key is null or not public.dcs_pode_ver(c.owner_id, c.key) then
    raise exception 'Cliente não encontrado ou sem permissão' using errcode = '42501';
  end if;

  texto_limpo := btrim(coalesce(p_texto, ''));
  if texto_limpo = '' then
    raise exception 'Texto obrigatório';
  end if;

  base_url := coalesce((select valor->>'base' from public.dcs_config where chave = 'app_url'), 'https://csdinamize.lovable.app');

  insert into public.dcs_notas_cliente (cliente_key, autor_id, texto)
  values (p_cliente_key, auth.uid(), texto_limpo)
  returning id into v_nota;

  -- Nasce sempre 'aguardando_autorizacao', independentemente de dcs_config.pipedrive_escrita.ativa:
  -- só sai na próxima liberação em lote pelo "Atualizar carteira" (dcs_solicitar_sync).
  insert into public.dcs_jobs (tipo, chave, payload, status, criado_por)
  values (
    'pipedrive_nota_manual',
    'DZCS-NOTA-' || v_nota,
    jsonb_build_object(
      'nota_id', v_nota,
      'deal_id', c.deal_id,
      'org_id', c.org_id,
      'person_id', c.person_id,
      'user_id', public.dcs_pipedrive_do_usuario(auth.uid()),
      'cliente', c.nome,
      'subject', 'CS | Registro manual — Dinamize Marketing',
      'texto', texto_limpo,
      'marca', 'DZCS-NOTA-' || v_nota,
      'link', base_url || '/dcs/cliente/' || p_cliente_key,
      'data', (now() at time zone 'America/Sao_Paulo')::date
    ),
    'aguardando_autorizacao',
    auth.uid()
  )
  returning id into v_job;

  update public.dcs_notas_cliente set job_id = v_job where id = v_nota;

  perform public.dcs_auditar('nota_cliente', v_nota::text, 'criar', jsonb_build_object('cliente_key', p_cliente_key));

  return v_nota;
end
$function$;
