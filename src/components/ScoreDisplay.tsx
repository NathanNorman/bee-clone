import styles from './ScoreDisplay.module.css'

interface ScoreDisplayProps {
  score: number
  maxScore: number
  rank: string
}

const RANK_ORDER = [
  'Beginner', 'Good Start', 'Moving Up', 'Good',
  'Solid', 'Nice', 'Great', 'Amazing', 'Genius'
]

export default function ScoreDisplay({ score, maxScore, rank }: ScoreDisplayProps) {
  const progress = maxScore > 0 ? Math.min((score / maxScore) * 100, 100) : 0
  const rankIndex = RANK_ORDER.indexOf(rank)

  return (
    <div className={styles.container}>
      <div className={styles.scoreRow}>
        <span className={styles.score}>{score}</span>
        <span className={styles.rank}>{rank}</span>
      </div>
      <div className={styles.dots}>
        {RANK_ORDER.map((r, i) => (
          <div
            key={r}
            className={`${styles.dot} ${i < rankIndex ? styles.dotPast : ''} ${r === rank ? styles.dotCurrent : ''}`}
            title={r}
          />
        ))}
      </div>
      <div className={styles.barTrack}>
        <div className={styles.barFill} style={{ width: `${progress}%` }} />
      </div>
    </div>
  )
}
