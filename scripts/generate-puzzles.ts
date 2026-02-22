/**
 * Generate 2+ years of daily Spelling Bee puzzles from the ENABLE word list.
 * Usage: npx tsx scripts/generate-puzzles.ts [--days 730] [--start YYYY-MM-DD]
 *
 * Idempotent: never overwrites existing dates in puzzles.json.
 * Output: src/data/puzzles.json
 */

import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { scorePuzzle } from '../src/lib/puzzleQuality.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ENABLE_PATH = join(__dirname, '../src/data/enable.txt')
const OUTPUT_PATH = join(__dirname, '../src/data/puzzles.json')

const args = process.argv.slice(2)
const daysArg = args.indexOf('--days')
const startArg = args.indexOf('--start')
const DAYS = daysArg !== -1 ? parseInt(args[daysArg + 1]) : 730
const START_DATE = startArg !== -1 ? args[startArg + 1] : new Date().toISOString().split('T')[0]

console.log('Loading word list...')
const rawWords = readFileSync(ENABLE_PATH, 'utf-8')
  .split('\n')
  .map(w => w.trim().toLowerCase())
  .filter(w => w.length >= 4 && /^[a-z]+$/.test(w))

// Pre-index words by their sorted unique-letter key for fast subset lookup
// e.g. "train" → "AINRT", "trained" → "ADEINRT"
console.log('Indexing words by letter set...')
const wordsByLetterKey = new Map<string, string[]>()
const sevenLetterSets = new Map<string, true>()

for (const word of rawWords) {
  const upperLetters = [...new Set([...word.toUpperCase()])].sort()
  const key = upperLetters.join('')
  if (!wordsByLetterKey.has(key)) wordsByLetterKey.set(key, [])
  wordsByLetterKey.get(key)!.push(word)
  if (upperLetters.length === 7) {
    sevenLetterSets.set(key, true)
  }
}
console.log(`Found ${sevenLetterSets.size} candidate 7-letter sets`)

// For a 7-letter set, get all words whose unique letters are a subset:
// enumerate all 2^7=128 non-empty subsets and look up words for each.
function getAnswersForSet(allLetters: string[]): string[] {
  const n = allLetters.length  // always 7
  const answers: string[] = []
  for (let mask = 1; mask < (1 << n); mask++) {
    const subset = allLetters.filter((_, i) => mask & (1 << i)).sort().join('')
    const words = wordsByLetterKey.get(subset)
    if (words) answers.push(...words)
  }
  return answers
}

console.log('Scoring candidates...')
type Candidate = { center: string; letters: string[]; score: number; key: string }
const candidates: Candidate[] = []

for (const key of sevenLetterSets.keys()) {
  const allLetters = key.split('')

  // Compute answers for this letter set once, then split by center
  const allAnswers = getAnswersForSet(allLetters)

  for (const center of allLetters) {
    const surrounding = allLetters.filter(l => l !== center)
    const answers = allAnswers.filter(w => w.toUpperCase().includes(center))
    const quality = scorePuzzle({ center, surrounding, answers })
    if (quality.valid) {
      candidates.push({ center, letters: surrounding, score: quality.score, key: `${center}-${key}` })
    }
  }
}

candidates.sort((a, b) => b.score - a.score || a.key.localeCompare(b.key))
console.log(`Found ${candidates.length} valid puzzle candidates`)

if (candidates.length < DAYS) {
  console.warn(`WARNING: Only ${candidates.length} candidates for ${DAYS} requested days`)
}

const existing: Record<string, { center: string; letters: string[] }> = existsSync(OUTPUT_PATH)
  ? JSON.parse(readFileSync(OUTPUT_PATH, 'utf-8'))
  : {}

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

  if (result[dateStr]) continue

  const candidate = available[assigned % available.length]
  result[dateStr] = { center: candidate.center, letters: candidate.letters }
  assigned++
}

const sorted = Object.fromEntries(
  Object.entries(result).sort(([a], [b]) => a.localeCompare(b))
)

writeFileSync(OUTPUT_PATH, JSON.stringify(sorted, null, 2))
console.log(`Done. Wrote ${Object.keys(sorted).length} puzzles to src/data/puzzles.json`)
