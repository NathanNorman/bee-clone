import { useEffect } from 'react'
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
  puzzle, onDelete, onShuffle, onSubmit, onKeyLetter, onMicToggle, micActive
}: GameControlsProps) {
  useEffect(() => {
    const validLetters = new Set([
      puzzle.center.toUpperCase(),
      ...puzzle.letters.map(l => l.toUpperCase()),
    ])

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Backspace') {
        onDelete()
        return
      }
      if (e.key === 'Enter') {
        onSubmit()
        return
      }
      const upper = e.key.toUpperCase()
      if (upper.length === 1 && validLetters.has(upper)) {
        onKeyLetter(upper)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [puzzle, onDelete, onShuffle, onSubmit, onKeyLetter])

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
      <button
        className={`${styles.btn} ${styles.mic} ${micActive ? styles.micActive : ''}`}
        onClick={onMicToggle}
        aria-label={micActive ? 'Stop listening' : 'Start listening'}
        aria-pressed={micActive}
      >
        <MicIcon />
      </button>
    </div>
  )
}
