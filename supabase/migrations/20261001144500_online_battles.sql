-- Online battles: one shared match plus one `battles` row (seat) per player, stored from that player's perspective.

create table public.online_matches (
  id uuid primary key,
  challenge_id uuid unique references public.challenges (id) on delete set null,
  format_id text not null,
  engine_version text not null,
  p1_user_id uuid references auth.users (id) on delete set null,
  p2_user_id uuid references auth.users (id) on delete set null,
  p1_battle_id uuid not null,
  p2_battle_id uuid not null,
  status text not null default 'active',
  winner text,
  end_reason text,
  revision integer not null default 1,
  turn integer not null default 0,
  timer_seconds integer,
  p1_pending boolean not null default false,
  p2_pending boolean not null default false,
  p1_deadline timestamptz,
  p2_deadline timestamptz,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  finished_at timestamptz,
  constraint online_matches_format_check check (format_id in ('gen9ou', 'gen9randombattle')),
  constraint online_matches_status_check check (status in ('active', 'finished')),
  constraint online_matches_winner_check check (winner is null or winner in ('p1', 'p2', 'tie')),
  constraint online_matches_end_reason_check check (end_reason is null or end_reason in ('normal', 'forfeit', 'timeout')),
  constraint online_matches_timer_check check (timer_seconds is null or timer_seconds in (60, 120)),
  constraint online_matches_finish_shape check (
    (status = 'finished' and winner is not null and end_reason is not null and finished_at is not null)
    or (status = 'active' and winner is null and end_reason is null and finished_at is null)
  )
);
create index online_matches_p1_idx on public.online_matches (p1_user_id, status);
create index online_matches_p2_idx on public.online_matches (p2_user_id, status);

create table public.online_match_secrets (
  match_id uuid primary key references public.online_matches (id) on delete cascade,
  seed text not null,
  p1_team text not null,
  p2_team text not null,
  input_log text[] not null default '{}',
  checkpoint jsonb not null,
  constraint online_match_secrets_seed_length check (char_length(seed) between 1 and 200)
);
comment on table public.online_match_secrets is 'Server-only online battle secrets. RLS enabled with no policies.';

alter table public.challenges add constraint challenges_match_fk foreign key (match_id) references public.online_matches (id) on delete set null;

alter table public.battles add column match_id uuid references public.online_matches (id) on delete set null;
create index battles_match_idx on public.battles (match_id) where match_id is not null;
alter table public.battles drop constraint battles_mode_check;
alter table public.battles add constraint battles_mode_check check (
  (mode = 'singleplayer' and match_id is null) or mode = 'online'
);
alter table public.battles drop constraint battles_end_reason_check;
alter table public.battles add constraint battles_end_reason_check check (end_reason is null or end_reason in ('normal', 'forfeit', 'timeout'));

-- Seat rows may lose match_id when an orphaned match is removed; allow only that change on finished battles.
create or replace function public.prevent_finished_battle_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  battle_status text;
begin
  if tg_table_name = 'battles' then
    if tg_op = 'UPDATE' and old.status = 'finished' then
      if pg_catalog.pg_trigger_depth() > 1
        and new.match_id is null
        and (pg_catalog.to_jsonb(new) - 'match_id' - 'updated_at') = (pg_catalog.to_jsonb(old) - 'match_id' - 'updated_at') then
        return new;
      end if;
      raise exception 'battle_finished' using errcode = 'P0003';
    end if;
    return new;
  end if;

  if tg_table_name = 'battle_secrets' or tg_table_name = 'battle_replays' then
    if tg_op = 'UPDATE' then
      select b.status into battle_status
      from public.battles as b
      where b.id = old.battle_id;
      if battle_status = 'finished' then
        raise exception 'battle_finished' using errcode = 'P0003';
      end if;
    end if;
    return new;
  end if;

  if tg_table_name = 'online_match_secrets' then
    if tg_op = 'UPDATE' then
      select m.status into battle_status from public.online_matches as m where m.id = old.match_id;
      if battle_status = 'finished' then
        raise exception 'battle_finished' using errcode = 'P0003';
      end if;
    end if;
    return new;
  end if;

  if tg_table_name = 'battle_actions' and (tg_op = 'UPDATE' or tg_op = 'DELETE') then
    if tg_op = 'DELETE' and pg_catalog.pg_trigger_depth() > 1 then
      return old;
    end if;
    select b.status into battle_status
    from public.battles as b
    where b.id = old.battle_id;
    if battle_status = 'finished' then
      raise exception 'battle_finished' using errcode = 'P0003';
    end if;
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  return coalesce(new, old);
end;
$$;

create trigger online_matches_set_updated_at before update on public.online_matches
  for each row execute function public.set_updated_at();
create trigger online_match_secrets_immutable before update on public.online_match_secrets
  for each row execute function public.prevent_finished_battle_mutation();

alter table public.online_matches enable row level security;
alter table public.online_match_secrets enable row level security;
create policy online_matches_select on public.online_matches for select to authenticated
  using ((select auth.uid()) = p1_user_id or (select auth.uid()) = p2_user_id);

revoke all on table public.online_matches from public, anon, authenticated;
revoke all on table public.online_match_secrets from public, anon, authenticated;
grant select on table public.online_matches to authenticated;

create or replace function public.create_online_match(
  p_match_id uuid,
  p_challenge_id uuid,
  p_engine_version text,
  p_background text,
  p_p1_battle_id uuid,
  p_p2_battle_id uuid,
  p_p1_name text,
  p_p2_name text,
  p_turn integer,
  p_p1_request jsonb,
  p_p2_request jsonb,
  p_p1_initial jsonb,
  p_p2_initial jsonb,
  p_p1_frame jsonb,
  p_p2_frame jsonb,
  p_p1_pending boolean,
  p_p2_pending boolean,
  p_seed text,
  p_p1_team text,
  p_p2_team text,
  p_input_log text[],
  p_checkpoint jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  ch public.challenges%rowtype;
  existing uuid;
begin
  select * into ch from public.challenges where id = p_challenge_id for update;
  if not found then
    raise exception 'challenge_not_found' using errcode = 'P0002';
  end if;
  select m.id into existing from public.online_matches as m where m.challenge_id = p_challenge_id;
  if existing is not null then
    return existing;
  end if;
  if ch.status <> 'preparing' or not (ch.challenger_ready and ch.challenged_ready) then
    raise exception 'challenge_not_ready' using errcode = 'P0025';
  end if;

  insert into public.online_matches (
    id, challenge_id, format_id, engine_version, p1_user_id, p2_user_id, p1_battle_id, p2_battle_id,
    turn, timer_seconds, p1_pending, p2_pending, p1_deadline, p2_deadline
  ) values (
    p_match_id, ch.id, ch.format_id, p_engine_version, ch.challenger_id, ch.challenged_id,
    p_p1_battle_id, p_p2_battle_id, p_turn, ch.timer_seconds, p_p1_pending, p_p2_pending,
    case when ch.timer_seconds is not null and p_p1_pending then pg_catalog.now() + pg_catalog.make_interval(secs => ch.timer_seconds) end,
    case when ch.timer_seconds is not null and p_p2_pending then pg_catalog.now() + pg_catalog.make_interval(secs => ch.timer_seconds) end
  );

  insert into public.online_match_secrets (match_id, seed, p1_team, p2_team, input_log, checkpoint)
  values (p_match_id, p_seed, p_p1_team, p_p2_team, p_input_log, p_checkpoint);

  insert into public.battles (
    id, owner_id, mode, format_id, engine_version, status, turn, revision, background,
    player_name, cpu_name, p1_request, initial_state, frames, create_request_id, match_id
  ) values
    (p_p1_battle_id, ch.challenger_id, 'online', ch.format_id, p_engine_version, 'active', p_turn, 1, p_background,
     p_p1_name, p_p2_name, p_p1_request, p_p1_initial, jsonb_build_array(p_p1_frame), ch.id, p_match_id),
    (p_p2_battle_id, ch.challenged_id, 'online', ch.format_id, p_engine_version, 'active', p_turn, 1, p_background,
     p_p2_name, p_p1_name, p_p2_request, p_p2_initial, jsonb_build_array(p_p2_frame), ch.id, p_match_id);

  update public.challenges set status = 'started', match_id = p_match_id where id = ch.id;
  return p_match_id;
end;
$$;

create or replace function public.finish_online_seat(p_battle_id uuid, p_result_winner text, p_end_reason text, p_turn integer)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  seat public.battles%rowtype;
  result_label text;
begin
  select * into seat from public.battles where id = p_battle_id;
  result_label := case p_result_winner when 'p1' then 'win' when 'p2' then 'loss' when 'tie' then 'tie' else null end;
  if result_label is null then
    raise exception 'finished battle requires winner' using errcode = '23514';
  end if;
  insert into public.battle_replays (battle_id, owner_id, format_id, engine_version, result, turns, replay)
  values (
    seat.id, seat.owner_id, seat.format_id, seat.engine_version, result_label, p_turn,
    jsonb_build_object(
      'id', seat.id, 'battleId', seat.id, 'formatId', seat.format_id,
      'result', result_label, 'endReason', p_end_reason, 'turn', p_turn,
      'engineVersion', seat.engine_version, 'background', seat.background,
      'playerName', seat.player_name, 'cpuName', seat.cpu_name,
      'initialState', seat.initial_state, 'frames', seat.frames,
      'state', coalesce(seat.frames -> -1 -> 'state', seat.initial_state),
      'createdAt', seat.created_at, 'updatedAt', pg_catalog.now()
    )
  );
end;
$$;

create or replace function public.commit_online_step(
  p_match_id uuid,
  p_expected_revision integer,
  p_actor_side text,
  p_client_request_id uuid,
  p_kind text,
  p_choice jsonb,
  p_timeout_sides text[],
  p_input_log_delta text[],
  p_checkpoint jsonb,
  p_advanced boolean,
  p_p1_frame jsonb,
  p_p2_frame jsonb,
  p_p1_request jsonb,
  p_p2_request jsonb,
  p_p1_pending boolean,
  p_p2_pending boolean,
  p_turn integer,
  p_status text,
  p_winner text,
  p_end_reason text
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  m public.online_matches%rowtype;
  actor_battle uuid;
  finished boolean := p_status = 'finished';
  now_ts timestamptz := pg_catalog.now();
  timer interval;
  side_winner text;
  seat_id uuid;
  seat_side text;
begin
  select * into m from public.online_matches where id = p_match_id for update;
  if not found then
    raise exception 'battle_not_found' using errcode = 'P0002';
  end if;
  if m.status = 'finished' then
    raise exception 'battle_finished' using errcode = 'P0003';
  end if;
  if m.revision <> p_expected_revision then
    raise exception 'stale_revision' using errcode = 'P0004';
  end if;
  if finished and (p_winner is null or p_end_reason is null) then
    raise exception 'finished battle requires winner and end_reason' using errcode = '23514';
  end if;

  if p_kind = 'timeout' then
    if p_timeout_sides is null or pg_catalog.array_length(p_timeout_sides, 1) is null then
      raise exception 'timeout_without_sides' using errcode = '22023';
    end if;
    if ('p1' = any (p_timeout_sides) and not (m.p1_pending and m.p1_deadline is not null and m.p1_deadline <= now_ts))
      or ('p2' = any (p_timeout_sides) and not (m.p2_pending and m.p2_deadline is not null and m.p2_deadline <= now_ts)) then
      raise exception 'deadline_not_reached' using errcode = 'P0005';
    end if;
  else
    actor_battle := case p_actor_side when 'p1' then m.p1_battle_id when 'p2' then m.p2_battle_id else null end;
    if actor_battle is null then
      raise exception 'bad_actor' using errcode = '22023';
    end if;
    insert into public.battle_actions (battle_id, client_request_id, kind, revision_before, p1_choice)
    values (actor_battle, p_client_request_id, p_kind, p_expected_revision, p_choice);
  end if;

  update public.online_match_secrets
  set input_log = input_log || p_input_log_delta, checkpoint = p_checkpoint
  where match_id = p_match_id;

  foreach seat_side in array array['p1', 'p2'] loop
    seat_id := case seat_side when 'p1' then m.p1_battle_id else m.p2_battle_id end;
    side_winner := case
      when not finished then null
      when p_winner = 'tie' then 'tie'
      when p_winner = seat_side then 'p1'
      else 'p2'
    end;
    update public.battles as b
    set
      revision = case when p_advanced then b.revision + 1 else b.revision end,
      frames = case when p_advanced then b.frames || jsonb_build_array(case seat_side when 'p1' then p_p1_frame else p_p2_frame end) else b.frames end,
      p1_request = case when finished then null when seat_side = 'p1' then p_p1_request else p_p2_request end,
      turn = p_turn,
      status = p_status,
      winner = side_winner,
      end_reason = case when finished then p_end_reason else null end,
      finished_at = case when finished then now_ts else null end
    where b.id = seat_id;
    if finished then
      perform public.finish_online_seat(seat_id, side_winner, p_end_reason, p_turn);
    end if;
  end loop;

  timer := case when m.timer_seconds is null then null else pg_catalog.make_interval(secs => m.timer_seconds) end;
  update public.online_matches
  set
    revision = m.revision + 1,
    turn = p_turn,
    status = p_status,
    winner = case when finished then p_winner else null end,
    end_reason = case when finished then p_end_reason else null end,
    finished_at = case when finished then now_ts else null end,
    p1_pending = not finished and p_p1_pending,
    p2_pending = not finished and p_p2_pending,
    p1_deadline = case
      when finished or timer is null or not p_p1_pending then null
      when p_advanced or m.p1_deadline is null or not m.p1_pending then now_ts + timer
      else m.p1_deadline end,
    p2_deadline = case
      when finished or timer is null or not p_p2_pending then null
      when p_advanced or m.p2_deadline is null or not m.p2_pending then now_ts + timer
      else m.p2_deadline end
  where id = p_match_id;
end;
$$;

revoke all on function public.create_online_match(uuid, uuid, text, text, uuid, uuid, text, text, integer, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, boolean, boolean, text, text, text, text[], jsonb) from public, anon, authenticated;
revoke all on function public.finish_online_seat(uuid, text, text, integer) from public, anon, authenticated;
revoke all on function public.commit_online_step(uuid, integer, text, uuid, text, jsonb, text[], text[], jsonb, boolean, jsonb, jsonb, jsonb, jsonb, boolean, boolean, integer, text, text, text) from public, anon, authenticated;
grant execute on function public.create_online_match(uuid, uuid, text, text, uuid, uuid, text, text, integer, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, boolean, boolean, text, text, text, text[], jsonb) to service_role;
grant execute on function public.finish_online_seat(uuid, text, text, integer) to service_role;
grant execute on function public.commit_online_step(uuid, integer, text, uuid, text, jsonb, text[], text[], jsonb, boolean, jsonb, jsonb, jsonb, jsonb, boolean, boolean, integer, text, text, text) to service_role;
