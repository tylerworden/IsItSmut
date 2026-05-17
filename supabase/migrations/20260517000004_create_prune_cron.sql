-- Requires pg_cron extension. Enable in Supabase dashboard under Database → Extensions.
-- Migration is idempotent: extension creation is conditional.

create extension if not exists pg_cron with schema extensions;

select cron.schedule(
  'prune-rate-limits',
  '0 3 * * *',
  $$delete from public.rate_limits where window_start < now() - interval '2 days'$$
);
