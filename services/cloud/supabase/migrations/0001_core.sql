-- DayliOS edición Equipo · N0. Organizaciones, membresías, invitaciones, auditoría y el registro de
-- mutaciones de ADR-02. RLS por organización en todas las tablas (ADR-07).
--
-- El microservicio entra con el rol daylios_service y ejecuta cada petición con SET LOCAL ROLE
-- authenticated y los datos del usuario, así que estas políticas también lo limitan a él.
-- Crear el rol a mano, fuera de las migraciones, para no guardar su contraseña aquí:
--   create role daylios_service login password '...';
--   grant authenticated to daylios_service;

create type public.org_role as enum ('owner', 'admin', 'member', 'viewer');

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 1 and 120),
  plan text not null default 'team' check (plan in ('team')),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.memberships (
  org_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.org_role not null,
  status text not null default 'active' check (status in ('active', 'removed')),
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);
create index memberships_user on public.memberships (user_id);

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  email text not null,
  role public.org_role not null check (role <> 'owner'),
  -- Solo el hash: el token viaja en el email y nunca se guarda en claro.
  token_hash text not null unique,
  invited_by uuid not null references auth.users (id),
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);
create index invitations_org on public.invitations (org_id);

create table public.audit_log (
  id bigserial primary key,
  org_id uuid not null references public.organizations (id) on delete cascade,
  actor uuid references auth.users (id),
  action text not null,
  target text,
  at timestamptz not null default now()
);
create index audit_log_org on public.audit_log (org_id, at desc);

-- Registro de mutaciones: el cursor crece por organización y es lo que pide pull.
create table public.mutations (
  cursor bigserial primary key,
  org_id uuid not null references public.organizations (id) on delete cascade,
  entity text not null,
  entity_id text not null,
  op text not null check (op in ('upsert', 'delete')),
  fields jsonb not null default '{}',
  rev text not null,
  by uuid references auth.users (id),
  at timestamptz not null default now()
);
create index mutations_org_cursor on public.mutations (org_id, cursor);

-- Estado fusionado de cada registro, con la revisión de cada campo (applyMutation).
create table public.records (
  org_id uuid not null references public.organizations (id) on delete cascade,
  entity text not null,
  entity_id text not null,
  state jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (org_id, entity, entity_id)
);

-- ¿El usuario de la petición es miembro activo, con uno de estos roles?
create function public.is_member(org uuid, roles public.org_role[] default null)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.memberships m
    where m.org_id = org
      and m.user_id = auth.uid()
      and m.status = 'active'
      and (roles is null or m.role = any (roles))
  );
$$;

alter table public.organizations enable row level security;
alter table public.memberships enable row level security;
alter table public.invitations enable row level security;
alter table public.audit_log enable row level security;
alter table public.mutations enable row level security;
alter table public.records enable row level security;

create policy org_read on public.organizations
  for select to authenticated using (public.is_member(id));
create policy org_update on public.organizations
  for update to authenticated using (public.is_member(id, '{owner,admin}'));

create policy members_read on public.memberships
  for select to authenticated using (public.is_member(org_id));
create policy members_manage on public.memberships
  for all to authenticated
  using (public.is_member(org_id, '{owner,admin}'))
  with check (public.is_member(org_id, '{owner,admin}'));

create policy invitations_manage on public.invitations
  for all to authenticated
  using (public.is_member(org_id, '{owner,admin}'))
  with check (public.is_member(org_id, '{owner,admin}'));

create policy audit_read on public.audit_log
  for select to authenticated using (public.is_member(org_id, '{owner,admin}'));
create policy audit_write on public.audit_log
  for insert to authenticated with check (public.is_member(org_id) and actor = auth.uid());

create policy mutations_read on public.mutations
  for select to authenticated using (public.is_member(org_id));
create policy mutations_write on public.mutations
  for insert to authenticated
  with check (public.is_member(org_id, '{owner,admin,member}') and by = auth.uid());

create policy records_read on public.records
  for select to authenticated using (public.is_member(org_id));
create policy records_write on public.records
  for all to authenticated
  using (public.is_member(org_id, '{owner,admin,member}'))
  with check (public.is_member(org_id, '{owner,admin,member}'));
