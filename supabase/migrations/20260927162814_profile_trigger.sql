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

revoke all on function public.handle_new_user() from public, anon, authenticated;
grant execute on function public.handle_new_user() to supabase_auth_admin;
