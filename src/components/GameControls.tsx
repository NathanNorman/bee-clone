import { useEffect, useRef } from 'react'
import type { Puzzle } from '../types'
import styles from './GameControls.module.css'

interface GameControlsProps {
  puzzle: Puzzle
  onDelete: () => void
  onShuffle: () => void
  onSubmit: () => void
  onKeyLetter: (letter: string) => void
  onMicToggle: () => void
  micActive: boolean
  micBands?: number[]
}

function MicIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 19v3m7-12v2a7 7 0 0 1-14 0v-2"/>
      <rect width="6" height="13" x="9" y="2" rx="3"/>
    </svg>
  )
}

export default function GameControls({
  puzzle, onDelete, onShuffle, onSubmit, onKeyLetter, onMicToggle, micActive, micBands
}: GameControlsProps) {
  const onDeleteRef = useRef(onDelete)
  const onSubmitRef = useRef(onSubmit)
  const onKeyLetterRef = useRef(onKeyLetter)
  useEffect(() => { onDeleteRef.current = onDelete }, [onDelete])
  useEffect(() => { onSubmitRef.current = onSubmit }, [onSubmit])
  useEffect(() => { onKeyLetterRef.current = onKeyLetter }, [onKeyLetter])

  useEffect(() => {
    const validLetters = new Set([
      puzzle.center.toUpperCase(),
      ...puzzle.letters.map(l => l.toUpperCase()),
    ])

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Backspace') {
        onDeleteRef.current()
        return
      }
      if (e.key === 'Enter') {
        onSubmitRef.current()
        return
      }
      const upper = e.key.toUpperCase()
      if (upper.length === 1 && validLetters.has(upper)) {
        onKeyLetterRef.current(upper)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [puzzle])

  return (
    <div className={styles.controls}>
      <button className={`${styles.btn} ${styles.outlined}`} onClick={onDelete}>
        Delete
      </button>
      <button className={`${styles.btn} ${styles.outlined}`} onClick={onShuffle}>
        Shuffle
      </button>
      <button className={`${styles.btn} ${styles.submit}`} onClick={onSubmit}>
        Enter
      </button>
      <div className={styles.micWrap}>
        {micActive && micBands && (
          <div className={styles.eqBars} aria-hidden="true">
            {micBands.map((level, i) => (
              <div
                key={i}
                className={styles.eqBar}
                style={{ height: `${Math.max(level * 100, 4)}%` }}
              />
            ))}
          </div>
        )}
        <button
          className={`${styles.btn} ${styles.mic} ${micActive ? styles.micActive : ''}`}
          onClick={onMicToggle}
          aria-label={micActive ? 'Stop listening' : 'Start listening'}
          aria-pressed={micActive}
        >
          <MicIcon />
        </button>
      </div>
    </div>
  )
}
