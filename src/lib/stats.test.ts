import { describe, it, expect } from 'vitest'
import { computeStats } from './stats'
import type { GameSession } from '../types'

const makeSession = (overrides: Partial<GameSession>): GameSession => ({
  id: 'test-id',
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
    expect(stats.geniusRate).toBe(0)
  })

  it('counts games played', () => {
    const sessions = [
      makeSession({ puzzle_date: '2026-02-20' }),
      makeSession({ puzzle_date: '2026-02-21' }),
      makeSession({ puzzle_date: '2026-02-22' }),
    ]
    expect(computeStats(sessions, '2026-02-22').gamesPlayed).toBe(3)
  })

  it('computes genius rate', () => {
    const sessions = [
      makeSession({ puzzle_date: '2026-02-20', genius_at: '2026-02-20T11:00:00Z' }),
      makeSession({ puzzle_date: '2026-02-21', genius_at: null }),
      makeSession({ puzzle_date: '2026-02-22', genius_at: '2026-02-22T11:00:00Z' }),
    ]
    const stats = computeStats(sessions, '2026-02-22')
    expect(stats.geniusRate).toBeCloseTo(66.7, 0)
  })

  it('computes current streak for consecutive days', () => {
    const sessions = [
      makeSession({ puzzle_date: '2026-02-20' }),
      makeSession({ puzzle_date: '2026-02-21' }),
      makeSession({ puzzle_date: '2026-02-22' }),
    ]
    expect(computeStats(sessions, '2026-02-22').currentStreak).toBe(3)
  })

  it('resets streak on gap', () => {
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
