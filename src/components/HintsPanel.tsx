import { useState } from 'react'
import { getTwoLetterGrid, getRemainingCount } from '../lib/hints'
import styles from './HintsPanel.module.css'

type HintTab = 'grid' | 'shapes'

interface Props {
  answers: string[]
  foundWords: string[]
  onClose: () => void
}

function getWordShapes(answers: string[], foundWords: string[]): { prefix: string; words: { word: string; found: boolean }[] }[] {
  const foundSet = new Set(foundWords)
  const groups = new Map<string, { word: string; found: boolean }[]>()

  for (const word of [...answers].sort()) {
    const prefix = word.slice(0, 2).toUpperCase()
    if (!groups.has(prefix)) groups.set(prefix, [])
    groups.get(prefix)!.push({ word, found: foundSet.has(word) })
  }

  return Array.from(groups.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([prefix, words]) => ({
      prefix,
      words: words.sort((a, b) => a.word.length - b.word.length),
    }))
}

export default function HintsPanel({ answers, foundWords, onClose }: Props) {
  const [tab, setTab] = useState<HintTab>('grid')
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
            Show hints
          </button>
        ) : (
          <>
            <div className={styles.tabs}>
              <button
                className={`${styles.tab} ${tab === 'grid' ? styles.tabActive : ''}`}
                onClick={() => setTab('grid')}
              >
                Two-Letter Grid
              </button>
              <button
                className={`${styles.tab} ${tab === 'shapes' ? styles.tabActive : ''}`}
                onClick={() => setTab('shapes')}
              >
                Word Shapes
              </button>
            </div>

            {tab === 'grid' ? (
              <div className={styles.grid}>
                {entries.map(([pair, count]) => (
                  <div key={pair} className={styles.cell}>
                    <span className={styles.pair}>{pair}</span>
                    <span className={styles.count}>{count}</span>
                  </div>
                ))}
              </div>
            ) : (
              <WordShapes answers={answers} foundWords={foundWords} />
            )}
          </>
        )}
      </div>
    </div>
  )
}

function WordShapes({ answers, foundWords }: { answers: string[]; foundWords: string[] }) {
  const groups = getWordShapes(answers, foundWords)

  return (
    <div className={styles.shapesContainer}>
      {groups.map(({ prefix, words }) => (
        <div key={prefix} className={styles.shapeGroup}>
          <div className={styles.shapePrefix}>{prefix}</div>
          <div className={styles.shapeWords}>
            {words.map(({ word, found }, i) => (
              <div key={i} className={`${styles.shapeWord} ${found ? styles.shapeFound : ''}`}>
                {found ? (
                  <span className={styles.shapeFull}>{word.toUpperCase()}</span>
                ) : (
                  <>
                    <span className={styles.shapeLetters}>{word.slice(0, 2).toUpperCase()}</span>
                    <span className={styles.shapeBlanks}>
                      {Array.from({ length: word.length - 2 }, (_, j) => (
                        <span key={j} className={styles.shapeBlank} />
                      ))}
                    </span>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
