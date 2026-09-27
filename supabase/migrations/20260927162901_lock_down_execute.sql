revoke all on function public.handle_new_user() from service_role;
revoke all on function public.prevent_finished_battle_mutation() from authenticated;
revoke all on function public.rls_auto_enable() from public, anon, authenticated;
