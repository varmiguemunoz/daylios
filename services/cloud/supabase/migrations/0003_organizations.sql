-- N2 · Planes, invitaciones de un solo uso y operaciones atómicas de organización.
-- Las funciones security definer vuelven a comprobar los permisos: son la segunda barrera.

create table public.plans (
  id text primary key,
  name text not null,
  max_members integer not null check (max_members > 0)
);
insert into public.plans (id, name, max_members) values
  ('trial', 'Prueba', 5),
  ('team', 'Equipo', 50);

alter table public.organizations drop constraint if exists organizations_plan_check;
alter table public.organizations alter column plan set default 'trial';
update public.organizations set plan = 'trial' where plan not in (select id from public.plans);
alter table public.organizations
  add constraint organizations_plan_fk foreign key (plan) references public.plans (id);

alter table public.plans enable row level security;
create policy plans_read on public.plans for select to authenticated using (true);

alter table public.invitations alter column email drop not null;
alter table public.invitations add column revoked_at timestamptz;
alter table public.invitations add column accepted_by uuid references auth.users (id);

create function public.create_organization(org_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
begin
  if auth.uid() is null then raise exception 'sin sesión'; end if;
  if length(trim(org_name)) not between 1 and 120 then raise exception 'nombre inválido'; end if;
  insert into organizations (name) values (trim(org_name)) returning id into new_id;
  insert into memberships (org_id, user_id, role) values (new_id, auth.uid(), 'owner');
  insert into audit_log (org_id, actor, action) values (new_id, auth.uid(), 'org.create');
  return new_id;
end;
$$;

create function public.transfer_ownership(org uuid, new_owner uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_member(org, '{owner}') then raise exception 'solo el dueño'; end if;
  if not exists (
    select 1 from memberships where org_id = org and user_id = new_owner and status = 'active'
  ) then raise exception 'no es miembro'; end if;
  update memberships set role = 'admin' where org_id = org and user_id = auth.uid();
  update memberships set role = 'owner' where org_id = org and user_id = new_owner;
  insert into audit_log (org_id, actor, action, target)
    values (org, auth.uid(), 'org.transfer', new_owner::text);
end;
$$;

create function public.invitation_by_hash(hash text)
returns table (
  id uuid, org_id uuid, org_name text, email text, role org_role, invited_by uuid,
  expires_at timestamptz, accepted_at timestamptz, revoked_at timestamptz, created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select i.id, i.org_id, o.name, i.email, i.role, i.invited_by,
         i.expires_at, i.accepted_at, i.revoked_at, i.created_at
  from invitations i join organizations o on o.id = i.org_id
  where i.token_hash = hash and o.deleted_at is null;
$$;

create function public.accept_invitation(hash text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  inv invitations%rowtype;
  limit_members integer;
  active_members integer;
begin
  if auth.uid() is null then raise exception 'sin sesión'; end if;
  select * into inv from invitations where token_hash = hash for update;
  if not found then raise exception 'not-found'; end if;
  if inv.accepted_at is not null then raise exception 'accepted'; end if;
  if inv.revoked_at is not null then raise exception 'revoked'; end if;
  if inv.expires_at <= now() then raise exception 'expired'; end if;
  if inv.email is not null and inv.email <> lower(coalesce(auth.jwt() ->> 'email', '')) then
    raise exception 'email-mismatch';
  end if;
  select p.max_members into limit_members
    from organizations o join plans p on p.id = o.plan where o.id = inv.org_id;
  select count(*) into active_members
    from memberships where org_id = inv.org_id and status = 'active';
  if active_members >= limit_members then raise exception 'member-limit'; end if;
  insert into memberships (org_id, user_id, role) values (inv.org_id, auth.uid(), inv.role)
    on conflict (org_id, user_id) do update set role = excluded.role, status = 'active';
  update invitations set accepted_at = now(), accepted_by = auth.uid() where id = inv.id;
  insert into audit_log (org_id, actor, action, target)
    values (inv.org_id, auth.uid(), 'member.join', inv.role::text);
  return inv.org_id;
end;
$$;

create function public.leave_organization(org uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if is_member(org, '{owner}') then raise exception 'transfiere la propiedad antes de salir'; end if;
  update memberships set status = 'removed'
    where org_id = org and user_id = auth.uid() and status = 'active';
  insert into audit_log (org_id, actor, action) values (org, auth.uid(), 'member.leave');
end;
$$;

create function public.org_member_emails(org uuid)
returns table (user_id uuid, email text)
language sql
stable
security definer
set search_path = public, auth
as $$
  select m.user_id, u.email::text
  from public.memberships m join auth.users u on u.id = m.user_id
  where m.org_id = org and m.status = 'active' and public.is_member(org);
$$;

drop policy org_update on public.organizations;
create policy org_update on public.organizations
  for update to authenticated using (public.is_member(id, '{owner}'));

revoke all on function public.create_organization(text) from public;
revoke all on function public.transfer_ownership(uuid, uuid) from public;
revoke all on function public.invitation_by_hash(text) from public;
revoke all on function public.accept_invitation(text) from public;
revoke all on function public.leave_organization(uuid) from public;
revoke all on function public.org_member_emails(uuid) from public;
grant execute on function public.create_organization(text) to authenticated;
grant execute on function public.transfer_ownership(uuid, uuid) to authenticated;
grant execute on function public.invitation_by_hash(text) to authenticated;
grant execute on function public.accept_invitation(text) to authenticated;
grant execute on function public.leave_organization(uuid) to authenticated;
grant execute on function public.org_member_emails(uuid) to authenticated;
