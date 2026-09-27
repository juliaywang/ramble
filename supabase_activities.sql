-- Run in the Supabase SQL Editor after supabase_setup.sql.
-- Shared activities: participants can read, only accepted friends can be invited.
create table if not exists public.activity_invites (
  id uuid primary key default gen_random_uuid(),
  sender_id text not null references public.profiles(id),
  recipient_id text not null references public.profiles(id),
  sender_name text not null,
  recipient_name text not null,
  activity_key text not null,
  title text not null,
  kind text not null check (kind in ('quest', 'journey')),
  stops jsonb not null check (jsonb_typeof(stops) = 'array' and jsonb_array_length(stops) between 1 and 20),
  status text not null default 'pending' check (status in ('pending','accepted','declined')),
  sender_checks jsonb not null default '{}',
  recipient_checks jsonb not null default '{}',
  created_at timestamptz not null default now(),
  check (sender_id <> recipient_id),
  unique (sender_id, activity_key)
);
alter table public.activity_invites enable row level security;
grant select, insert on public.activity_invites to authenticated;
revoke update, delete on public.activity_invites from authenticated, anon;
drop policy if exists activity_read on public.activity_invites;
create policy activity_read on public.activity_invites for select to authenticated
using (auth.uid()::text in (sender_id, recipient_id));
drop policy if exists activity_send on public.activity_invites;
create policy activity_send on public.activity_invites for insert to authenticated
with check (
  sender_id = auth.uid()::text and status = 'pending'
  and sender_checks = '{}'::jsonb and recipient_checks = '{}'::jsonb
  and exists (select 1 from public.friendships f where f.status = 'accepted'
    and ((f.user_id = sender_id and f.friend_id = recipient_id)
      or (f.friend_id = sender_id and f.user_id = recipient_id)))
);

-- Row lock makes duplicate clicks and simultaneous check-ins idempotent.
-- Coordinates are checked by the browser; this is not an anti-spoofing service.
create or replace function public.respond_activity_invite(invite_id uuid, response text, stop_id text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  item public.activity_invites;
  actor text := auth.uid()::text;
begin
  select * into item from public.activity_invites where id = invite_id for update;
  if actor is null or item.id is null or actor not in (item.sender_id, item.recipient_id) then
    raise exception 'Invitation not found';
  end if;
  if response = 'unaccept' then
    if actor <> item.recipient_id or item.status <> 'accepted' then
      raise exception 'Only the invited friend can undo an accepted invitation';
    end if;
    update public.activity_invites set status = 'pending' where id = invite_id;
  elsif response = 'accepted' then
    if actor <> item.recipient_id or item.status not in ('pending', 'declined') then
      raise exception 'Invitation cannot be accepted';
    end if;
    update public.activity_invites set status = 'accepted' where id = invite_id;
  elsif response = 'declined' then
    if actor <> item.recipient_id or item.status not in ('pending', 'accepted') then
      raise exception 'Invitation cannot be declined';
    end if;
    update public.activity_invites set status = 'declined' where id = invite_id;
  elsif response = 'check' then
    if item.status <> 'accepted' or stop_id is null or not exists (
      select 1 from jsonb_array_elements(item.stops) s where s->'quest'->>'id' = stop_id
    ) then raise exception 'Invalid check-in'; end if;
    if actor = item.sender_id then
      if not (item.sender_checks ? stop_id) then
        update public.activity_invites set sender_checks = sender_checks || jsonb_build_object(stop_id, now()) where id = invite_id;
      end if;
    else
      if not (item.recipient_checks ? stop_id) then
        update public.activity_invites set recipient_checks = recipient_checks || jsonb_build_object(stop_id, now()) where id = invite_id;
      end if;
    end if;
  else raise exception 'Invalid response';
  end if;
end;
$$;
revoke all on function public.respond_activity_invite(uuid,text,text) from public, anon;
grant execute on function public.respond_activity_invite(uuid,text,text) to authenticated;
