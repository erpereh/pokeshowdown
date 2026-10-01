-- Realtime is only a change signal; clients refetch through the API. No secrets or teams live in these tables.
alter publication supabase_realtime add table public.friend_requests;
alter publication supabase_realtime add table public.challenges;
alter publication supabase_realtime add table public.online_matches;
