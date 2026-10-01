-- Battle challenges between friends. The challenger fixes the rules at creation; nothing can change them later.

create table public.challenges (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  challenger_id uuid not null references auth.users (id) on delete cascade,
  challenged_id uuid not null references auth.users (id) on delete cascade,
  format_id text not null,
  timer_seconds integer,
  ou_team_source text not null,
  invite_ttl_minutes integer not null,
  status text not null default 'pending',
  expires_at timestamptz not null,
  prepare_expires_at timestamptz,
  challenger_ready boolean not null default false,
  challenged_ready boolean not null default false,
  match_id uuid,
  create_request_id uuid not null,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  constraint challenges_not_self check (challenger_id <> challenged_id),
  constraint challenges_request_key unique (challenger_id, create_request_id),
  constraint challenges_format_check check (format_id in ('gen9ou', 'gen9randombattle')),
  constraint challenges_timer_check check (timer_seconds is null or timer_seconds in (60, 120)),
  constraint challenges_source_check check (ou_team_source in ('saved', 'saved_or_random')),
  constraint challenges_ttl_check check (invite_ttl_minutes in (2, 5, 10)),
  constraint challenges_status_check check (status in ('pending', 'preparing', 'started', 'declined', 'cancelled', 'expired'))
);

create unique index challenges_open_pair_idx on public.challenges (
  least(challenger_id, challenged_id), greatest(challenger_id, challenged_id)
) where status in ('pending', 'preparing');
create index challenges_challenger_idx on public.challenges (challenger_id, status);
create index challenges_challenged_idx on public.challenges (challenged_id, status);

create table public.challenge_entries (
  challenge_id uuid not null references public.challenges (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  packed_team text,
  updated_at timestamptz not null default pg_catalog.now(),
  primary key (challenge_id, user_id),
  constraint challenge_entries_team_size check (packed_team is null or octet_length(packed_team) <= 8192)
);
comment on table public.challenge_entries is 'Server-only team picks for a challenge. RLS enabled with no policies.';
create index challenge_entries_user_idx on public.challenge_entries (user_id);

create or replace function public.prevent_challenge_rule_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.challenger_id is distinct from old.challenger_id
    or new.challenged_id is distinct from old.challenged_id
    or new.format_id is distinct from old.format_id
    or new.timer_seconds is distinct from old.timer_seconds
    or new.ou_team_source is distinct from old.ou_team_source
    or new.invite_ttl_minutes is distinct from old.invite_ttl_minutes
    or new.expires_at is distinct from old.expires_at
    or new.create_request_id is distinct from old.create_request_id then
    raise exception 'challenge_rules_immutable' using errcode = 'P0020';
  end if;
  if old.status in ('started', 'declined', 'cancelled', 'expired') then
    raise exception 'challenge_closed' using errcode = 'P0021';
  end if;
  return new;
end;
$$;

create trigger challenges_rules_immutable before update on public.challenges
  for each row execute function public.prevent_challenge_rule_change();
create trigger challenges_set_updated_at before update on public.challenges
  for each row execute function public.set_updated_at();

alter table public.challenges enable row level security;
alter table public.challenge_entries enable row level security;

create policy challenges_select on public.challenges for select to authenticated
  using ((select auth.uid()) = challenger_id or (select auth.uid()) = challenged_id);

revoke all on table public.challenges from public, anon, authenticated;
revoke all on table public.challenge_entries from public, anon, authenticated;
grant select on table public.challenges to authenticated;

create or replace function public.expire_stale_challenges(p_user uuid)
returns void
language sql
security invoker
set search_path = ''
as $$
  update public.challenges
  set status = 'expired'
  where (challenger_id = p_user or challenged_id = p_user)
    and (
      (status = 'pending' and expires_at <= pg_catalog.now())
      or (status = 'preparing' and prepare_expires_at <= pg_catalog.now())
    );
$$;

create or replace function public.create_challenge(
  p_challenger uuid,
  p_challenged uuid,
  p_request_id uuid,
  p_format_id text,
  p_timer_seconds integer,
  p_ou_team_source text,
  p_invite_ttl_minutes integer
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  existing_id uuid;
  new_id uuid;
begin
  select c.id into existing_id from public.challenges as c
  where c.challenger_id = p_challenger and c.create_request_id = p_request_id;
  if existing_id is not null then
    return existing_id;
  end if;

  if not exists (
    select 1 from public.friendships as f
    where f.user_low = least(p_challenger, p_challenged) and f.user_high = greatest(p_challenger, p_challenged)
  ) then
    raise exception 'not_friends' using errcode = 'P0022';
  end if;

  perform public.expire_stale_challenges(p_challenger);

  select c.id into existing_id from public.challenges as c
  where least(c.challenger_id, c.challenged_id) = least(p_challenger, p_challenged)
    and greatest(c.challenger_id, c.challenged_id) = greatest(p_challenger, p_challenged)
    and c.status in ('pending', 'preparing');
  if existing_id is not null then
    raise exception 'challenge_exists' using errcode = 'P0023', detail = existing_id::text;
  end if;

  begin
    insert into public.challenges (
      challenger_id, challenged_id, format_id, timer_seconds, ou_team_source,
      invite_ttl_minutes, expires_at, create_request_id
    ) values (
      p_challenger, p_challenged, p_format_id, p_timer_seconds,
      case when p_format_id = 'gen9ou' then p_ou_team_source else 'saved' end,
      p_invite_ttl_minutes,
      pg_catalog.now() + pg_catalog.make_interval(mins => p_invite_ttl_minutes),
      p_request_id
    )
    returning id into new_id;
  exception when unique_violation then
    select c.id into existing_id from public.challenges as c
    where least(c.challenger_id, c.challenged_id) = least(p_challenger, p_challenged)
      and greatest(c.challenger_id, c.challenged_id) = greatest(p_challenger, p_challenged)
      and c.status in ('pending', 'preparing');
    raise exception 'challenge_exists' using errcode = 'P0023', detail = coalesce(existing_id::text, '');
  end;
  return new_id;
end;
$$;

create or replace function public.respond_challenge(p_user uuid, p_challenge_id uuid, p_action text)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  ch public.challenges%rowtype;
begin
  select * into ch from public.challenges where id = p_challenge_id for update;
  if not found or (ch.challenger_id <> p_user and ch.challenged_id <> p_user) then
    raise exception 'challenge_not_found' using errcode = 'P0002';
  end if;

  if ch.status = 'pending' and ch.expires_at <= pg_catalog.now() then
    update public.challenges set status = 'expired' where id = ch.id;
    return 'expired';
  end if;
  if ch.status = 'preparing' and ch.prepare_expires_at <= pg_catalog.now() then
    update public.challenges set status = 'expired' where id = ch.id;
    return 'expired';
  end if;

  if p_action = 'cancel' then
    if ch.status not in ('pending', 'preparing') then
      raise exception 'challenge_closed' using errcode = 'P0021';
    end if;
    if ch.status = 'pending' and ch.challenger_id <> p_user then
      raise exception 'challenge_not_found' using errcode = 'P0002';
    end if;
    update public.challenges set status = 'cancelled' where id = ch.id;
    return 'cancelled';
  end if;

  if ch.challenged_id <> p_user then
    raise exception 'challenge_not_found' using errcode = 'P0002';
  end if;
  if ch.status <> 'pending' then
    raise exception 'challenge_closed' using errcode = 'P0021';
  end if;
  if p_action = 'decline' then
    update public.challenges set status = 'declined' where id = ch.id;
    return 'declined';
  end if;
  if p_action = 'accept' then
    update public.challenges
    set status = 'preparing', prepare_expires_at = pg_catalog.now() + interval '10 minutes'
    where id = ch.id;
    return 'preparing';
  end if;
  raise exception 'bad_action' using errcode = '22023';
end;
$$;

create or replace function public.set_challenge_ready(p_user uuid, p_challenge_id uuid, p_packed_team text, p_ready boolean)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  ch public.challenges%rowtype;
  is_challenger boolean;
begin
  select * into ch from public.challenges where id = p_challenge_id for update;
  if not found or (ch.challenger_id <> p_user and ch.challenged_id <> p_user) then
    raise exception 'challenge_not_found' using errcode = 'P0002';
  end if;
  if ch.status = 'preparing' and ch.prepare_expires_at <= pg_catalog.now() then
    update public.challenges set status = 'expired' where id = ch.id;
    raise exception 'challenge_expired' using errcode = 'P0024';
  end if;
  if ch.status <> 'preparing' then
    raise exception 'challenge_closed' using errcode = 'P0021';
  end if;
  is_challenger := ch.challenger_id = p_user;

  if p_ready then
    insert into public.challenge_entries (challenge_id, user_id, packed_team, updated_at)
    values (ch.id, p_user, p_packed_team, pg_catalog.now())
    on conflict (challenge_id, user_id) do update set packed_team = excluded.packed_team, updated_at = excluded.updated_at;
  end if;

  if is_challenger then
    update public.challenges set challenger_ready = p_ready where id = ch.id returning * into ch;
  else
    update public.challenges set challenged_ready = p_ready where id = ch.id returning * into ch;
  end if;
  return ch.challenger_ready and ch.challenged_ready;
end;
$$;

revoke all on function public.prevent_challenge_rule_change() from public, anon, authenticated;
revoke all on function public.expire_stale_challenges(uuid) from public, anon, authenticated;
revoke all on function public.create_challenge(uuid, uuid, uuid, text, integer, text, integer) from public, anon, authenticated;
revoke all on function public.respond_challenge(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.set_challenge_ready(uuid, uuid, text, boolean) from public, anon, authenticated;
grant execute on function public.expire_stale_challenges(uuid) to service_role;
grant execute on function public.create_challenge(uuid, uuid, uuid, text, integer, text, integer) to service_role;
grant execute on function public.respond_challenge(uuid, uuid, text) to service_role;
grant execute on function public.set_challenge_ready(uuid, uuid, text, boolean) to service_role;

-- Removing a friend closes any open challenge between both users.
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
  update public.challenges set status = 'cancelled'
  where least(challenger_id, challenged_id) = least(p_user, p_friend)
    and greatest(challenger_id, challenged_id) = greatest(p_user, p_friend)
    and status in ('pending', 'preparing');
end;
$$;
revoke all on function public.remove_friend(uuid, uuid) from public, anon, authenticated;
grant execute on function public.remove_friend(uuid, uuid) to service_role;
