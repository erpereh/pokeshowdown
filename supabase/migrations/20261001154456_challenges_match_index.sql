create index challenges_match_idx on public.challenges (match_id) where match_id is not null;
