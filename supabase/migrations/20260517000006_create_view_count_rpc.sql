create or replace function public.increment_view_count(p_slug text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.ratings set view_count = view_count + 1 where slug = p_slug;
$$;
revoke all on function public.increment_view_count(text) from public, anon, authenticated;
