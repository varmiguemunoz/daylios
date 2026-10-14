-- N4 · Archivos: contenido por hash en R2. El manifiesto viaja por la sincronización de N3.

alter table public.plans add column max_storage_bytes bigint not null default 5368709120;
update public.plans set max_storage_bytes = 5368709120 where id = 'trial';
update public.plans set max_storage_bytes = 107374182400 where id = 'team';

create table public.blobs (
  org_id uuid not null references public.organizations (id) on delete cascade,
  hash text not null check (hash ~ '^[0-9a-f]{64}$'),
  size bigint not null check (size >= 0),
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  primary key (org_id, hash)
);

alter table public.blobs enable row level security;

create policy blobs_read on public.blobs
  for select to authenticated using (public.is_member(org_id));
create policy blobs_write on public.blobs
  for insert to authenticated
  with check (public.is_member(org_id, '{owner,admin,member}') and created_by = auth.uid());

-- Contenido sin ningún archivo vivo que lo use, o borrado hace más de los días de papelera.
create function public.purge_candidates(grace interval, trash interval)
returns table (org_id uuid, hash text)
language sql
stable
security definer
set search_path = public
as $$
  select b.org_id, b.hash from blobs b
  where b.created_at < now() - grace
    and not exists (
      select 1 from records r
      where r.org_id = b.org_id
        and r.entity = 'file_manifest'
        and r.state -> 'fields' -> 'hash' ->> 'value' = b.hash
        and (
          r.state -> 'fields' -> 'deleted_at' ->> 'value' is null
          or (r.state -> 'fields' -> 'deleted_at' ->> 'value')::timestamp > now() - trash
        )
    );
$$;

create function public.forget_blob(org uuid, blob_hash text)
returns void
language sql
security definer
set search_path = public
as $$
  delete from blobs where org_id = org and hash = blob_hash;
$$;

revoke all on function public.purge_candidates(interval, interval) from public;
revoke all on function public.forget_blob(uuid, text) from public;
grant execute on function public.purge_candidates(interval, interval) to daylios_service;
grant execute on function public.forget_blob(uuid, text) to daylios_service;
