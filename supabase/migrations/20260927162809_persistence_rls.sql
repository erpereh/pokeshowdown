create index teams_owner_updated_idx on public.teams (owner_id, updated_at desc);
create index battles_owner_status_updated_idx on public.battles (owner_id, status, updated_at desc);
create index battle_replays_owner_id_idx on public.battle_replays (owner_id);

create trigger profiles_set_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger teams_set_updated_at before update on public.teams for each row execute function public.set_updated_at();
create trigger battles_set_updated_at before update on public.battles for each row execute function public.set_updated_at();
create trigger battles_immutable before update on public.battles for each row execute function public.prevent_finished_battle_mutation();
create trigger battle_secrets_immutable before update on public.battle_secrets for each row execute function public.prevent_finished_battle_mutation();
create trigger battle_replays_immutable before update on public.battle_replays for each row execute function public.prevent_finished_battle_mutation();
create trigger battle_actions_immutable before update or delete on public.battle_actions for each row execute function public.prevent_finished_battle_mutation();

alter table public.profiles enable row level security;
alter table public.teams enable row level security;
alter table public.battles enable row level security;
alter table public.battle_secrets enable row level security;
alter table public.battle_actions enable row level security;
alter table public.battle_replays enable row level security;

create policy profiles_select on public.profiles for select to authenticated using ((select auth.uid()) = user_id);
create policy profiles_update on public.profiles for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy teams_select on public.teams for select to authenticated using ((select auth.uid()) = owner_id);
create policy teams_insert on public.teams for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy teams_update on public.teams for update to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy teams_delete on public.teams for delete to authenticated using ((select auth.uid()) = owner_id);
create policy battles_select on public.battles for select to authenticated using ((select auth.uid()) = owner_id);
create policy battle_actions_select on public.battle_actions for select to authenticated using (exists (select 1 from public.battles as b where b.id = battle_id and b.owner_id = (select auth.uid())));
create policy battle_replays_select on public.battle_replays for select to authenticated using ((select auth.uid()) = owner_id);

revoke all on table public.profiles from anon;
revoke all on table public.teams from anon;
revoke all on table public.battles from anon, authenticated;
revoke all on table public.battle_actions from anon, authenticated;
revoke all on table public.battle_replays from anon, authenticated;
revoke all on table public.battle_secrets from anon, authenticated, public;
grant select on table public.battles to authenticated;
grant select on table public.battle_actions to authenticated;
grant select on table public.battle_replays to authenticated;

revoke all on function public.set_updated_at() from public, anon;
revoke all on function public.prevent_finished_battle_mutation() from public, anon;
grant execute on function public.set_updated_at() to authenticated, service_role, supabase_auth_admin;
grant execute on function public.prevent_finished_battle_mutation() to service_role, supabase_auth_admin;
