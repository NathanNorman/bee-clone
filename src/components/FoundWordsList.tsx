import { useState } from 'react'
import styles from './FoundWordsList.module.css'
import type { Puzzle } from '../types'

interface Props {
  words: string[]
  wordTimestamps: Record<string, string>
  flashWord: string
  puzzle: Puzzle
}

type SortMode = 'alpha' | 'time'

function isPangram(word: string, puzzle: Puzzle): boolean {
  const allLetters = new Set([puzzle.center, ...puzzle.letters].map(l => l.toLowerCase()))
  const wordLetters = new Set([...word.toLowerCase()])
  return [...allLetters].every(l => wordLetters.has(l))
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export default function FoundWordsList({ words, wordTimestamps, flashWord, puzzle }: Props) {
  const [sortMode, setSortMode] = useState<SortMode>('alpha')

  const sorted = sortMode === 'alpha'
    ? [...words].sort()
    : [...words].sort((a, b) => {
        const ta = wordTimestamps[a] ?? ''
        const tb = wordTimestamps[b] ?? ''
        return tb.localeCompare(ta)
      })

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.count}>{words.length} word{words.length !== 1 ? 's' : ''}</span>
        <button
          className={styles.sortToggle}
          onClick={() => setSortMode(m => m === 'alpha' ? 'time' : 'alpha')}
          title={sortMode === 'alpha' ? 'Sort by time found' : 'Sort alphabetically'}
        >
          {sortMode === 'alpha' ? 'A→Z' : 'Recent'}
        </button>
      </div>
      <ul className={styles.list}>
        {sorted.map(word => {
          const pangramWord = isPangram(word, puzzle)
          const timestamp = wordTimestamps[word]
          return (
            <li
              key={word}
              className={[
                styles.word,
                word === flashWord ? styles.flash : '',
                pangramWord ? styles.pangram : '',
              ].filter(Boolean).join(' ')}
              title={timestamp ? `Found at ${formatTimestamp(timestamp)}` : undefined}
            >
              {word}
              {pangramWord && <span className={styles.pangramBadge}>✦</span>}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
