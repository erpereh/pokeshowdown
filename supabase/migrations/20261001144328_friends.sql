-- Friend codes, friend requests, friendships and presence.

create or replace function public.gen_friend_code()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  alphabet constant text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  raw bytea;
  code text;
  i integer;
begin
  loop
    raw := pg_catalog.decode(pg_catalog.replace(pg_catalog.gen_random_uuid()::text, '-', ''), 'hex');
    code := '';
    for i in 0..7 loop
      code := code || pg_catalog.substr(alphabet, (pg_catalog.get_byte(raw, i) % 31) + 1, 1);
    end loop;
    exit when not exists (select 1 from public.profiles as p where p.friend_code = code);
  end loop;
  return code;
end;
$$;

alter table public.profiles add column friend_code text;
update public.profiles set friend_code = public.gen_friend_code() where friend_code is null;
alter table public.profiles alter column friend_code set default public.gen_friend_code();
alter table public.profiles alter column friend_code set not null;
alter table public.profiles add constraint profiles_friend_code_key unique (friend_code);
alter table public.profiles add constraint profiles_friend_code_shape check (friend_code ~ '^[2-9A-HJKMNP-Z]{8}$');

create or replace function public.prevent_friend_code_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.friend_code is distinct from old.friend_code then
    raise exception 'friend_code_immutable' using errcode = 'P0010';
  end if;
  return new;
end;
$$;

create trigger profiles_friend_code_immutable before update on public.profiles
  for each row execute function public.prevent_friend_code_change();

create table public.friend_requests (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  requester_id uuid not null references auth.users (id) on delete cascade,
  addressee_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'pending',
  created_at timestamptz not null default pg_catalog.now(),
  responded_at timestamptz,
  constraint friend_requests_not_self check (requester_id <> addressee_id),
  constraint friend_requests_status_check check (status in ('pending', 'accepted', 'declined', 'cancelled')),
  constraint friend_requests_response_shape check ((status = 'pending') = (responded_at is null))
);

create unique index friend_requests_open_pair_idx on public.friend_requests (
  least(requester_id, addressee_id), greatest(requester_id, addressee_id)
) where status = 'pending';
create index friend_requests_addressee_idx on public.friend_requests (addressee_id, status);
create index friend_requests_requester_idx on public.friend_requests (requester_id, status);

create table public.friendships (
  user_low uuid not null references auth.users (id) on delete cascade,
  user_high uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default pg_catalog.now(),
  primary key (user_low, user_high),
  constraint friendships_order check (user_low < user_high)
);
create index friendships_high_idx on public.friendships (user_high);

create table public.user_presence (
  user_id uuid primary key references auth.users (id) on delete cascade,
  last_seen_at timestamptz not null default pg_catalog.now()
);
comment on table public.user_presence is 'Server-only heartbeat. RLS enabled with no policies.';

alter table public.friend_requests enable row level security;
alter table public.friendships enable row level security;
alter table public.user_presence enable row level security;

create policy friend_requests_select on public.friend_requests for select to authenticated
  using ((select auth.uid()) = requester_id or (select auth.uid()) = addressee_id);
create policy friendships_select on public.friendships for select to authenticated
  using ((select auth.uid()) = user_low or (select auth.uid()) = user_high);

revoke all on table public.friend_requests from public, anon, authenticated;
revoke all on table public.friendships from public, anon, authenticated;
revoke all on table public.user_presence from public, anon, authenticated;
grant select on table public.friend_requests to authenticated;
grant select on table public.friendships to authenticated;

-- Writes go through these service_role-only functions.

create or replace function public.send_friend_request(p_user uuid, p_code text)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target uuid;
  normalized text;
  existing public.friend_requests%rowtype;
  low uuid;
  high uuid;
  pending_count integer;
  new_id uuid;
begin
  normalized := pg_catalog.upper(pg_catalog.regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
  select p.user_id into target from public.profiles as p where p.friend_code = normalized;
  if target is null then
    raise exception 'friend_code_not_found' using errcode = 'P0011';
  end if;
  if target = p_user then
    raise exception 'friend_self' using errcode = 'P0012';
  end if;
  low := least(p_user, target);
  high := greatest(p_user, target);
  if exists (select 1 from public.friendships as f where f.user_low = low and f.user_high = high) then
    raise exception 'already_friends' using errcode = 'P0013';
  end if;

  select * into existing from public.friend_requests as r
  where least(r.requester_id, r.addressee_id) = low and greatest(r.requester_id, r.addressee_id) = high
    and r.status = 'pending'
  for update;

  if found then
    if existing.requester_id = p_user then
      return jsonb_build_object('status', 'sent', 'requestId', existing.id);
    end if;
    update public.friend_requests set status = 'accepted', responded_at = pg_catalog.now() where id = existing.id;
    insert into public.friendships (user_low, user_high) values (low, high) on conflict do nothing;
    return jsonb_build_object('status', 'accepted', 'requestId', existing.id);
  end if;

  select pg_catalog.count(*) into pending_count from public.friend_requests as r
  where r.requester_id = p_user and r.status = 'pending';
  if pending_count >= 50 then
    raise exception 'too_many_requests' using errcode = 'P0014';
  end if;

  insert into public.friend_requests (requester_id, addressee_id) values (p_user, target)
  returning id into new_id;
  return jsonb_build_object('status', 'sent', 'requestId', new_id);
end;
$$;

create or replace function public.respond_friend_request(p_user uuid, p_request_id uuid, p_action text)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  req public.friend_requests%rowtype;
begin
  select * into req from public.friend_requests where id = p_request_id for update;
  if not found or (req.requester_id <> p_user and req.addressee_id <> p_user) then
    raise exception 'request_not_found' using errcode = 'P0002';
  end if;
  if req.status <> 'pending' then
    raise exception 'request_not_pending' using errcode = 'P0015';
  end if;
  if p_action = 'cancel' then
    if req.requester_id <> p_user then
      raise exception 'request_not_found' using errcode = 'P0002';
    end if;
    update public.friend_requests set status = 'cancelled', responded_at = pg_catalog.now() where id = req.id;
  elsif p_action = 'accept' or p_action = 'decline' then
    if req.addressee_id <> p_user then
      raise exception 'request_not_found' using errcode = 'P0002';
    end if;
    update public.friend_requests
    set status = case when p_action = 'accept' then 'accepted' else 'declined' end, responded_at = pg_catalog.now()
    where id = req.id;
    if p_action = 'accept' then
      insert into public.friendships (user_low, user_high)
      values (least(req.requester_id, req.addressee_id), greatest(req.requester_id, req.addressee_id))
      on conflict do nothing;
    end if;
  else
    raise exception 'bad_action' using errcode = '22023';
  end if;
end;
$$;

create or replace function public.remove_friend(p_user uuid, p_friend uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  delete from public.friendships
  where user_low = least(p_user, p_friend) and user_high = greatest(p_user, p_friend);
  if not found then
    raise exception 'friend_not_found' using errcode = 'P0002';
  end if;
end;
$$;

create or replace function public.touch_presence(p_user uuid)
returns void
language sql
security invoker
set search_path = ''
as $$
  insert into public.user_presence (user_id, last_seen_at) values (p_user, pg_catalog.now())
  on conflict (user_id) do update set last_seen_at = excluded.last_seen_at;
$$;

revoke all on function public.gen_friend_code() from public, anon, authenticated;
revoke all on function public.prevent_friend_code_change() from public, anon, authenticated;
revoke all on function public.send_friend_request(uuid, text) from public, anon, authenticated;
revoke all on function public.respond_friend_request(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.remove_friend(uuid, uuid) from public, anon, authenticated;
revoke all on function public.touch_presence(uuid) from public, anon, authenticated;
grant execute on function public.gen_friend_code() to service_role, supabase_auth_admin;
grant execute on function public.send_friend_request(uuid, text) to service_role;
grant execute on function public.respond_friend_request(uuid, uuid, text) to service_role;
grant execute on function public.remove_friend(uuid, uuid) to service_role;
grant execute on function public.touch_presence(uuid) to service_role;
