create table public.game_sessions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references auth.users not null,
  puzzle_date     date not null,
  found_words     text[] default '{}',
  word_timestamps jsonb default '{}',
  score           integer default 0,
  rank            text default 'Beginner',
  started_at      timestamptz default now(),
  genius_at       timestamptz,
  queen_bee_at    timestamptz,
  unique(user_id, puzzle_date)
);

alter table public.game_sessions enable row level security;

create policy "Users can manage their own sessions"
  on public.game_sessions
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
