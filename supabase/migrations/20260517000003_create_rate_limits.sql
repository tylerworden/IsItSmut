create table public.rate_limits (
  ip_hash       text not null,
  window_start  timestamptz not null,
  count         int not null default 0,
  primary key (ip_hash, window_start)
);

alter table public.rate_limits enable row level security;

-- No policies = no access from anon/authenticated.
-- Server uses service-role key which bypasses RLS.
