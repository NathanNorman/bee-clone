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
