-- N3 · Sincronización: cambios idempotentes, estado por registro y aviso por Realtime.

alter table public.mutations add column mutation_id text;
update public.mutations set mutation_id = 'legacy-' || cursor where mutation_id is null;
alter table public.mutations alter column mutation_id set not null;
create unique index mutations_org_mutation on public.mutations (org_id, mutation_id);

create index records_org_key on public.records (org_id, entity, entity_id);

-- Solo los miembros activos escuchan el canal org:<id> de su organización.
create policy org_channel_read on realtime.messages
  for select to authenticated
  using (
    realtime.topic() like 'org:%'
    and public.is_member(nullif(split_part(realtime.topic(), ':', 2), '')::uuid)
  );
