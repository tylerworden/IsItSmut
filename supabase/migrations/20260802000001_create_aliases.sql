create table public.aliases (
  alias_slug     text primary key,
  canonical_slug text not null,
  created_at     timestamptz not null default now()
);

comment on table public.aliases is
  'Slug redirects for merged duplicate works: /r/<alias_slug> 308s to /r/<canonical_slug>.';

-- No FK to works(slug): operator scripts delete/re-create works rows, and a
-- dangling alias just falls through to the normal 404 path.

alter table public.aliases enable row level security;

create policy "aliases_public_read"
  on public.aliases for select
  to anon, authenticated
  using (true);
