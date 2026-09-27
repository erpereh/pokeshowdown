-- Team rows are written by the service role. Authenticated users may read their own
-- teams and may update only their display name.

alter table public.teams
  add constraint teams_packed_team_size check (octet_length(packed_team) <= 8192);

revoke insert, update, delete, truncate, references, trigger on table public.teams from public, anon, authenticated;
revoke insert, update, delete, truncate, references, trigger on table public.profiles from public, anon, authenticated;

grant update (display_name) on table public.profiles to authenticated;
