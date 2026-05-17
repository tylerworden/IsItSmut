create table public.works (
  slug         text primary key,
  medium       text not null check (medium in ('book', 'movie', 'tv')),
  title        text not null,
  creator      text not null,
  year         int,
  created_at   timestamptz not null default now()
);

create index works_title_lower_idx on public.works (lower(title));

alter table public.works enable row level security;

create policy "works_public_read"
  on public.works for select
  to anon, authenticated
  using (true);
