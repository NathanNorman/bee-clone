import { useState } from 'react'
import { getTwoLetterGrid, getRemainingCount } from '../lib/hints'
import styles from './HintsPanel.module.css'

interface Props {
  answers: string[]
  foundWords: string[]
  onClose: () => void
}

export default function HintsPanel({ answers, foundWords, onClose }: Props) {
  const [revealed, setRevealed] = useState(false)
  const remaining = getRemainingCount(answers, foundWords)
  const grid = getTwoLetterGrid(answers, foundWords)
  const entries = Object.entries(grid).sort(([a], [b]) => a.localeCompare(b))

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.panel} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <h2>Hints</h2>
          <button className={styles.close} onClick={onClose}>&#x2715;</button>
        </div>

        <p className={styles.remaining}>
          <strong>{remaining}</strong> word{remaining !== 1 ? 's' : ''} remaining
        </p>

        {remaining === 0 ? (
          <p className={styles.done}>You found them all!</p>
        ) : !revealed ? (
          <button className={styles.reveal} onClick={() => setRevealed(true)}>
            Show two-letter hints
          </button>
        ) : (
          <div className={styles.grid}>
            {entries.map(([pair, count]) => (
              <div key={pair} className={styles.cell}>
                <span className={styles.pair}>{pair}</span>
                <span className={styles.count}>{count}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
