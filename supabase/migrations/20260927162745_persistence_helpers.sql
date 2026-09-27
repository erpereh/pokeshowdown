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
