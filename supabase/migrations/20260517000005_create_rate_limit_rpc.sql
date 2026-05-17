create or replace function public.rate_limit_increment(
  p_ip_hash text,
  p_window_start timestamptz
) returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  new_count int;
begin
  insert into public.rate_limits (ip_hash, window_start, count)
  values (p_ip_hash, p_window_start, 1)
  on conflict (ip_hash, window_start)
  do update set count = public.rate_limits.count + 1
  returning count into new_count;
  return new_count;
end;
$$;

revoke all on function public.rate_limit_increment(text, timestamptz) from public, anon, authenticated;
