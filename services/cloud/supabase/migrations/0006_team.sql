-- N5 · Equipo en tiempo real: presencia por Realtime y registro de actividad.

-- Presencia en el canal org:<id>:presence. Leer ya lo cubre org_channel_read; publicar, solo miembros.
create policy org_presence_write on realtime.messages
  for insert to authenticated
  with check (
    realtime.messages.extension = 'presence'
    and realtime.topic() like 'org:%:presence'
    and public.is_member(nullif(split_part(realtime.topic(), ':', 2), '')::uuid)
  );

create sequence public.activity_seq;

create table public.activity (
  id bigserial primary key,
  seq bigint not null default nextval('public.activity_seq'),
  org_id uuid not null references public.organizations (id) on delete cascade,
  actor_id uuid references auth.users (id) on delete set null,
  verb text not null check (length(verb) between 1 and 30),
  entity text not null check (length(entity) between 1 and 40),
  entity_id text not null check (length(entity_id) between 1 and 200),
  title text not null default '' check (length(title) <= 300),
  detail text check (detail is null or length(detail) <= 300),
  target_id uuid,
  count integer not null default 1 check (count > 0),
  at timestamptz not null default now()
);
create index activity_org_seq on public.activity (org_id, seq);
create index activity_burst on public.activity (org_id, actor_id, entity, entity_id, at desc);

alter table public.activity enable row level security;

create policy activity_read on public.activity
  for select to authenticated using (public.is_member(org_id));
create policy activity_write on public.activity
  for insert to authenticated
  with check (public.is_member(org_id, '{owner,admin,member}') and actor_id = auth.uid());
create policy activity_burst on public.activity
  for update to authenticated
  using (actor_id = auth.uid() and public.is_member(org_id, '{owner,admin,member}'))
  with check (actor_id = auth.uid());

-- Invitaciones y altas llegan a la actividad desde la auditoría, sin tocar cada función.
create function public.audit_to_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.action = 'member.invite' then
    insert into activity (org_id, actor_id, verb, entity, entity_id, title)
      values (new.org_id, new.actor, 'invited', 'members', coalesce(new.target, 'enlace'), coalesce(new.target, 'enlace'));
  elsif new.action = 'member.join' then
    insert into activity (org_id, actor_id, verb, entity, entity_id, title)
      values (new.org_id, new.actor, 'joined', 'members', new.actor::text, '');
  end if;
  return new;
end;
$$;

create trigger audit_activity after insert on public.audit_log
  for each row execute function public.audit_to_activity();

grant usage on sequence public.activity_seq to authenticated;
grant usage on sequence public.activity_id_seq to authenticated;
