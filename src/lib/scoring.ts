import type { Puzzle } from '../types'

export function scoreWord(word: string, puzzle: Puzzle): number {
  let score = word.length === 4 ? 1 : word.length

  const allLetters = new Set([puzzle.center.toLowerCase(), ...puzzle.letters.map(l => l.toLowerCase())])
  const wordLetters = new Set([...word.toLowerCase()])
  const isPangram = [...allLetters].every(l => wordLetters.has(l))

  if (isPangram) {
    score += 7
  }

  return score
}

const RANKS: [number, string][] = [
  [70, 'Genius'],
  [50, 'Amazing'],
  [40, 'Great'],
  [25, 'Nice'],
  [15, 'Solid'],
  [8, 'Good'],
  [5, 'Moving Up'],
  [2, 'Good Start'],
  [0, 'Beginner'],
]

export function getRank(score: number, maxScore: number): string {
  const pct = maxScore === 0 ? 0 : (score / maxScore) * 100
  for (const [threshold, rank] of RANKS) {
    if (pct >= threshold) {
      return rank
    }
  }
  return 'Beginner'
}
