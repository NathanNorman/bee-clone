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
