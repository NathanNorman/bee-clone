import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../supabase/client'
import { computeStats } from '../lib/stats'
import type { GameSession } from '../types'
import type { GameStats } from '../lib/stats'
import styles from './StatsModal.module.css'

const RANK_ORDER = ['Genius','Amazing','Great','Nice','Solid','Good','Moving Up','Good Start','Beginner']

interface Props {
  user: User | null
  onClose: () => void
}

export default function StatsModal({ user, onClose }: Props) {
  const [stats, setStats] = useState<GameStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) { setLoading(false); return }
    supabase
      .from('game_sessions')
      .select('*')
      .eq('user_id', user.id)
      .then(({ data }) => {
        setStats(computeStats((data ?? []) as GameSession[]))
        setLoading(false)
      })
  }, [user?.id])

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.panel} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <h2>Your Stats</h2>
          <button className={styles.close} onClick={onClose}>&#x2715;</button>
        </div>

        {!user && (
          <p className={styles.note}>Sign in to see your stats across devices.</p>
        )}

        {loading && user && <p className={styles.loading}>Loading...</p>}

        {stats && (
          <>
            <div className={styles.grid4}>
              <Stat label="Played" value={stats.gamesPlayed} />
              <Stat label="Genius %" value={`${stats.geniusRate.toFixed(0)}%`} />
              <Stat label="Streak" value={stats.currentStreak} />
              <Stat label="Best Streak" value={stats.longestStreak} />
            </div>

            {stats.gamesPlayed > 0 && (
              <div className={styles.section}>
                <h3>Rank Distribution</h3>
                <div className={styles.bars}>
                  {RANK_ORDER.filter(r => stats.rankDistribution[r]).map(rank => (
                    <div key={rank} className={styles.barRow}>
                      <span className={styles.rankLabel}>{rank}</span>
                      <div className={styles.barTrack}>
                        <div
                          className={styles.bar}
                          style={{
                            width: `${(stats.rankDistribution[rank] / stats.gamesPlayed) * 100}%`
                          }}
                        />
                      </div>
                      <span className={styles.barCount}>{stats.rankDistribution[rank]}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {stats.queenBeeCount > 0 && (
              <p className={styles.queenBee}>
                Queen Bee {stats.queenBeeCount} time{stats.queenBeeCount !== 1 ? 's' : ''}!
              </p>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className={styles.stat}>
      <div className={styles.statValue}>{value}</div>
      <div className={styles.statLabel}>{label}</div>
    </div>
  )
}
