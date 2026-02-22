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

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

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

        {loading && user && <p className={styles.loading}>Loading…</p>}

        <div className={styles.list}>
          {availableDates.map(date => {
            const isToday = date === today
            const isSelected = date === selectedDate

            const session = played[date]

            return (
              <button
                key={date}
                className={`${styles.row} ${isSelected ? styles.selected : ''}`}
                onClick={() => handleSelect(date)}
              >
                <span className={styles.date}>
                  {formatDate(date)}
                  {isToday && <span className={styles.todayBadge}>Today</span>}
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
