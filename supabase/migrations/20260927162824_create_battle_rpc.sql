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
    id, owner_id, mode, format_id, engine_version, status, winner, end_reason,
    turn, revision, background, player_name, cpu_name, p1_request, initial_state,
    frames, create_request_id, finished_at
  ) values (
    p_id, p_owner_id, 'singleplayer', p_format_id, p_engine_version, p_status,
    case when p_status = 'finished' then p_winner else null end,
    case when p_status = 'finished' then p_end_reason else null end,
    p_turn, 1, p_background, p_player_name, p_cpu_name,
    case when p_status = 'finished' then null else p_p1_request end,
    p_initial_state, jsonb_build_array(p_frame), p_create_request_id,
    case when p_status = 'finished' then pg_catalog.now() else null end
  )
  on conflict (owner_id, create_request_id) do nothing
  returning id into new_battle_id;

  if new_battle_id is null then
    select b.id into new_battle_id
    from public.battles as b
    where b.owner_id = p_owner_id and b.create_request_id = p_create_request_id;
    return new_battle_id;
  end if;

  insert into public.battle_secrets (battle_id, seed, p1_team, p2_team, input_log, checkpoint)
  values (new_battle_id, p_seed, p_p1_team, p_p2_team, p_input_log, p_checkpoint);

  if p_status = 'finished' then
    result_label := case p_winner when 'p1' then 'win' when 'p2' then 'loss' when 'tie' then 'tie' else null end;
    if result_label is null or p_end_reason is null then
      raise exception 'finished battle requires winner and end_reason' using errcode = '23514';
    end if;
    select b.created_at, b.frames into created_at, stored_frames from public.battles as b where b.id = new_battle_id;
    insert into public.battle_replays (battle_id, owner_id, format_id, engine_version, result, turns, replay)
    values (
      new_battle_id, p_owner_id, p_format_id, p_engine_version, result_label, p_turn,
      jsonb_build_object(
        'id', new_battle_id, 'battleId', new_battle_id, 'formatId', p_format_id,
        'result', result_label, 'endReason', p_end_reason, 'turn', p_turn,
        'engineVersion', p_engine_version, 'background', p_background,
        'playerName', p_player_name, 'cpuName', p_cpu_name,
        'initialState', p_initial_state, 'frames', stored_frames,
        'state', coalesce(p_frame -> 'state', p_initial_state),
        'createdAt', created_at, 'updatedAt', created_at
      )
    );
  end if;
  return new_battle_id;
end;
$$;

revoke all on function public.create_battle(uuid, uuid, uuid, text, text, text, text, text, integer, jsonb, jsonb, jsonb, text, text, text, text[], jsonb, text, text, text) from public, anon, authenticated;
grant execute on function public.create_battle(uuid, uuid, uuid, text, text, text, text, text, integer, jsonb, jsonb, jsonb, text, text, text, text[], jsonb, text, text, text) to service_role;
