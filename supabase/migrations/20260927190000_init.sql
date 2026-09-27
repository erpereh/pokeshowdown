-- PokeShowdown persistence: profiles, teams, single-player battles, secrets, actions, replays.
-- Writers of battle state are service_role RPCs. Clients read their own rows through RLS.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := pg_catalog.now();
  return new;
end;
$$;

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

  if tg_table_name = 'battle_actions' and (tg_op = 'UPDATE' or tg_op = 'DELETE') then
    -- Nested deletes are cascades from battles / auth.users and must succeed.
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

create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  constraint profiles_display_name_length check (char_length(display_name) between 1 and 32)
);

create table public.teams (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  format_id text not null,
  packed_team text not null,
  valid boolean not null,
  engine_version text not null,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  constraint teams_format_id_check check (format_id in ('gen9ou')),
  constraint teams_name_length check (char_length(name) between 1 and 40),
  constraint teams_engine_version_length check (char_length(engine_version) between 1 and 32)
);

create table public.battles (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  mode text not null default 'singleplayer',
  format_id text not null,
  engine_version text not null,
  status text not null,
  winner text,
  end_reason text,
  turn integer not null,
  revision integer not null,
  background text not null,
  player_name text not null,
  cpu_name text not null,
  p1_request jsonb,
  initial_state jsonb not null,
  frames jsonb not null default '[]'::jsonb,
  create_request_id uuid not null,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  finished_at timestamptz,
  constraint battles_owner_create_request unique (owner_id, create_request_id),
  constraint battles_mode_check check (mode = 'singleplayer'),
  constraint battles_format_id_check check (format_id in ('gen9ou', 'gen9randombattle')),
  constraint battles_status_check check (status in ('active', 'finished')),
  constraint battles_winner_check check (winner is null or winner in ('p1', 'p2', 'tie')),
  constraint battles_end_reason_check check (end_reason is null or end_reason in ('normal', 'forfeit')),
  constraint battles_turn_check check (turn >= 0),
  constraint battles_revision_check check (revision >= 1),
  constraint battles_background_length check (char_length(background) between 1 and 80),
  constraint battles_player_name_length check (char_length(player_name) between 1 and 32),
  constraint battles_cpu_name_length check (char_length(cpu_name) between 1 and 32),
  constraint battles_engine_version_length check (char_length(engine_version) between 1 and 32),
  constraint battles_finish_shape check (
    (
      status = 'finished'
      and winner is not null
      and end_reason is not null
      and finished_at is not null
    )
    or (
      status = 'active'
      and winner is null
      and end_reason is null
      and finished_at is null
    )
  )
);

create table public.battle_secrets (
  battle_id uuid primary key references public.battles (id) on delete cascade,
  seed text not null,
  p1_team text not null,
  p2_team text not null,
  input_log text[] not null default '{}',
  checkpoint jsonb not null,
  constraint battle_secrets_seed_length check (char_length(seed) between 1 and 200)
);

comment on table public.battle_secrets is
  'Server-only battle secrets. RLS enabled with no policies. anon and authenticated have no privileges.';

create table public.battle_actions (
  id bigint generated always as identity primary key,
  battle_id uuid not null references public.battles (id) on delete cascade,
  client_request_id uuid not null,
  kind text not null,
  revision_before integer not null,
  p1_choice jsonb,
  created_at timestamptz not null default pg_catalog.now(),
  constraint battle_actions_client_request unique (battle_id, client_request_id),
  constraint battle_actions_revision unique (battle_id, revision_before),
  constraint battle_actions_kind_check check (kind in ('choice', 'forfeit')),
  constraint battle_actions_revision_check check (revision_before >= 1),
  constraint battle_actions_choice_shape check (
    (kind = 'forfeit' and p1_choice is null)
    or (kind = 'choice' and p1_choice is not null)
  )
);

create table public.battle_replays (
  battle_id uuid primary key references public.battles (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  format_id text not null,
  engine_version text not null,
  result text not null,
  turns integer not null,
  replay jsonb not null,
  created_at timestamptz not null default pg_catalog.now(),
  constraint battle_replays_format_id_check check (format_id in ('gen9ou', 'gen9randombattle')),
  constraint battle_replays_result_check check (result in ('win', 'loss', 'tie')),
  constraint battle_replays_turns_check check (turns >= 0),
  constraint battle_replays_engine_version_length check (char_length(engine_version) between 1 and 32)
);

create index teams_owner_updated_idx on public.teams (owner_id, updated_at desc);
create index battles_owner_status_updated_idx on public.battles (owner_id, status, updated_at desc);
create index battle_replays_owner_id_idx on public.battle_replays (owner_id);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger teams_set_updated_at
  before update on public.teams
  for each row execute function public.set_updated_at();

create trigger battles_set_updated_at
  before update on public.battles
  for each row execute function public.set_updated_at();

create trigger battles_immutable
  before update on public.battles
  for each row execute function public.prevent_finished_battle_mutation();

create trigger battle_secrets_immutable
  before update on public.battle_secrets
  for each row execute function public.prevent_finished_battle_mutation();

create trigger battle_replays_immutable
  before update on public.battle_replays
  for each row execute function public.prevent_finished_battle_mutation();

create trigger battle_actions_immutable
  before update or delete on public.battle_actions
  for each row execute function public.prevent_finished_battle_mutation();

alter table public.profiles enable row level security;
alter table public.teams enable row level security;
alter table public.battles enable row level security;
alter table public.battle_secrets enable row level security;
alter table public.battle_actions enable row level security;
alter table public.battle_replays enable row level security;

create policy profiles_select on public.profiles
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy profiles_update on public.profiles
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy teams_select on public.teams
  for select to authenticated
  using ((select auth.uid()) = owner_id);

create policy teams_insert on public.teams
  for insert to authenticated
  with check ((select auth.uid()) = owner_id);

create policy teams_update on public.teams
  for update to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

create policy teams_delete on public.teams
  for delete to authenticated
  using ((select auth.uid()) = owner_id);

create policy battles_select on public.battles
  for select to authenticated
  using ((select auth.uid()) = owner_id);

create policy battle_actions_select on public.battle_actions
  for select to authenticated
  using (
    exists (
      select 1
      from public.battles as b
      where b.id = battle_id
        and b.owner_id = (select auth.uid())
    )
  );

create policy battle_replays_select on public.battle_replays
  for select to authenticated
  using ((select auth.uid()) = owner_id);

revoke all on table public.profiles from anon;
revoke all on table public.teams from anon;
revoke all on table public.battles from anon, authenticated;
revoke all on table public.battle_actions from anon, authenticated;
revoke all on table public.battle_replays from anon, authenticated;
revoke all on table public.battle_secrets from anon, authenticated, public;

grant select on table public.battles to authenticated;
grant select on table public.battle_actions to authenticated;
grant select on table public.battle_replays to authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  display_name text;
begin
  display_name := nullif(btrim(new.raw_user_meta_data ->> 'display_name'), '');
  if display_name is null then
    display_name := nullif(split_part(coalesce(new.email, ''), '@', 1), '');
  end if;
  if display_name is null then
    display_name := 'Player';
  end if;
  display_name := left(display_name, 32);

  insert into public.profiles (user_id, display_name)
  values (new.id, display_name);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.create_battle(
  p_id uuid,
  p_owner_id uuid,
  p_create_request_id uuid,
  p_format_id text,
  p_engine_version text,
  p_background text,
  p_player_name text,
  p_cpu_name text,
  p_turn integer,
  p_p1_request jsonb,
  p_initial_state jsonb,
  p_frame jsonb,
  p_seed text,
  p_p1_team text,
  p_p2_team text,
  p_input_log text[],
  p_checkpoint jsonb,
  p_status text default 'active',
  p_winner text default null,
  p_end_reason text default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  new_battle_id uuid;
  created_at timestamptz;
  result_label text;
  stored_frames jsonb;
begin
  insert into public.battles (
    id,
    owner_id,
    mode,
    format_id,
    engine_version,
    status,
    winner,
    end_reason,
    turn,
    revision,
    background,
    player_name,
    cpu_name,
    p1_request,
    initial_state,
    frames,
    create_request_id,
    finished_at
  ) values (
    p_id,
    p_owner_id,
    'singleplayer',
    p_format_id,
    p_engine_version,
    p_status,
    case when p_status = 'finished' then p_winner else null end,
    case when p_status = 'finished' then p_end_reason else null end,
    p_turn,
    1,
    p_background,
    p_player_name,
    p_cpu_name,
    case when p_status = 'finished' then null else p_p1_request end,
    p_initial_state,
    jsonb_build_array(p_frame),
    p_create_request_id,
    case when p_status = 'finished' then pg_catalog.now() else null end
  )
  on conflict (owner_id, create_request_id) do nothing
  returning id into new_battle_id;

  if new_battle_id is null then
    select b.id into new_battle_id
    from public.battles as b
    where b.owner_id = p_owner_id
      and b.create_request_id = p_create_request_id;
    return new_battle_id;
  end if;

  insert into public.battle_secrets (battle_id, seed, p1_team, p2_team, input_log, checkpoint)
  values (new_battle_id, p_seed, p_p1_team, p_p2_team, p_input_log, p_checkpoint);

  if p_status = 'finished' then
    result_label := case p_winner
      when 'p1' then 'win'
      when 'p2' then 'loss'
      when 'tie' then 'tie'
      else null
    end;
    if result_label is null or p_end_reason is null then
      raise exception 'finished battle requires winner and end_reason' using errcode = '23514';
    end if;

    select b.created_at, b.frames into created_at, stored_frames
    from public.battles as b
    where b.id = new_battle_id;

    insert into public.battle_replays (
      battle_id, owner_id, format_id, engine_version, result, turns, replay
    ) values (
      new_battle_id,
      p_owner_id,
      p_format_id,
      p_engine_version,
      result_label,
      p_turn,
      jsonb_build_object(
        'id', new_battle_id,
        'battleId', new_battle_id,
        'formatId', p_format_id,
        'result', result_label,
        'endReason', p_end_reason,
        'turn', p_turn,
        'engineVersion', p_engine_version,
        'background', p_background,
        'playerName', p_player_name,
        'cpuName', p_cpu_name,
        'initialState', p_initial_state,
        'frames', stored_frames,
        'state', coalesce(p_frame -> 'state', p_initial_state),
        'createdAt', created_at,
        'updatedAt', created_at
      )
    );
  end if;

  return new_battle_id;
end;
$$;

create or replace function public.commit_battle_turn(
  p_battle_id uuid,
  p_owner_id uuid,
  p_expected_revision integer,
  p_client_request_id uuid,
  p_kind text,
  p_p1_choice jsonb,
  p_input_log_delta text[],
  p_frame jsonb,
  p_p1_request jsonb,
  p_checkpoint jsonb,
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
  locked public.battles%rowtype;
  next_frames jsonb;
  result_label text;
  v_finished_at timestamptz;
begin
  select * into locked
  from public.battles
  where id = p_battle_id
    and owner_id = p_owner_id
  for update;

  if not found then
    raise exception 'battle_not_found' using errcode = 'P0002';
  end if;

  if locked.status = 'finished' then
    raise exception 'battle_finished' using errcode = 'P0003';
  end if;

  if locked.revision <> p_expected_revision then
    raise exception 'stale_revision' using errcode = 'P0004';
  end if;

  insert into public.battle_actions (
    battle_id, client_request_id, kind, revision_before, p1_choice
  ) values (
    p_battle_id,
    p_client_request_id,
    p_kind,
    p_expected_revision,
    p_p1_choice
  );

  update public.battle_secrets
  set
    input_log = input_log || p_input_log_delta,
    checkpoint = p_checkpoint
  where battle_id = p_battle_id;

  next_frames := locked.frames || jsonb_build_array(p_frame);
  v_finished_at := case when p_status = 'finished' then pg_catalog.now() else null end;

  update public.battles
  set
    revision = locked.revision + 1,
    frames = next_frames,
    p1_request = case when p_status = 'finished' then null else p_p1_request end,
    turn = p_turn,
    status = p_status,
    winner = case when p_status = 'finished' then p_winner else null end,
    end_reason = case when p_status = 'finished' then p_end_reason else null end,
    finished_at = v_finished_at
  where id = p_battle_id;

  if p_status = 'finished' then
    result_label := case p_winner
      when 'p1' then 'win'
      when 'p2' then 'loss'
      when 'tie' then 'tie'
      else null
    end;
    if result_label is null or p_end_reason is null then
      raise exception 'finished battle requires winner and end_reason' using errcode = '23514';
    end if;

    insert into public.battle_replays (
      battle_id, owner_id, format_id, engine_version, result, turns, replay
    ) values (
      p_battle_id,
      locked.owner_id,
      locked.format_id,
      locked.engine_version,
      result_label,
      p_turn,
      jsonb_build_object(
        'id', p_battle_id,
        'battleId', p_battle_id,
        'formatId', locked.format_id,
        'result', result_label,
        'endReason', p_end_reason,
        'turn', p_turn,
        'engineVersion', locked.engine_version,
        'background', locked.background,
        'playerName', locked.player_name,
        'cpuName', locked.cpu_name,
        'initialState', locked.initial_state,
        'frames', next_frames,
        'state', coalesce(p_frame -> 'state', locked.initial_state),
        'createdAt', locked.created_at,
        'updatedAt', pg_catalog.now()
      )
    );
  end if;
end;
$$;

revoke all on function public.set_updated_at() from public, anon;
revoke all on function public.prevent_finished_battle_mutation() from public, anon, authenticated;
grant execute on function public.set_updated_at() to authenticated, service_role, supabase_auth_admin;
grant execute on function public.prevent_finished_battle_mutation() to service_role, supabase_auth_admin;

revoke all on function public.handle_new_user() from public, anon, authenticated, service_role;
grant execute on function public.handle_new_user() to supabase_auth_admin;

do $$
begin
  if exists (
    select 1
    from pg_proc as p
    join pg_namespace as n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'rls_auto_enable'
  ) then
    revoke all on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end;
$$;

revoke all on function public.create_battle(uuid, uuid, uuid, text, text, text, text, text, integer, jsonb, jsonb, jsonb, text, text, text, text[], jsonb, text, text, text) from public, anon, authenticated;
revoke all on function public.commit_battle_turn(uuid, uuid, integer, uuid, text, jsonb, text[], jsonb, jsonb, jsonb, integer, text, text, text) from public, anon, authenticated;
grant execute on function public.create_battle(uuid, uuid, uuid, text, text, text, text, text, integer, jsonb, jsonb, jsonb, text, text, text, text[], jsonb, text, text, text) to service_role;
grant execute on function public.commit_battle_turn(uuid, uuid, integer, uuid, text, jsonb, text[], jsonb, jsonb, jsonb, integer, text, text, text) to service_role;
