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
    expect(grid['TR']).toBe(4)  // train, trait, trail, trained
    expect(grid['RA']).toBe(1)  // rain
    expect(grid['DR']).toBe(1)  // drain
    expect(grid['RE']).toBe(2)  // retain, retrain
  })

  it('excludes already-found words', () => {
    const grid = getTwoLetterGrid(ANSWERS, ['train', 'trait', 'trail'])
    expect(grid['TR']).toBe(1)  // trained still remaining
    expect(grid['RA']).toBe(1)
  })

  it('returns empty object when all words found', () => {
    expect(getTwoLetterGrid(ANSWERS, ANSWERS)).toEqual({})
  })
})
