# Spelling Bee Features Design

**Date:** 2026-02-22
**Status:** Approved
**Features:** Daily challenges, archive, stats, hints, word history, high scores, cross-device sync

---

## Context

The current clone has a single hardcoded puzzle with no persistence. This design adds the full NYT Spelling Bee feature set: daily puzzles, an archive of past puzzles, cross-device progress sync via Supabase, personal stats, word history with timestamps, and a two-letter hint grid.

---

## Architecture

```
bee-clone/
├── scripts/
│   └── generate-puzzles.ts     ← run once (or yearly), writes puzzles.json
├── src/
│   ├── data/
│   │   ├── puzzles.json         ← 2+ years of date-keyed puzzles (generated)
│   │   ├── enable.txt           ← unchanged
│   │   └── words.ts             ← unchanged (auto-generated)
│   ├── lib/
│   │   ├── puzzleQuality.ts     ← quality scoring function used by generator
│   │   ├── validateWord.ts      ← unchanged
│   │   ├── scoring.ts           ← unchanged
│   │   └── homophones.ts        ← unchanged
│   ├── hooks/
│   │   ├── usePuzzle.ts         ← pick today's (or selected) puzzle from JSON
│   │   └── useGameSession.ts    ← replaces useGameState, syncs to Supabase
│   ├── components/
│   │   ├── [existing game UI]   ← unchanged
│   │   ├── StatsModal.tsx       ← personal stats overlay
│   │   ├── ArchivePanel.tsx     ← calendar/list of past puzzles
│   │   ├── HintsPanel.tsx       ← two-letter grid + answer count
│   │   └── WordHistory.tsx      ← found words with timestamps, pangrams flagged
│   └── supabase/
│       ├── client.ts            ← Supabase JS client init
│       └── migrations/          ← schema SQL managed by Supabase CLI
```

**Data flow:**
- Puzzle content (letters) lives entirely in `puzzles.json` — no network call needed
- `answers` is computed at runtime from `words.ts` (same as today)
- User progress (found words, timestamps, score) lives in Supabase `game_sessions`
- Auth is email magic-link — one-time per device, no passwords
- State syncs to Supabase on every word submission
- If auth is declined, falls back to localStorage-only (no cross-device sync)

---

## Puzzle Generation

### Quality Criteria

| Criterion | Value | Rationale |
|---|---|---|
| Valid answers | 15–100 | Too few = too hard, too many = trivial |
| Pangrams | ≥ 1 | Required by NYT rules |
| Long words (≥7 letters) | ≥ 1 | At least one satisfying find |
| Answers per non-center letter | ≥ 2 | No "dead" letters on the board |
| Letters | All 7 unique | No repeats |

### Algorithm (`scripts/generate-puzzles.ts`)

1. Build a frequency map of every 7-letter combination present in valid ENABLE words
2. For each candidate 7-letter set, try each letter as the center — run the answer filter against `words.ts`
3. Score the (center, letters) pair: penalize too few/too many answers, reward pangram count and word variety
4. Keep the highest-scoring pair per day
5. Use a seeded shuffle to assign puzzles to dates deterministically (same script run = same assignments)

**Usage:**
```bash
npx tsx scripts/generate-puzzles.ts --days 730
```
Idempotent: re-running only adds new dates beyond what already exists in `puzzles.json`.

### `puzzles.json` Structure

```json
{
  "2026-02-22": { "center": "T", "letters": ["R","A","I","N","E","D"] },
  "2026-02-23": { "center": "S", "letters": ["P","L","A","T","E","R"] }
}
```

Answers are not stored — computed at runtime, keeping the file small.

---

## Supabase Schema

```sql
create table game_sessions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references auth.users not null,
  puzzle_date     date not null,
  found_words     text[] default '{}',
  word_timestamps jsonb default '{}',  -- { "word": "2026-02-22T14:32:00Z" }
  score           integer default 0,
  rank            text default 'Beginner',
  started_at      timestamptz default now(),
  genius_at       timestamptz,         -- set when user first hits Genius rank
  queen_bee_at    timestamptz,         -- set when user finds all words
  unique(user_id, puzzle_date)
);

alter table game_sessions enable row level security;
create policy "own sessions" on game_sessions
  for all using (auth.uid() = user_id);
```

Stats are computed client-side from all `game_sessions` rows — no separate stats table needed.

---

## Features

### Daily Challenge + Archive

- On load: read today's date, look up puzzle in `puzzles.json`, load or create the `game_session` row
- Archive panel: calendar/list of all past dates showing your rank (or "not played")
- Clicking a past date loads that puzzle and its session
- Future dates are locked

### Stats Modal

Computed from all `game_sessions` rows for the authenticated user:
- Games played
- Genius rate (% of sessions with `genius_at` not null)
- Current streak + longest streak (consecutive days with any session started)
- Rank distribution histogram (how many times each rank was reached)
- Queen Bee count (sessions with `queen_bee_at` not null)

### Word History

The found words list:
- Default sort: time found (most recent first); toggle to alphabetical
- Pangrams rendered with gold highlight
- Timestamp shown on hover (desktop) / tap (mobile)

### Hints Panel

Behind a "Hints" button to avoid accidental reveals:
- Total words remaining
- Two-letter grid: every (first-letter, second-letter) pair starting ≥1 remaining answer, with count
  - Example: `TR 3 · TE 5 · AI 2 · ...`
- No words are spelled out

### Auth

- First load: "Enter your email to sync progress across devices" prompt
- Supabase sends a magic link — click it, authenticated forever on that device
- If declined: localStorage fallback (no sync, stats lost on clear)
- No passwords, no profile management

### Queen Bee

- Finding the last word triggers a full-screen celebration animation + "Queen Bee!" message
- `queen_bee_at` timestamp recorded in `game_sessions`

---

## What Does Not Change

- `validateWord.ts` — word validation rules
- `scoring.ts` — points calculation and rank thresholds
- `homophones.ts` — voice input homophone substitution
- `words.ts` — auto-generated word set
- `enable.txt` — source word list
- All existing game UI components (`HexBoard`, `HexTile`, `InputDisplay`, `GameControls`, `ScoreDisplay`, `Toast`)
- Voice input behavior
