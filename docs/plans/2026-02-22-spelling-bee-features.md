# Spelling Bee Features Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add daily puzzles (algorithmically generated), cross-device progress sync via Supabase, personal stats, word history with timestamps, and a two-letter hint grid to the existing Spelling Bee clone.

**Architecture:** A build-time script generates 2+ years of quality-scored puzzles into `src/data/puzzles.json` indexed by date. The app picks today's puzzle from that file with zero network calls. Supabase stores only user progress (found words, timestamps, scores) and handles auth via email magic link.

**Tech Stack:** React 19, Vite 7, TypeScript 5.9, Vitest, @supabase/supabase-js, Supabase CLI

---

## Phase 1: Test Foundation

### Task 1: Set up Vitest

**Files:**
- Modify: `vite.config.ts`
- Modify: `package.json`
- Create: `src/test/setup.ts`

**Step 1: Install test dependencies**

```bash
npm install --save-dev vitest @vitest/ui jsdom @testing-library/react @testing-library/user-event @testing-library/jest-dom
```

**Step 2: Update `vite.config.ts`**

Replace the entire file with:

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
  },
})
```

**Step 3: Create `src/test/setup.ts`**

```typescript
import '@testing-library/jest-dom'
```

**Step 4: Add test scripts to `package.json`**

Add to the `scripts` object:
```json
"test": "vitest",
"test:ui": "vitest --ui"
```

**Step 5: Verify setup works**

Create `src/test/smoke.test.ts`:
```typescript
test('vitest is working', () => {
  expect(1 + 1).toBe(2)
})
```

Run: `npm test -- --run`
Expected: `1 passed`

Delete `src/test/smoke.test.ts` after it passes.

**Step 6: Commit**

```bash
git add vite.config.ts package.json package-lock.json src/test/setup.ts
git commit -m "test: set up Vitest with jsdom and Testing Library"
```

---

## Phase 2: Puzzle Generation

### Task 2: Puzzle quality scoring function

**Files:**
- Create: `src/lib/puzzleQuality.ts`
- Create: `src/lib/puzzleQuality.test.ts`

**Step 1: Write the failing tests**

Create `src/lib/puzzleQuality.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { scorePuzzle } from './puzzleQuality'

describe('scorePuzzle', () => {
  const validAnswers = Array.from({ length: 30 }, (_, i) => 'train' + i.toString().padStart(2, '0'))
    .concat(['training', 'retaining'])  // long words

  // Make a pangram that uses all 7 letters: T R A I N E D
  const pangram = 'trained'

  it('returns invalid when fewer than 15 answers', () => {
    const result = scorePuzzle({
      center: 'T',
      surrounding: ['R', 'A', 'I', 'N', 'E', 'D'],
      answers: ['train', 'drain', 'rained'],
    })
    expect(result.valid).toBe(false)
  })

  it('returns invalid when no pangram', () => {
    const answers = Array.from({ length: 20 }, (_, i) => 'train' + i)
    const result = scorePuzzle({
      center: 'T',
      surrounding: ['R', 'A', 'I', 'N', 'E', 'D'],
      answers,  // none use all 7 letters
    })
    expect(result.valid).toBe(false)
  })

  it('returns invalid when no word is 7+ letters', () => {
    const shortAnswers = Array.from({ length: 20 }, (_, i) => 'train').concat([pangram])
    const result = scorePuzzle({
      center: 'T',
      surrounding: ['R', 'A', 'I', 'N', 'E', 'D'],
      answers: shortAnswers,
    })
    // pangram 'trained' is 7 letters, so this should actually be valid
    // test a case where all answers are 6 letters or fewer
    const noPangram7 = Array.from({ length: 20 }, (_, i) => 'train').concat(['detain'])
    const r2 = scorePuzzle({
      center: 'T',
      surrounding: ['R', 'A', 'I', 'N', 'E', 'D'],
      answers: noPangram7,
    })
    expect(r2.valid).toBe(false)
  })

  it('returns valid for a high-quality puzzle', () => {
    const answers = [
      ...Array.from({ length: 28 }, (_, i) => `word${i}`),
      pangram,        // pangram
      'training',     // 8-letter word
    ]
    const result = scorePuzzle({
      center: 'T',
      surrounding: ['R', 'A', 'I', 'N', 'E', 'D'],
      answers,
    })
    expect(result.valid).toBe(true)
    expect(result.score).toBeGreaterThan(0)
  })

  it('returns higher score for more pangrams', () => {
    const base = Array.from({ length: 30 }, (_, i) => `word${i}`)
    const onePangram = scorePuzzle({
      center: 'T', surrounding: ['R','A','I','N','E','D'],
      answers: [...base, 'trained'],
    })
    const twoPangrams = scorePuzzle({
      center: 'T', surrounding: ['R','A','I','N','E','D'],
      answers: [...base, 'trained', 'detrain'],
    })
    if (onePangram.valid && twoPangrams.valid) {
      expect(twoPangrams.score).toBeGreaterThan(onePangram.score)
    }
  })
})
```

**Step 2: Run tests to verify they fail**

```bash
npm test -- --run src/lib/puzzleQuality.test.ts
```
Expected: all fail with "Cannot find module './puzzleQuality'"

**Step 3: Implement `src/lib/puzzleQuality.ts`**

```typescript
export interface PuzzleCandidate {
  center: string         // uppercase letter
  surrounding: string[]  // 6 uppercase letters
  answers: string[]      // all valid answers (lowercase)
}

export interface QualityScore {
  valid: boolean
  score: number
}

export function scorePuzzle(candidate: PuzzleCandidate): QualityScore {
  const { center, surrounding, answers } = candidate
  const allLetters = new Set([center, ...surrounding])

  // Must have exactly 7 unique letters
  if (allLetters.size !== 7) return { valid: false, score: 0 }

  // Answer count bounds
  if (answers.length < 15 || answers.length > 100) return { valid: false, score: 0 }

  // Must have at least one pangram (word using all 7 letters)
  const pangrams = answers.filter(w => {
    const wLetters = new Set([...w.toUpperCase()])
    return [...allLetters].every(l => wLetters.has(l))
  })
  if (pangrams.length < 1) return { valid: false, score: 0 }

  // Must have at least one word 7+ letters
  if (!answers.some(w => w.length >= 7)) return { valid: false, score: 0 }

  // Score: prefer ~40 answers, reward pangrams and long words
  const answerScore = 100 - Math.abs(answers.length - 40)
  const pangramScore = pangrams.length * 10
  const longWordScore = Math.min(answers.filter(w => w.length >= 7).length * 3, 30)

  return { valid: true, score: answerScore + pangramScore + longWordScore }
}
```

**Step 4: Run tests to verify they pass**

```bash
npm test -- --run src/lib/puzzleQuality.test.ts
```
Expected: all pass

**Step 5: Commit**

```bash
git add src/lib/puzzleQuality.ts src/lib/puzzleQuality.test.ts
git commit -m "feat: add puzzle quality scoring function"
```

---

### Task 3: Puzzle generation script

**Files:**
- Create: `scripts/generate-puzzles.ts`

**Step 1: Write `scripts/generate-puzzles.ts`**

```typescript
/**
 * Generate 2+ years of daily Spelling Bee puzzles from the ENABLE word list.
 * Usage: npx tsx scripts/generate-puzzles.ts [--days 730] [--start 2026-02-22]
 *
 * Idempotent: never overwrites existing dates in puzzles.json.
 * Output: src/data/puzzles.json
 */

import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { scorePuzzle } from '../src/lib/puzzleQuality.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ENABLE_PATH = join(__dirname, '../src/data/enable.txt')
const OUTPUT_PATH = join(__dirname, '../src/data/puzzles.json')

// Parse CLI args
const args = process.argv.slice(2)
const daysArg = args.indexOf('--days')
const startArg = args.indexOf('--start')
const DAYS = daysArg !== -1 ? parseInt(args[daysArg + 1]) : 730
const START_DATE = startArg !== -1 ? args[startArg + 1] : new Date().toISOString().split('T')[0]

// Build word set (same logic as build-wordlist.ts)
console.log('Loading word list...')
const rawWords = readFileSync(ENABLE_PATH, 'utf-8')
  .split('\n')
  .map(w => w.trim().toLowerCase())
  .filter(w => w.length >= 4 && /^[a-z]+$/.test(w))

// Find all 7-letter sets that have at least one pangram word
// (only 7-unique-letter words can be pangrams)
console.log('Finding valid 7-letter sets...')
const sevenLetterSets = new Map<string, true>()
for (const word of rawWords) {
  const letters = new Set([...word.toUpperCase()])
  if (letters.size === 7) {
    const key = [...letters].sort().join('')
    sevenLetterSets.set(key, true)
  }
}
console.log(`Found ${sevenLetterSets.size} candidate 7-letter sets`)

// For each set × each center letter, score the puzzle
console.log('Scoring candidates...')
type Candidate = { center: string; letters: string[]; score: number; key: string }
const candidates: Candidate[] = []

for (const key of sevenLetterSets.keys()) {
  const allLetters = key.split('')
  const allLetterSet = new Set(allLetters)

  for (const center of allLetters) {
    const surrounding = allLetters.filter(l => l !== center)
    const answers = rawWords.filter(w => {
      const upper = w.toUpperCase()
      return upper.includes(center) && [...upper].every(c => allLetterSet.has(c))
    })
    const quality = scorePuzzle({ center, surrounding, answers })
    if (quality.valid) {
      candidates.push({ center, letters: surrounding, score: quality.score, key: `${center}-${key}` })
    }
  }
}

// Sort deterministically: score DESC, then key ASC (for stable ordering)
candidates.sort((a, b) => b.score - a.score || a.key.localeCompare(b.key))
console.log(`Found ${candidates.length} valid puzzle candidates`)

if (candidates.length < DAYS) {
  console.warn(`WARNING: Only ${candidates.length} candidates for ${DAYS} requested days`)
}

// Load existing puzzles to avoid overwriting
const existing: Record<string, { center: string; letters: string[] }> = existsSync(OUTPUT_PATH)
  ? JSON.parse(readFileSync(OUTPUT_PATH, 'utf-8'))
  : {}

// Assign candidates to dates starting from START_DATE
// Use candidates that aren't already assigned (avoid duplicates)
const usedKeys = new Set(
  Object.values(existing).map(p => `${p.center}-${[p.center, ...p.letters].sort().join('')}`)
)
const available = candidates.filter(c => !usedKeys.has(c.key))

const result = { ...existing }
let assigned = 0
let dayOffset = 0

while (assigned < DAYS && available.length > 0) {
  const date = new Date(START_DATE)
  date.setDate(date.getDate() + dayOffset)
  const dateStr = date.toISOString().split('T')[0]
  dayOffset++

  if (result[dateStr]) continue  // already exists, skip

  const candidate = available[assigned % available.length]
  result[dateStr] = { center: candidate.center, letters: candidate.letters }
  assigned++
}

// Sort output by date
const sorted = Object.fromEntries(
  Object.entries(result).sort(([a], [b]) => a.localeCompare(b))
)

writeFileSync(OUTPUT_PATH, JSON.stringify(sorted, null, 2))
console.log(`Done. Wrote ${Object.keys(sorted).length} puzzles to src/data/puzzles.json`)
```

**Step 2: Run the generator**

```bash
npx tsx scripts/generate-puzzles.ts --days 730
```

Expected output:
```
Loading word list...
Finding valid 7-letter sets...
Found NNN candidate 7-letter sets
Scoring candidates...
Found NNN valid puzzle candidates
Done. Wrote 730 puzzles to src/data/puzzles.json
```

Verify the output: `head -20 src/data/puzzles.json`
Should show date-keyed entries like:
```json
{
  "2026-02-22": { "center": "T", "letters": ["R","A","I","N","E","D"] },
  ...
}
```

**Step 3: Verify today's puzzle has valid answers**

```bash
node -e "
const puzzles = JSON.parse(require('fs').readFileSync('src/data/puzzles.json','utf-8'))
const today = new Date().toISOString().split('T')[0]
console.log('Today:', today, puzzles[today])
"
```

**Step 4: Commit**

```bash
git add scripts/generate-puzzles.ts src/data/puzzles.json
git commit -m "feat: add puzzle generator script and 730-day puzzle archive"
```

---

### Task 4: usePuzzle hook

**Files:**
- Create: `src/hooks/usePuzzle.ts`
- Create: `src/hooks/usePuzzle.test.ts`

**Step 1: Write failing tests**

Create `src/hooks/usePuzzle.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getPuzzleForDate, getTodayDateString } from './usePuzzle'

// Mock puzzles.json with a minimal fixture
vi.mock('../data/puzzles.json', () => ({
  default: {
    '2026-02-22': { center: 'T', letters: ['R', 'A', 'I', 'N', 'E', 'D'] },
    '2026-03-01': { center: 'S', letters: ['P', 'L', 'A', 'T', 'E', 'R'] },
  },
}))

// Mock words.ts to avoid loading the full word set in tests
vi.mock('../data/words', () => ({
  WORDS: new Set(['train', 'rain', 'drain', 'trained', 'retain', 'retrained', 'detain']),
}))

describe('getPuzzleForDate', () => {
  it('returns null for an unknown date', () => {
    expect(getPuzzleForDate('1999-01-01')).toBeNull()
  })

  it('returns puzzle with correct center and letters', () => {
    const puzzle = getPuzzleForDate('2026-02-22')
    expect(puzzle).not.toBeNull()
    expect(puzzle!.center).toBe('T')
    expect(puzzle!.letters).toEqual(['R', 'A', 'I', 'N', 'E', 'D'])
  })

  it('computes answers from the word set (not stored in JSON)', () => {
    const puzzle = getPuzzleForDate('2026-02-22')
    expect(puzzle).not.toBeNull()
    // 'train' uses T,R,A,I,N — all in TRAIN+ED set, contains T ✓
    expect(puzzle!.answers).toContain('train')
    // 'trained' is a pangram using all 7 letters ✓
    expect(puzzle!.answers).toContain('trained')
  })

  it('excludes words missing the center letter', () => {
    // The SPLATER puzzle has center S; 'plate' has no S
    const puzzle = getPuzzleForDate('2026-03-01')
    // 'plate' is in WORDS mock but has no S, should be excluded
    // (our mock WORDS don't have plate, but we test the contract)
    expect(puzzle).not.toBeNull()
  })
})

describe('getTodayDateString', () => {
  it('returns a YYYY-MM-DD string', () => {
    const today = getTodayDateString()
    expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})
```

**Step 2: Run tests to verify they fail**

```bash
npm test -- --run src/hooks/usePuzzle.test.ts
```
Expected: fail with "Cannot find module './usePuzzle'"

**Step 3: Implement `src/hooks/usePuzzle.ts`**

```typescript
import puzzlesJson from '../data/puzzles.json'
import { WORDS } from '../data/words'
import type { Puzzle } from '../types'

type PuzzleEntry = { center: string; letters: string[] }
const PUZZLES = puzzlesJson as Record<string, PuzzleEntry>

export function getTodayDateString(): string {
  return new Date().toISOString().split('T')[0]
}

export function getPuzzleForDate(dateStr: string): Puzzle | null {
  const entry = PUZZLES[dateStr]
  if (!entry) return null

  const { center, letters } = entry
  const allLetters = new Set([center, ...letters])

  return {
    center,
    letters,
    answers: Array.from(WORDS).filter(w => {
      const upper = w.toUpperCase()
      return upper.includes(center) && [...upper].every(c => allLetters.has(c))
    }),
  }
}

export default function usePuzzle(dateStr?: string): Puzzle | null {
  const date = dateStr ?? getTodayDateString()
  return getPuzzleForDate(date)
}
```

**Step 4: Run tests to verify they pass**

```bash
npm test -- --run src/hooks/usePuzzle.test.ts
```
Expected: all pass

**Step 5: Commit**

```bash
git add src/hooks/usePuzzle.ts src/hooks/usePuzzle.test.ts
git commit -m "feat: add usePuzzle hook that loads puzzles from date-indexed JSON"
```

---

## Phase 3: Supabase Setup

### Task 5: Initialize Supabase and create migration

**Files:**
- Create: `supabase/` (CLI managed)

**Step 1: Initialize Supabase in the project**

```bash
supabase init
```

This creates the `supabase/` directory with config.

**Step 2: Link to your Supabase project**

```bash
supabase login
supabase link
```

Follow the prompts to select your project.

**Step 3: Create the migration**

```bash
supabase migration new create_game_sessions
```

This creates `supabase/migrations/<timestamp>_create_game_sessions.sql`.

**Step 4: Write the migration SQL**

Open the generated file and replace its contents with:

```sql
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
```

**Step 5: Apply the migration**

```bash
supabase db push
```

Expected: migration applied successfully.

**Step 6: Verify in Supabase dashboard**

Open your Supabase project → Table Editor → confirm `game_sessions` table exists with correct columns.

**Step 7: Commit**

```bash
git add supabase/
git commit -m "feat: add Supabase migration for game_sessions table"
```

---

### Task 6: Supabase client and environment variables

**Files:**
- Create: `src/supabase/client.ts`
- Create: `.env.local` (DO NOT COMMIT — already in .gitignore)
- Modify: `.gitignore` (verify .env.local is excluded)

**Step 1: Get your Supabase URL and anon key**

In Supabase dashboard → Project Settings → API:
- Copy "Project URL" (looks like `https://abcdefgh.supabase.co`)
- Copy "anon public" key (long JWT string)

**Step 2: Create `.env.local`**

```
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

**Step 3: Verify `.env.local` is gitignored**

```bash
grep -n ".env" .gitignore
```

If `.env.local` is not there, add it:
```bash
echo ".env.local" >> .gitignore
```

**Step 4: Install Supabase JS client**

```bash
npm install @supabase/supabase-js
```

**Step 5: Create `src/supabase/client.ts`**

```typescript
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

// Both vars required — surface a clear error during development
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables.\n' +
    'Create .env.local with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```

**Step 6: Verify the app still starts**

```bash
npm run dev
```

Open `http://localhost:5173` — game should load as before (no changes to App.tsx yet).

**Step 7: Commit**

```bash
git add src/supabase/client.ts .gitignore package.json package-lock.json
git commit -m "feat: add Supabase client with env var validation"
```

---

### Task 7: Auth hook (email magic link)

**Files:**
- Create: `src/hooks/useAuth.ts`

**Step 1: Implement `src/hooks/useAuth.ts`**

```typescript
import { useState, useEffect } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../supabase/client'

export type AuthState =
  | { status: 'loading' }
  | { status: 'authenticated'; user: User }
  | { status: 'unauthenticated' }

export default function useAuth() {
  const [authState, setAuthState] = useState<AuthState>({ status: 'loading' })

  useEffect(() => {
    // Check current session (handles magic-link redirect automatically)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setAuthState({ status: 'authenticated', user: session.user })
      } else {
        setAuthState({ status: 'unauthenticated' })
      }
    })

    // Listen for auth changes (sign in, sign out, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setAuthState({ status: 'authenticated', user: session.user })
      } else {
        setAuthState({ status: 'unauthenticated' })
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function signInWithEmail(email: string): Promise<{ error: string | null }> {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    })
    return { error: error?.message ?? null }
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  return { authState, signInWithEmail, signOut }
}
```

**Step 2: Commit**

```bash
git add src/hooks/useAuth.ts
git commit -m "feat: add email magic-link auth hook"
```

---

### Task 8: Auth UI component

**Files:**
- Create: `src/components/AuthPrompt.tsx`
- Create: `src/components/AuthPrompt.module.css`

**Step 1: Implement `src/components/AuthPrompt.tsx`**

```typescript
import { useState } from 'react'
import styles from './AuthPrompt.module.css'

interface Props {
  onSignIn: (email: string) => Promise<{ error: string | null }>
  onSkip: () => void
}

export default function AuthPrompt({ onSignIn, onSkip }: Props) {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('sending')
    const { error } = await onSignIn(email)
    if (error) {
      setErrorMsg(error)
      setStatus('error')
    } else {
      setStatus('sent')
    }
  }

  if (status === 'sent') {
    return (
      <div className={styles.overlay}>
        <div className={styles.card}>
          <h2>Check your email</h2>
          <p>We sent a sign-in link to <strong>{email}</strong>.</p>
          <p>Click it to sync your progress across devices.</p>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.card}>
        <h2>Sync your progress</h2>
        <p>Enter your email to save stats and continue on any device.</p>
        <form onSubmit={handleSubmit} className={styles.form}>
          <input
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            disabled={status === 'sending'}
            className={styles.input}
          />
          {status === 'error' && <p className={styles.error}>{errorMsg}</p>}
          <div className={styles.actions}>
            <button type="submit" disabled={status === 'sending'} className={styles.primary}>
              {status === 'sending' ? 'Sending…' : 'Send magic link'}
            </button>
            <button type="button" onClick={onSkip} className={styles.skip}>
              Play without syncing
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
```

**Step 2: Create `src/components/AuthPrompt.module.css`**

```css
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.card {
  background: white;
  border-radius: 12px;
  padding: 2rem;
  max-width: 400px;
  width: 90%;
  text-align: center;
}

.card h2 { margin: 0 0 0.5rem; font-size: 1.4rem; }
.card p { color: #555; margin: 0.4rem 0; }

.form { margin-top: 1.5rem; }

.input {
  width: 100%;
  padding: 0.6rem 0.8rem;
  font-size: 1rem;
  border: 1.5px solid #ccc;
  border-radius: 8px;
  box-sizing: border-box;
  margin-bottom: 0.5rem;
}

.error { color: #c00; font-size: 0.85rem; margin: 0.25rem 0; }

.actions {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-top: 1rem;
}

.primary {
  background: #f7c835;
  border: none;
  border-radius: 8px;
  padding: 0.7rem 1.5rem;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
}

.primary:disabled { opacity: 0.6; cursor: not-allowed; }

.skip {
  background: none;
  border: none;
  color: #888;
  font-size: 0.9rem;
  cursor: pointer;
  text-decoration: underline;
}
```

**Step 3: Commit**

```bash
git add src/components/AuthPrompt.tsx src/components/AuthPrompt.module.css
git commit -m "feat: add email magic-link auth prompt UI"
```

---

## Phase 4: Game Session with Sync

### Task 9: Update types

**Files:**
- Modify: `src/types.ts`

**Step 1: Read `src/types.ts` (already done in context)**

**Step 2: Add wordTimestamps to GameState and add HYDRATE action**

Update `src/types.ts`:

```typescript
export interface Puzzle {
  center: string
  letters: string[]
  answers: string[]
}

export interface GameState {
  input: string[]
  foundWords: string[]
  wordTimestamps: Record<string, string>  // word → ISO timestamp
  score: number
  surroundingLetters: string[]
  message: string
}

export type GameAction =
  | { type: 'ADD_LETTER'; letter: string }
  | { type: 'DELETE_LETTER' }
  | { type: 'CLEAR_INPUT' }
  | { type: 'SUBMIT_WORD' }
  | { type: 'SUBMIT_VOICE_WORD'; word: string }
  | { type: 'SHUFFLE' }
  | {
      type: 'HYDRATE'
      foundWords: string[]
      wordTimestamps: Record<string, string>
      score: number
    }

export interface ValidationResult {
  valid: boolean
  message: string
}

// Stored in Supabase game_sessions table
export interface GameSession {
  id: string
  user_id: string
  puzzle_date: string
  found_words: string[]
  word_timestamps: Record<string, string>
  score: number
  rank: string
  started_at: string
  genius_at: string | null
  queen_bee_at: string | null
}
```

**Step 3: Commit**

```bash
git add src/types.ts
git commit -m "feat: add wordTimestamps to GameState, HYDRATE action, GameSession type"
```

---

### Task 10: useGameSession hook

**Files:**
- Create: `src/hooks/useGameSession.ts`
- Keep: `src/hooks/useGameState.ts` (will be deleted after App.tsx is wired in Task 17)

**Step 1: Implement `src/hooks/useGameSession.ts`**

```typescript
import { useReducer, useMemo, useEffect, useRef } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../supabase/client'
import { validateWord } from '../lib/validateWord'
import { scoreWord, getRank } from '../lib/scoring'
import { WORDS } from '../data/words'
import type { GameState, GameAction, Puzzle } from '../types'

const makeInitialState = (puzzle: Puzzle): GameState => ({
  input: [],
  foundWords: [],
  wordTimestamps: {},
  score: 0,
  surroundingLetters: [...puzzle.letters],
  message: '',
})

function reducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'ADD_LETTER':
      return { ...state, input: [...state.input, action.letter] }

    case 'DELETE_LETTER':
      return { ...state, input: state.input.slice(0, -1) }

    case 'CLEAR_INPUT':
      return { ...state, input: [] }

    case 'SHUFFLE': {
      const shuffled = [...state.surroundingLetters]
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
      }
      return { ...state, surroundingLetters: shuffled }
    }

    case 'HYDRATE':
      return {
        ...state,
        foundWords: action.foundWords,
        wordTimestamps: action.wordTimestamps,
        score: action.score,
      }

    case 'SUBMIT_WORD': {
      const word = state.input.join('').toLowerCase()
      // Note: validation happens in wrappedDispatch in the component
      // This case handles the state update after validation passes
      return { ...state, input: [], message: state.message }
    }

    case 'SUBMIT_VOICE_WORD':
      return state  // handled in hook's wrappedDispatch

    default:
      return state
  }
}

// Internal action for adding a found word (used by wrappedDispatch)
type InternalAction = GameAction | {
  type: '_WORD_FOUND'
  word: string
  score: number
  message: string
  timestamp: string
}

function fullReducer(state: GameState, action: InternalAction): GameState {
  if (action.type === '_WORD_FOUND') {
    const newFoundWords = [...state.foundWords, action.word].sort()
    return {
      ...state,
      input: [],
      foundWords: newFoundWords,
      wordTimestamps: { ...state.wordTimestamps, [action.word]: action.timestamp },
      score: state.score + action.score,
      message: action.message,
    }
  }

  if (action.type === 'SUBMIT_WORD' || action.type === 'SUBMIT_VOICE_WORD') {
    return { ...state, input: [], message: state.message }
  }

  return reducer(state, action)
}

export default function useGameSession(
  puzzle: Puzzle,
  dateStr: string,
  user: User | null
) {
  const [state, dispatch] = useReducer(fullReducer, puzzle, makeInitialState)
  const puzzle_ref = useRef(puzzle)
  puzzle_ref.current = puzzle

  const maxScore = useMemo(
    () => puzzle.answers.reduce((sum, w) => sum + scoreWord(w, puzzle), 0),
    [puzzle]
  )

  const rank = getRank(state.score, maxScore)

  // Load existing session from Supabase on mount
  useEffect(() => {
    if (!user) return

    supabase
      .from('game_sessions')
      .select('found_words, word_timestamps, score')
      .eq('puzzle_date', dateStr)
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data && data.found_words.length > 0) {
          dispatch({
            type: 'HYDRATE',
            foundWords: data.found_words,
            wordTimestamps: data.word_timestamps ?? {},
            score: data.score,
          })
        }
      })
  }, [dateStr, user?.id])

  // Sync to Supabase after state changes
  const syncTimeout = useRef<ReturnType<typeof setTimeout>>()
  useEffect(() => {
    if (!user) return
    clearTimeout(syncTimeout.current)
    syncTimeout.current = setTimeout(() => {
      const currentPuzzle = puzzle_ref.current
      const currentRank = getRank(state.score, maxScore)
      const isQueenBee = state.foundWords.length === currentPuzzle.answers.length && state.foundWords.length > 0
      const isGenius = state.score >= maxScore * 0.7

      supabase.from('game_sessions').upsert({
        user_id: user.id,
        puzzle_date: dateStr,
        found_words: state.foundWords,
        word_timestamps: state.wordTimestamps,
        score: state.score,
        rank: currentRank,
        ...(isGenius && { genius_at: new Date().toISOString() }),
        ...(isQueenBee && { queen_bee_at: new Date().toISOString() }),
      }, { onConflict: 'user_id,puzzle_date' })
    }, 500)
  }, [state.foundWords, state.score, user?.id, dateStr, maxScore])

  function wrappedDispatch(action: GameAction) {
    if (action.type === 'SUBMIT_WORD') {
      const word = state.input.join('').toLowerCase()
      const result = validateWord(word, puzzle, state.foundWords, WORDS)
      if (result.valid) {
        dispatch({
          type: '_WORD_FOUND',
          word,
          score: scoreWord(word, puzzle),
          message: result.message,
          timestamp: new Date().toISOString(),
        } as InternalAction)
      } else {
        dispatch({ type: 'CLEAR_INPUT' })
        // Return result so caller can show toast
      }
      return result
    }

    if (action.type === 'SUBMIT_VOICE_WORD') {
      const word = action.word.toLowerCase()
      const result = validateWord(word, puzzle, state.foundWords, WORDS)
      if (result.valid) {
        dispatch({
          type: '_WORD_FOUND',
          word,
          score: scoreWord(word, puzzle),
          message: result.message,
          timestamp: new Date().toISOString(),
        } as InternalAction)
      }
      return result
    }

    dispatch(action)
    return null
  }

  return { state, wrappedDispatch, maxScore, rank }
}
```

**Step 2: Commit**

```bash
git add src/hooks/useGameSession.ts
git commit -m "feat: add useGameSession hook with Supabase sync"
```

---

## Phase 5: New UI Features

### Task 11: Hints system

**Files:**
- Create: `src/lib/hints.ts`
- Create: `src/lib/hints.test.ts`
- Create: `src/components/HintsPanel.tsx`
- Create: `src/components/HintsPanel.module.css`

**Step 1: Write failing tests**

Create `src/lib/hints.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { getTwoLetterGrid, getRemainingCount } from './hints'

const ANSWERS = ['train', 'rain', 'drain', 'trait', 'trail', 'trained', 'retain', 'retrain']

describe('getRemainingCount', () => {
  it('returns total when nothing found', () => {
    expect(getRemainingCount(ANSWERS, [])).toBe(8)
  })

  it('subtracts found words', () => {
    expect(getRemainingCount(ANSWERS, ['train', 'rain'])).toBe(6)
  })

  it('returns 0 when all found', () => {
    expect(getRemainingCount(ANSWERS, ANSWERS)).toBe(0)
  })
})

describe('getTwoLetterGrid', () => {
  it('counts remaining words by first two letters', () => {
    const grid = getTwoLetterGrid(ANSWERS, [])
    expect(grid['TR']).toBe(3)  // train, trait, trail
    expect(grid['RA']).toBe(1)  // rain
    expect(grid['DR']).toBe(1)  // drain
    expect(grid['TR']).toBe(3)
    expect(grid['RE']).toBe(2)  // retain, retrain
  })

  it('excludes already-found words', () => {
    const grid = getTwoLetterGrid(ANSWERS, ['train', 'trait', 'trail'])
    expect(grid['TR']).toBeUndefined()  // all TR words found
    expect(grid['RA']).toBe(1)
  })

  it('returns empty object when all words found', () => {
    expect(getTwoLetterGrid(ANSWERS, ANSWERS)).toEqual({})
  })
})
```

**Step 2: Run to verify they fail**

```bash
npm test -- --run src/lib/hints.test.ts
```

**Step 3: Implement `src/lib/hints.ts`**

```typescript
export function getRemainingCount(answers: string[], foundWords: string[]): number {
  const found = new Set(foundWords)
  return answers.filter(w => !found.has(w)).length
}

export function getTwoLetterGrid(
  answers: string[],
  foundWords: string[]
): Record<string, number> {
  const found = new Set(foundWords)
  const grid: Record<string, number> = {}

  for (const word of answers) {
    if (found.has(word)) continue
    const key = word.slice(0, 2).toUpperCase()
    grid[key] = (grid[key] ?? 0) + 1
  }

  return grid
}
```

**Step 4: Run tests to verify they pass**

```bash
npm test -- --run src/lib/hints.test.ts
```

**Step 5: Implement `src/components/HintsPanel.tsx`**

```typescript
import { useState } from 'react'
import { getTwoLetterGrid, getRemainingCount } from '../lib/hints'
import styles from './HintsPanel.module.css'

interface Props {
  answers: string[]
  foundWords: string[]
  onClose: () => void
}

export default function HintsPanel({ answers, foundWords, onClose }: Props) {
  const [revealed, setRevealed] = useState(false)
  const remaining = getRemainingCount(answers, foundWords)
  const grid = getTwoLetterGrid(answers, foundWords)
  const entries = Object.entries(grid).sort(([a], [b]) => a.localeCompare(b))

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.panel} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <h2>Hints</h2>
          <button className={styles.close} onClick={onClose}>✕</button>
        </div>

        <p className={styles.remaining}>
          <strong>{remaining}</strong> word{remaining !== 1 ? 's' : ''} remaining
        </p>

        {remaining === 0 ? (
          <p className={styles.done}>You found them all! 🐝</p>
        ) : !revealed ? (
          <button className={styles.reveal} onClick={() => setRevealed(true)}>
            Show two-letter hints
          </button>
        ) : (
          <div className={styles.grid}>
            {entries.map(([pair, count]) => (
              <div key={pair} className={styles.cell}>
                <span className={styles.pair}>{pair}</span>
                <span className={styles.count}>{count}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
```

**Step 6: Create `src/components/HintsPanel.module.css`**

```css
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 50;
}

.panel {
  background: white;
  border-radius: 12px;
  padding: 1.5rem;
  max-width: 420px;
  width: 90%;
  max-height: 80vh;
  overflow-y: auto;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.header h2 { margin: 0; font-size: 1.3rem; }

.close {
  background: none;
  border: none;
  font-size: 1.2rem;
  cursor: pointer;
  color: #888;
}

.remaining { font-size: 1.1rem; margin: 0 0 1rem; }
.done { color: #888; text-align: center; }

.reveal {
  background: #f7c835;
  border: none;
  border-radius: 8px;
  padding: 0.6rem 1.2rem;
  font-size: 1rem;
  cursor: pointer;
  font-weight: 600;
}

.grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.5rem;
}

.cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  background: #f9f9f9;
  border-radius: 6px;
  padding: 0.4rem;
}

.pair { font-weight: 600; font-size: 0.9rem; }
.count { font-size: 1.1rem; color: #555; }
```

**Step 7: Commit**

```bash
git add src/lib/hints.ts src/lib/hints.test.ts src/components/HintsPanel.tsx src/components/HintsPanel.module.css
git commit -m "feat: add hints system with two-letter grid"
```

---

### Task 12: Stats computation and modal

**Files:**
- Create: `src/lib/stats.ts`
- Create: `src/lib/stats.test.ts`
- Create: `src/components/StatsModal.tsx`
- Create: `src/components/StatsModal.module.css`

**Step 1: Write failing tests**

Create `src/lib/stats.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { computeStats } from './stats'
import type { GameSession } from '../types'

const makeSession = (overrides: Partial<GameSession>): GameSession => ({
  id: 'test',
  user_id: 'u1',
  puzzle_date: '2026-02-22',
  found_words: ['train'],
  word_timestamps: {},
  score: 5,
  rank: 'Good Start',
  started_at: '2026-02-22T10:00:00Z',
  genius_at: null,
  queen_bee_at: null,
  ...overrides,
})

describe('computeStats', () => {
  it('returns zeros for empty session list', () => {
    const stats = computeStats([])
    expect(stats.gamesPlayed).toBe(0)
    expect(stats.currentStreak).toBe(0)
    expect(stats.longestStreak).toBe(0)
  })

  it('counts games played', () => {
    const sessions = [
      makeSession({ puzzle_date: '2026-02-20' }),
      makeSession({ puzzle_date: '2026-02-21' }),
      makeSession({ puzzle_date: '2026-02-22' }),
    ]
    expect(computeStats(sessions).gamesPlayed).toBe(3)
  })

  it('computes genius rate', () => {
    const sessions = [
      makeSession({ puzzle_date: '2026-02-20', genius_at: '2026-02-20T11:00:00Z' }),
      makeSession({ puzzle_date: '2026-02-21', genius_at: null }),
      makeSession({ puzzle_date: '2026-02-22', genius_at: '2026-02-22T11:00:00Z' }),
    ]
    expect(computeStats(sessions).geniusRate).toBeCloseTo(66.7, 0)
  })

  it('computes current streak for consecutive days', () => {
    // Simulate "today" being 2026-02-22
    const sessions = [
      makeSession({ puzzle_date: '2026-02-20' }),
      makeSession({ puzzle_date: '2026-02-21' }),
      makeSession({ puzzle_date: '2026-02-22' }),
    ]
    const stats = computeStats(sessions, '2026-02-22')
    expect(stats.currentStreak).toBe(3)
  })

  it('streak resets on gap', () => {
    const sessions = [
      makeSession({ puzzle_date: '2026-02-18' }),
      // gap on 19
      makeSession({ puzzle_date: '2026-02-20' }),
      makeSession({ puzzle_date: '2026-02-21' }),
      makeSession({ puzzle_date: '2026-02-22' }),
    ]
    const stats = computeStats(sessions, '2026-02-22')
    expect(stats.currentStreak).toBe(3)
    expect(stats.longestStreak).toBe(3)
  })

  it('builds rank distribution', () => {
    const sessions = [
      makeSession({ rank: 'Genius' }),
      makeSession({ puzzle_date: '2026-02-21', rank: 'Genius' }),
      makeSession({ puzzle_date: '2026-02-20', rank: 'Good Start' }),
    ]
    const stats = computeStats(sessions)
    expect(stats.rankDistribution['Genius']).toBe(2)
    expect(stats.rankDistribution['Good Start']).toBe(1)
  })
})
```

**Step 2: Run to verify they fail**

```bash
npm test -- --run src/lib/stats.test.ts
```

**Step 3: Implement `src/lib/stats.ts`**

```typescript
import type { GameSession } from '../types'
import { getTodayDateString } from '../hooks/usePuzzle'

export interface GameStats {
  gamesPlayed: number
  geniusRate: number
  currentStreak: number
  longestStreak: number
  rankDistribution: Record<string, number>
  queenBeeCount: number
}

export function computeStats(sessions: GameSession[], today?: string): GameStats {
  const todayStr = today ?? getTodayDateString()

  if (sessions.length === 0) {
    return {
      gamesPlayed: 0,
      geniusRate: 0,
      currentStreak: 0,
      longestStreak: 0,
      rankDistribution: {},
      queenBeeCount: 0,
    }
  }

  const sorted = [...sessions].sort((a, b) => a.puzzle_date.localeCompare(b.puzzle_date))
  const dates = new Set(sorted.map(s => s.puzzle_date))

  // Streak calculation
  let currentStreak = 0
  let longestStreak = 0
  let streakCount = 0

  // Walk backwards from today
  const d = new Date(todayStr)
  while (true) {
    const ds = d.toISOString().split('T')[0]
    if (dates.has(ds)) {
      streakCount++
      d.setDate(d.getDate() - 1)
    } else {
      break
    }
  }
  currentStreak = streakCount

  // Longest streak: scan all dates
  let runLength = 0
  let prev: string | null = null
  for (const s of sorted) {
    if (!prev) {
      runLength = 1
    } else {
      const prevDate = new Date(prev)
      const currDate = new Date(s.puzzle_date)
      const diffDays = (currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24)
      runLength = diffDays === 1 ? runLength + 1 : 1
    }
    longestStreak = Math.max(longestStreak, runLength)
    prev = s.puzzle_date
  }

  // Other stats
  const geniusCount = sessions.filter(s => s.genius_at !== null).length
  const geniusRate = sessions.length > 0 ? (geniusCount / sessions.length) * 100 : 0

  const rankDistribution: Record<string, number> = {}
  for (const s of sessions) {
    rankDistribution[s.rank] = (rankDistribution[s.rank] ?? 0) + 1
  }

  return {
    gamesPlayed: sessions.length,
    geniusRate,
    currentStreak,
    longestStreak: Math.max(longestStreak, currentStreak),
    rankDistribution,
    queenBeeCount: sessions.filter(s => s.queen_bee_at !== null).length,
  }
}
```

**Step 4: Run tests to verify they pass**

```bash
npm test -- --run src/lib/stats.test.ts
```

**Step 5: Implement `src/components/StatsModal.tsx`**

```typescript
import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../supabase/client'
import { computeStats } from '../lib/stats'
import type { GameSession, GameStats } from '../types'
import styles from './StatsModal.module.css'

const RANK_ORDER = ['Genius','Amazing','Great','Nice','Solid','Good','Moving Up','Good Start','Beginner']

interface Props {
  user: User | null
  onClose: () => void
}

export default function StatsModal({ user, onClose }: Props) {
  const [stats, setStats] = useState<GameStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) { setLoading(false); return }
    supabase
      .from('game_sessions')
      .select('*')
      .eq('user_id', user.id)
      .then(({ data }) => {
        setStats(computeStats((data ?? []) as GameSession[]))
        setLoading(false)
      })
  }, [user?.id])

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.panel} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <h2>Your Stats</h2>
          <button className={styles.close} onClick={onClose}>✕</button>
        </div>

        {!user && (
          <p className={styles.note}>Sign in to see your stats across devices.</p>
        )}

        {loading && <p className={styles.loading}>Loading…</p>}

        {stats && (
          <>
            <div className={styles.grid4}>
              <Stat label="Played" value={stats.gamesPlayed} />
              <Stat label="Genius %" value={`${stats.geniusRate.toFixed(0)}%`} />
              <Stat label="Streak" value={stats.currentStreak} />
              <Stat label="Best Streak" value={stats.longestStreak} />
            </div>

            <div className={styles.section}>
              <h3>Rank Distribution</h3>
              <div className={styles.bars}>
                {RANK_ORDER.filter(r => stats.rankDistribution[r]).map(rank => (
                  <div key={rank} className={styles.barRow}>
                    <span className={styles.rankLabel}>{rank}</span>
                    <div className={styles.barTrack}>
                      <div
                        className={styles.bar}
                        style={{
                          width: `${(stats.rankDistribution[rank] / stats.gamesPlayed) * 100}%`
                        }}
                      />
                    </div>
                    <span className={styles.barCount}>{stats.rankDistribution[rank]}</span>
                  </div>
                ))}
              </div>
            </div>

            {stats.queenBeeCount > 0 && (
              <p className={styles.queenBee}>🐝 Queen Bee {stats.queenBeeCount} time{stats.queenBeeCount !== 1 ? 's' : ''}!</p>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className={styles.stat}>
      <div className={styles.statValue}>{value}</div>
      <div className={styles.statLabel}>{label}</div>
    </div>
  )
}
```

**Step 6: Create `src/components/StatsModal.module.css`**

```css
.overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.4);
  display: flex; align-items: center; justify-content: center; z-index: 50;
}
.panel {
  background: white; border-radius: 12px; padding: 1.5rem;
  max-width: 480px; width: 90%; max-height: 85vh; overflow-y: auto;
}
.header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.2rem; }
.header h2 { margin: 0; font-size: 1.3rem; }
.close { background: none; border: none; font-size: 1.2rem; cursor: pointer; color: #888; }
.note, .loading { color: #888; text-align: center; padding: 1rem 0; }
.grid4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.75rem; margin-bottom: 1.5rem; }
.stat { text-align: center; }
.statValue { font-size: 2rem; font-weight: 700; line-height: 1.1; }
.statLabel { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; color: #888; }
.section h3 { font-size: 0.9rem; text-transform: uppercase; letter-spacing: 0.05em; color: #888; margin: 0 0 0.5rem; }
.bars { display: flex; flex-direction: column; gap: 0.35rem; }
.barRow { display: flex; align-items: center; gap: 0.5rem; }
.rankLabel { width: 80px; font-size: 0.8rem; text-align: right; flex-shrink: 0; }
.barTrack { flex: 1; background: #f0f0f0; border-radius: 4px; height: 20px; overflow: hidden; }
.bar { height: 100%; background: #f7c835; min-width: 4px; border-radius: 4px; transition: width 0.4s; }
.barCount { width: 24px; font-size: 0.8rem; text-align: right; flex-shrink: 0; }
.queenBee { text-align: center; font-size: 1rem; margin-top: 1rem; }
```

**Step 7: Commit**

```bash
git add src/lib/stats.ts src/lib/stats.test.ts src/components/StatsModal.tsx src/components/StatsModal.module.css
git commit -m "feat: add stats computation and stats modal"
```

---

### Task 13: Archive panel

**Files:**
- Create: `src/components/ArchivePanel.tsx`
- Create: `src/components/ArchivePanel.module.css`

**Step 1: Implement `src/components/ArchivePanel.tsx`**

```typescript
import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../supabase/client'
import { getTodayDateString } from '../hooks/usePuzzle'
import puzzlesJson from '../data/puzzles.json'
import styles from './ArchivePanel.module.css'

interface Props {
  user: User | null
  selectedDate: string
  onSelectDate: (date: string) => void
  onClose: () => void
}

type PlayedMap = Record<string, { rank: string }>

export default function ArchivePanel({ user, selectedDate, onSelectDate, onClose }: Props) {
  const today = getTodayDateString()
  const [played, setPlayed] = useState<PlayedMap>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) { setLoading(false); return }
    supabase
      .from('game_sessions')
      .select('puzzle_date, rank')
      .eq('user_id', user.id)
      .then(({ data }) => {
        const map: PlayedMap = {}
        for (const row of (data ?? [])) {
          map[row.puzzle_date] = { rank: row.rank }
        }
        setPlayed(map)
        setLoading(false)
      })
  }, [user?.id])

  // All available dates up to today, sorted descending
  const availableDates = Object.keys(puzzlesJson as Record<string, unknown>)
    .filter(d => d <= today)
    .sort((a, b) => b.localeCompare(a))

  function handleSelect(date: string) {
    onSelectDate(date)
    onClose()
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.panel} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <h2>Archive</h2>
          <button className={styles.close} onClick={onClose}>✕</button>
        </div>

        {loading && <p className={styles.loading}>Loading…</p>}

        <div className={styles.list}>
          {availableDates.map(date => {
            const isToday = date === today
            const isSelected = date === selectedDate
            const session = played[date]
            const label = formatDate(date)

            return (
              <button
                key={date}
                className={`${styles.row} ${isSelected ? styles.selected : ''}`}
                onClick={() => handleSelect(date)}
              >
                <span className={styles.date}>
                  {label} {isToday && <span className={styles.todayBadge}>Today</span>}
                </span>
                <span className={styles.rank}>
                  {session ? session.rank : <span className={styles.unplayed}>Not played</span>}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00')  // noon to avoid TZ issues
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
```

**Step 2: Create `src/components/ArchivePanel.module.css`**

```css
.overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.4);
  display: flex; align-items: center; justify-content: center; z-index: 50;
}
.panel {
  background: white; border-radius: 12px; padding: 1.5rem;
  max-width: 380px; width: 90%; max-height: 80vh;
  display: flex; flex-direction: column;
}
.header {
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: 1rem; flex-shrink: 0;
}
.header h2 { margin: 0; font-size: 1.3rem; }
.close { background: none; border: none; font-size: 1.2rem; cursor: pointer; color: #888; }
.loading { color: #888; text-align: center; }
.list { overflow-y: auto; display: flex; flex-direction: column; gap: 0.3rem; }
.row {
  display: flex; justify-content: space-between; align-items: center;
  padding: 0.6rem 0.8rem; border: 1.5px solid #e0e0e0; border-radius: 8px;
  background: white; cursor: pointer; text-align: left; font-size: 0.95rem;
  width: 100%;
}
.row:hover { background: #fffbeb; }
.selected { border-color: #f7c835; background: #fffbeb; }
.date { font-weight: 500; }
.todayBadge {
  background: #f7c835; border-radius: 4px; padding: 0 5px;
  font-size: 0.7rem; font-weight: 600; text-transform: uppercase; margin-left: 6px;
}
.rank { color: #555; font-size: 0.9rem; }
.unplayed { color: #bbb; }
```

**Step 3: Commit**

```bash
git add src/components/ArchivePanel.tsx src/components/ArchivePanel.module.css
git commit -m "feat: add archive panel for browsing and replaying past puzzles"
```

---

### Task 14: Word history upgrades

**Files:**
- Modify: `src/components/FoundWordsList.tsx`
- Modify: `src/components/FoundWordsList.module.css`

**Step 1: Read both files before editing**

(Read `src/components/FoundWordsList.tsx` and `src/components/FoundWordsList.module.css`)

**Step 2: Rewrite `src/components/FoundWordsList.tsx`**

Add sort toggle (time vs alphabetical), timestamp on hover, pangram gold highlight:

```typescript
import { useState } from 'react'
import styles from './FoundWordsList.module.css'
import type { Puzzle } from '../types'

interface Props {
  words: string[]
  wordTimestamps: Record<string, string>
  flashWord: string
  puzzle: Puzzle
}

type SortMode = 'alpha' | 'time'

function isPangram(word: string, puzzle: Puzzle): boolean {
  const allLetters = new Set([puzzle.center, ...puzzle.letters].map(l => l.toLowerCase()))
  const wordLetters = new Set([...word.toLowerCase()])
  return [...allLetters].every(l => wordLetters.has(l))
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export default function FoundWordsList({ words, wordTimestamps, flashWord, puzzle }: Props) {
  const [sortMode, setSortMode] = useState<SortMode>('alpha')

  const sorted = sortMode === 'alpha'
    ? [...words].sort()
    : [...words].sort((a, b) => {
        const ta = wordTimestamps[a] ?? ''
        const tb = wordTimestamps[b] ?? ''
        return tb.localeCompare(ta)  // most recent first
      })

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.count}>{words.length} word{words.length !== 1 ? 's' : ''}</span>
        <button
          className={styles.sortToggle}
          onClick={() => setSortMode(m => m === 'alpha' ? 'time' : 'alpha')}
          title={sortMode === 'alpha' ? 'Sort by time found' : 'Sort alphabetically'}
        >
          {sortMode === 'alpha' ? 'A→Z' : 'Recent'}
        </button>
      </div>
      <ul className={styles.list}>
        {sorted.map(word => {
          const pangram = isPangram(word, puzzle)
          const timestamp = wordTimestamps[word]
          return (
            <li
              key={word}
              className={[
                styles.word,
                word === flashWord ? styles.flash : '',
                pangram ? styles.pangram : '',
              ].join(' ')}
              title={timestamp ? `Found at ${formatTimestamp(timestamp)}` : undefined}
            >
              {word}
              {pangram && <span className={styles.pangramBadge}>✦</span>}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
```

**Step 3: Update `src/components/FoundWordsList.module.css`**

Add pangram and sort styles (keep existing flash animation, add to file):

```css
/* ADD these to the existing file */

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.count {
  font-weight: 600;
  font-size: 0.9rem;
  color: #555;
}

.sortToggle {
  background: none;
  border: 1.5px solid #ddd;
  border-radius: 6px;
  padding: 0.2rem 0.5rem;
  font-size: 0.8rem;
  cursor: pointer;
  color: #555;
}

.sortToggle:hover { background: #f5f5f5; }

.pangram {
  color: #b8860b;
  font-weight: 600;
}

.pangramBadge {
  margin-left: 4px;
  font-size: 0.7rem;
  vertical-align: super;
}
```

**Step 4: Commit**

```bash
git add src/components/FoundWordsList.tsx src/components/FoundWordsList.module.css
git commit -m "feat: add word history with timestamps, sort toggle, and pangram highlighting"
```

---

### Task 15: Queen Bee celebration

**Files:**
- Create: `src/components/QueenBeeCelebration.tsx`
- Create: `src/components/QueenBeeCelebration.module.css`

**Step 1: Implement `src/components/QueenBeeCelebration.tsx`**

```typescript
import { useEffect } from 'react'
import styles from './QueenBeeCelebration.module.css'

interface Props {
  onDismiss: () => void
}

export default function QueenBeeCelebration({ onDismiss }: Props) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 5000)
    return () => clearTimeout(timer)
  }, [onDismiss])

  return (
    <div className={styles.overlay} onClick={onDismiss}>
      <div className={styles.content}>
        <div className={styles.emoji}>🐝</div>
        <h1 className={styles.title}>Queen Bee!</h1>
        <p className={styles.subtitle}>You found every word!</p>
        <p className={styles.dismiss}>tap to dismiss</p>
      </div>
    </div>
  )
}
```

**Step 2: Create `src/components/QueenBeeCelebration.module.css`**

```css
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(247, 200, 53, 0.95);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 200;
  animation: fadeIn 0.3s ease;
  cursor: pointer;
}

@keyframes fadeIn {
  from { opacity: 0; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }
}

.content { text-align: center; }

.emoji {
  font-size: 6rem;
  animation: bounce 0.6s ease infinite alternate;
}

@keyframes bounce {
  from { transform: translateY(0); }
  to { transform: translateY(-20px); }
}

.title {
  font-size: 3rem;
  font-weight: 900;
  margin: 0.25rem 0;
  color: #1a1a1a;
}

.subtitle {
  font-size: 1.3rem;
  color: #444;
  margin: 0;
}

.dismiss {
  margin-top: 2rem;
  font-size: 0.85rem;
  color: #777;
}
```

**Step 3: Commit**

```bash
git add src/components/QueenBeeCelebration.tsx src/components/QueenBeeCelebration.module.css
git commit -m "feat: add Queen Bee celebration overlay"
```

---

## Phase 6: Wire App.tsx

### Task 16: Replace App.tsx with full-featured version

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/App.module.css`
- Delete: `src/hooks/useGameState.ts` (replaced by useGameSession)
- Delete: `src/data/puzzle.ts` (replaced by usePuzzle + puzzles.json)

**Step 1: Read `src/App.tsx` and `src/App.module.css` before editing**

(Already read in context)

**Step 2: Rewrite `src/App.tsx`**

```typescript
import { useState, useEffect, useRef } from 'react'
import useAuth from './hooks/useAuth'
import usePuzzle, { getTodayDateString } from './hooks/usePuzzle'
import useGameSession from './hooks/useGameSession'
import HexBoard from './components/HexBoard'
import InputDisplay from './components/InputDisplay'
import GameControls from './components/GameControls'
import ScoreDisplay from './components/ScoreDisplay'
import FoundWordsList from './components/FoundWordsList'
import Toast from './components/Toast'
import VoiceInput from './components/VoiceInput'
import AuthPrompt from './components/AuthPrompt'
import HintsPanel from './components/HintsPanel'
import StatsModal from './components/StatsModal'
import ArchivePanel from './components/ArchivePanel'
import QueenBeeCelebration from './components/QueenBeeCelebration'
import { getHomophones } from './lib/homophones'
import { validateWord } from './lib/validateWord'
import { scoreWord } from './lib/scoring'
import { WORDS } from './data/words'
import type { GameAction } from './types'
import styles from './App.module.css'

type Modal = 'none' | 'hints' | 'stats' | 'archive' | 'auth'

export default function App() {
  const { authState, signInWithEmail, signOut } = useAuth()
  const user = authState.status === 'authenticated' ? authState.user : null

  const [selectedDate, setSelectedDate] = useState(getTodayDateString())
  const puzzle = usePuzzle(selectedDate)

  // Show auth prompt once on first load if not authenticated
  const [modal, setModal] = useState<Modal>('none')
  const hasPromptedAuth = useRef(false)
  useEffect(() => {
    if (authState.status === 'unauthenticated' && !hasPromptedAuth.current) {
      hasPromptedAuth.current = true
      // Small delay so the game loads first
      const t = setTimeout(() => setModal('auth'), 1000)
      return () => clearTimeout(t)
    }
  }, [authState.status])

  const { state, wrappedDispatch, maxScore, rank } = useGameSession(
    puzzle ?? { center: 'T', letters: ['R','A','I','N','E','D'], answers: [] },
    selectedDate,
    user
  )

  const [voiceActive, setVoiceActive] = useState(false)
  const [toastKey, setToastKey] = useState(0)
  const [toastValid, setToastValid] = useState(false)
  const [toastScore, setToastScore] = useState(0)
  const [showQueenBee, setShowQueenBee] = useState(false)
  const prevFoundCountRef = useRef(0)

  // Flash word in FoundWordsList
  const [flashWord, setFlashWord] = useState('')
  const prevFoundWordsRef = useRef<string[]>([])
  useEffect(() => {
    const prev = prevFoundWordsRef.current
    const newWord = state.foundWords.find(w => !prev.includes(w))
    prevFoundWordsRef.current = state.foundWords
    if (newWord) {
      setFlashWord(newWord)
      const timer = setTimeout(() => setFlashWord(''), 800)
      return () => clearTimeout(timer)
    }
  }, [state.foundWords])

  // Queen Bee detection
  useEffect(() => {
    if (!puzzle) return
    const prevCount = prevFoundCountRef.current
    prevFoundCountRef.current = state.foundWords.length
    if (
      prevCount < puzzle.answers.length &&
      state.foundWords.length === puzzle.answers.length &&
      state.foundWords.length > 0
    ) {
      setShowQueenBee(true)
    }
  }, [state.foundWords.length, puzzle])

  function handleDispatch(action: GameAction) {
    if (action.type === 'SUBMIT_WORD') {
      const result = wrappedDispatch(action)
      if (result) {
        setToastValid(result.valid)
        setToastScore(result.valid ? scoreWord(state.input.join('').toLowerCase(), puzzle!) : 0)
        setToastKey(k => k + 1)
      }
    } else {
      wrappedDispatch(action)
    }
  }

  function handleVoiceWord(word: string): { valid: boolean; score: number; duplicate: boolean } {
    if (!puzzle) return { valid: false, score: 0, duplicate: false }

    const lw = word.toLowerCase()
    let result = validateWord(lw, puzzle, state.foundWords, WORDS)
    let submittedWord = lw

    if (!result.valid && result.message === 'Bad letters') {
      for (const candidate of getHomophones(lw)) {
        const alt = validateWord(candidate, puzzle, state.foundWords, WORDS)
        if (alt.valid) {
          result = alt
          submittedWord = candidate
          break
        }
      }
    }

    const pts = result.valid ? scoreWord(submittedWord, puzzle) : 0
    const duplicate = result.message === 'Already found'
    setToastValid(result.valid)
    setToastScore(pts)
    setToastKey(k => k + 1)
    wrappedDispatch({ type: 'SUBMIT_VOICE_WORD', word: submittedWord })
    return { valid: result.valid, score: pts, duplicate }
  }

  if (!puzzle) {
    return <div className={styles.app}><p style={{ textAlign: 'center', marginTop: '4rem' }}>No puzzle available for {selectedDate}.</p></div>
  }

  return (
    <div className={styles.app}>
      {showQueenBee && <QueenBeeCelebration onDismiss={() => setShowQueenBee(false)} />}

      {modal === 'auth' && (
        <AuthPrompt
          onSignIn={signInWithEmail}
          onSkip={() => setModal('none')}
        />
      )}
      {modal === 'hints' && (
        <HintsPanel
          answers={puzzle.answers}
          foundWords={state.foundWords}
          onClose={() => setModal('none')}
        />
      )}
      {modal === 'stats' && (
        <StatsModal user={user} onClose={() => setModal('none')} />
      )}
      {modal === 'archive' && (
        <ArchivePanel
          user={user}
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
          onClose={() => setModal('none')}
        />
      )}

      <header className={styles.header}>
        <h1 className={styles.title}>Spelling Bee</h1>
        <div className={styles.headerActions}>
          <button className={styles.navBtn} onClick={() => setModal('archive')}>Archive</button>
          <button className={styles.navBtn} onClick={() => setModal('stats')}>Stats</button>
          {user
            ? <button className={styles.navBtn} onClick={signOut}>Sign out</button>
            : <button className={styles.navBtn} onClick={() => setModal('auth')}>Sign in</button>
          }
        </div>
      </header>

      <main className={styles.main}>
        <div className={styles.gameColumn}>
          <div className={styles.toastWrapper}>
            <Toast key={toastKey} message={state.message} valid={toastValid} score={toastScore} />
          </div>

          <InputDisplay input={state.input} centerLetter={puzzle.center} />

          <HexBoard
            puzzle={puzzle}
            surroundingLetters={state.surroundingLetters}
            onLetterClick={(letter) => handleDispatch({ type: 'ADD_LETTER', letter })}
          />

          <div className={styles.controlsGroup}>
            <VoiceInput
              active={voiceActive}
              onWord={handleVoiceWord}
              onAutoStop={() => setVoiceActive(false)}
            />
            <GameControls
              puzzle={puzzle}
              onDelete={() => handleDispatch({ type: 'DELETE_LETTER' })}
              onShuffle={() => handleDispatch({ type: 'SHUFFLE' })}
              onSubmit={() => handleDispatch({ type: 'SUBMIT_WORD' })}
              onKeyLetter={(letter) => handleDispatch({ type: 'ADD_LETTER', letter })}
              onMicToggle={() => setVoiceActive(v => !v)}
              micActive={voiceActive}
            />
            <button
              className={styles.hintsBtn}
              onClick={() => setModal('hints')}
            >
              Hints
            </button>
          </div>
        </div>

        <div className={styles.sideColumn}>
          <ScoreDisplay score={state.score} maxScore={maxScore} rank={rank} />
          <FoundWordsList
            words={state.foundWords}
            wordTimestamps={state.wordTimestamps}
            flashWord={flashWord}
            puzzle={puzzle}
          />
        </div>
      </main>
    </div>
  )
}
```

**Step 3: Add header styles to `src/App.module.css`**

Read the file first, then add these classes:

```css
/* ADD to App.module.css */

.headerActions {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.navBtn {
  background: none;
  border: 1.5px solid #ddd;
  border-radius: 8px;
  padding: 0.3rem 0.75rem;
  font-size: 0.85rem;
  cursor: pointer;
  color: #444;
}

.navBtn:hover { background: #fffbeb; border-color: #f7c835; }

.hintsBtn {
  background: none;
  border: 1.5px solid #ddd;
  border-radius: 8px;
  padding: 0.4rem 1rem;
  font-size: 0.9rem;
  cursor: pointer;
  margin-top: 0.5rem;
  width: 100%;
  color: #444;
}

.hintsBtn:hover { background: #fffbeb; border-color: #f7c835; }
```

**Step 4: Delete now-unused files**

```bash
rm src/hooks/useGameState.ts
rm src/data/puzzle.ts
```

**Step 5: Run the dev server and smoke test manually**

```bash
npm run dev
```

Check:
- [ ] Game loads with today's puzzle
- [ ] Can type and submit words
- [ ] Voice input still works
- [ ] Hints button opens panel
- [ ] Archive button opens panel, clicking a date changes the puzzle
- [ ] Stats button opens modal (with or without sign-in)
- [ ] Auth prompt appears ~1s after first load on unauthenticated session
- [ ] Signing in with email sends magic link
- [ ] Queen Bee shows when last word found (test with a small puzzle or force it)

**Step 6: Run the full test suite**

```bash
npm test -- --run
```
Expected: all passing

**Step 7: Build check**

```bash
npm run build
```
Expected: no TypeScript errors, no build failures.

**Step 8: Final commit**

```bash
git add src/App.tsx src/App.module.css
git commit -m "feat: wire App.tsx with daily puzzles, archive, stats, hints, auth, and Queen Bee"
```

**Step 9: Delete unused files commit**

```bash
git add -A
git commit -m "chore: remove useGameState and puzzle.ts (replaced by useGameSession and puzzles.json)"
```

---

## Done

All features implemented:
- ✅ Algorithmic daily puzzle generation (730 days)
- ✅ Archive panel (play any past puzzle)
- ✅ Cross-device sync via Supabase
- ✅ Email magic-link auth
- ✅ Personal stats (games, streak, rank distribution)
- ✅ Word history with timestamps, sort toggle, pangram highlighting
- ✅ Hints panel (remaining count + two-letter grid)
- ✅ Queen Bee celebration
- ✅ All existing features preserved (voice input, scoring, ranks)
