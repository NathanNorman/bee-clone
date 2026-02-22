import { describe, it, expect, vi } from 'vitest'
import { getPuzzleForDate, getTodayDateString } from './usePuzzle'

vi.mock('../data/puzzles.json', () => ({
  default: {
    '2026-02-22': { center: 'T', letters: ['R', 'A', 'I', 'N', 'E', 'D'] },
    '2026-03-01': { center: 'S', letters: ['P', 'L', 'A', 'T', 'E', 'R'] },
  },
}))

vi.mock('../data/words', () => ({
  WORDS: new Set(['train', 'rain', 'drain', 'trained', 'retain', 'retrained', 'detain', 'trade']),
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

  it('computes answers at runtime, excluding words missing the center letter', () => {
    const puzzle = getPuzzleForDate('2026-02-22')
    // 'train' contains T (center) and only letters from {T,R,A,I,N,E,D}
    expect(puzzle!.answers).toContain('train')
    // 'trained' is a pangram
    expect(puzzle!.answers).toContain('trained')
    // 'rain' does not contain T, should be excluded
    expect(puzzle!.answers).not.toContain('rain')
  })
})

describe('getTodayDateString', () => {
  it('returns a YYYY-MM-DD string', () => {
    const today = getTodayDateString()
    expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})
