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
  finished_at timestamptz;
begin
  select * into locked
  from public.battles
  where id = p_battle_id and owner_id = p_owner_id
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

  insert into public.battle_actions (battle_id, client_request_id, kind, revision_before, p1_choice)
  values (p_battle_id, p_client_request_id, p_kind, p_expected_revision, p_p1_choice);

  update public.battle_secrets
  set input_log = input_log || p_input_log_delta, checkpoint = p_checkpoint
  where battle_id = p_battle_id;

  next_frames := locked.frames || jsonb_build_array(p_frame);
  finished_at := case when p_status = 'finished' then pg_catalog.now() else null end;

  update public.battles
  set
    revision = locked.revision + 1,
    frames = next_frames,
    p1_request = case when p_status = 'finished' then null else p_p1_request end,
    turn = p_turn,
    status = p_status,
    winner = case when p_status = 'finished' then p_winner else null end,
    end_reason = case when p_status = 'finished' then p_end_reason else null end,
    finished_at = finished_at
  where id = p_battle_id;

  if p_status = 'finished' then
    result_label := case p_winner when 'p1' then 'win' when 'p2' then 'loss' when 'tie' then 'tie' else null end;
    if result_label is null or p_end_reason is null then
      raise exception 'finished battle requires winner and end_reason' using errcode = '23514';
    end if;
    insert into public.battle_replays (battle_id, owner_id, format_id, engine_version, result, turns, replay)
    values (
      p_battle_id, locked.owner_id, locked.format_id, locked.engine_version, result_label, p_turn,
      jsonb_build_object(
        'id', p_battle_id, 'battleId', p_battle_id, 'formatId', locked.format_id,
        'result', result_label, 'endReason', p_end_reason, 'turn', p_turn,
        'engineVersion', locked.engine_version, 'background', locked.background,
        'playerName', locked.player_name, 'cpuName', locked.cpu_name,
        'initialState', locked.initial_state, 'frames', next_frames,
        'state', coalesce(p_frame -> 'state', locked.initial_state),
        'createdAt', locked.created_at, 'updatedAt', pg_catalog.now()
      )
    );
  end if;
end;
$$;

revoke all on function public.commit_battle_turn(uuid, uuid, integer, uuid, text, jsonb, text[], jsonb, jsonb, jsonb, integer, text, text, text) from public, anon, authenticated;
grant execute on function public.commit_battle_turn(uuid, uuid, integer, uuid, text, jsonb, text[], jsonb, jsonb, jsonb, integer, text, text, text) to service_role;
