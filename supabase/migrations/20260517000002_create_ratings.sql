create table public.ratings (
  slug         text primary key references public.works(slug) on delete cascade,
  known        boolean not null,
  score        int check (score between 1 and 10),
  verdict      text,
  synopsis     text,
  details      text,
  tags         text[],
  model        text not null,
  rated_at     timestamptz not null default now(),
  view_count   int not null default 0
);

create index ratings_rated_at_idx on public.ratings (rated_at desc);
create index ratings_view_count_idx on public.ratings (view_count desc) where known = true;

alter table public.ratings enable row level security;

create policy "ratings_public_read"
  on public.ratings for select
  to anon, authenticated
  using (true);
