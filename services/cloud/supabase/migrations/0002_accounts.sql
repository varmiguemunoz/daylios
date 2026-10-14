-- N1 · Perfil y dispositivos. Cada persona solo ve y cambia los suyos.

create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  name text check (name is null or length(name) between 1 and 80),
  updated_at timestamptz not null default now()
);

create table public.devices (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (length(name) between 1 and 60),
  platform text not null default 'macos',
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index devices_user on public.devices (user_id, last_seen_at desc);

alter table public.profiles enable row level security;
alter table public.devices enable row level security;

create policy profiles_own on public.profiles
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Los miembros de una misma organización ven el nombre de los demás (actividad y presencia).
create policy profiles_teammates on public.profiles
  for select to authenticated
  using (exists (
    select 1 from public.memberships mine
    join public.memberships theirs on theirs.org_id = mine.org_id
    where mine.user_id = auth.uid() and mine.status = 'active'
      and theirs.user_id = profiles.user_id and theirs.status = 'active'
  ));

create policy devices_own on public.devices
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
