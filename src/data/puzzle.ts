import { WORDS } from './words'
import type { Puzzle } from '../types'

const CENTER = 'T'
const SURROUNDING = ['R', 'A', 'I', 'N', 'E', 'D']
const ALL_LETTERS = new Set([CENTER, ...SURROUNDING])

export const PUZZLE: Puzzle = {
  center: CENTER,
  letters: SURROUNDING,
  answers: Array.from(WORDS).filter(w => {
    const upper = w.toUpperCase()
    return (
      upper.includes(CENTER) &&
      [...upper].every(c => ALL_LETTERS.has(c))
    )
  })
}
