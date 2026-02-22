import type { GameSession } from '../types'
import { getTodayDateString } from '../hooks/usePuzzle'

export interface GameStats {
  gamesPlayed: number
  geniusRate: number        // 0-100
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
  const dateSet = new Set(sorted.map(s => s.puzzle_date))

  // Current streak: walk backwards from today
  let currentStreak = 0
  const cursor = new Date(todayStr)
  while (true) {
    const ds = cursor.toISOString().split('T')[0]
    if (dateSet.has(ds)) {
      currentStreak++
      cursor.setDate(cursor.getDate() - 1)
    } else {
      break
    }
  }

  // Longest streak: scan sorted sessions
  let longestStreak = 0
  let runLength = 0
  let prevDate: string | null = null
  for (const s of sorted) {
    if (!prevDate) {
      runLength = 1
    } else {
      const prev = new Date(prevDate)
      const curr = new Date(s.puzzle_date)
      const diffDays = Math.round((curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24))
      runLength = diffDays === 1 ? runLength + 1 : 1
    }
    longestStreak = Math.max(longestStreak, runLength)
    prevDate = s.puzzle_date
  }
  longestStreak = Math.max(longestStreak, currentStreak)

  // Rank distribution
  const rankDistribution: Record<string, number> = {}
  for (const s of sessions) {
    rankDistribution[s.rank] = (rankDistribution[s.rank] ?? 0) + 1
  }

  const geniusCount = sessions.filter(s => s.genius_at !== null).length

  return {
    gamesPlayed: sessions.length,
    geniusRate: sessions.length > 0 ? (geniusCount / sessions.length) * 100 : 0,
    currentStreak,
    longestStreak,
    rankDistribution,
    queenBeeCount: sessions.filter(s => s.queen_bee_at !== null).length,
  }
}
