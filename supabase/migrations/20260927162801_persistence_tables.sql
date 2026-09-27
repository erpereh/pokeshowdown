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
    (status = 'finished' and winner is not null and end_reason is not null and finished_at is not null)
    or (status = 'active' and winner is null and end_reason is null and finished_at is null)
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

comment on table public.battle_secrets is 'Server-only battle secrets. RLS enabled with no policies. anon and authenticated have no privileges.';

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
    (kind = 'forfeit' and p1_choice is null) or (kind = 'choice' and p1_choice is not null)
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
