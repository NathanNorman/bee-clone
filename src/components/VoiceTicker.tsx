import { useRef, useState, useLayoutEffect } from 'react'
import { motion } from 'framer-motion'
import type { TickerWord } from '../types'
import styles from './VoiceTicker.module.css'

// Horizontal pixel position where the ball hovers (from ticker left edge)
const BALL_X = 160
const BALL_RADIUS = 8

interface Props {
  words: TickerWord[]
  activeIndex: number
}

export function VoiceTicker({ words, activeIndex }: Props) {
  const wordsRef = useRef<HTMLDivElement>(null)
  const wordEls = useRef<(HTMLDivElement | null)[]>([])
  const [containerX, setContainerX] = useState(BALL_X)

  // Clamp so the ball doesn't re-bounce after the last word
  const visualActive = Math.min(activeIndex, words.length - 1)

  // Slide the word row so the active word sits under the ball
  useLayoutEffect(() => {
    if (words.length === 0) return
    const el = wordEls.current[visualActive]
    if (!el) return
    const wordCenter = el.offsetLeft + el.offsetWidth / 2
    setContainerX(BALL_X - wordCenter)
  }, [visualActive, words.length])

  if (words.length === 0) return null

  return (
    <div className={styles.ticker}>
      {/* Ball — fixed x, bounces down to "land" on each word */}
      <motion.div
        key={visualActive}
        className={styles.ball}
        style={{ left: BALL_X - BALL_RADIUS }}
        animate={{ y: [0, 42, 0] }}
        transition={{ duration: 0.5, ease: [0.4, 0, 0.6, 1] }}
      />

      {/* Word conveyor — slides left/right to put active word under the ball */}
      <motion.div
        className={styles.words}
        ref={wordsRef}
        animate={{ x: containerX }}
        transition={{ type: 'spring', stiffness: 220, damping: 28 }}
      >
        {words.map((tw, i) => (
          <div
            key={tw.id}
            ref={el => { wordEls.current[i] = el }}
            className={styles.word}
            data-active={i === visualActive}
            data-processed={i < activeIndex}
          >
            <span className={styles.wordText}>{tw.word.toUpperCase()}</span>
            {tw.status !== 'pending' && (
              <span
                className={styles.feedback}
                data-valid={tw.status === 'valid'}
              >
                {tw.feedback}
              </span>
            )}
          </div>
        ))}
      </motion.div>
    </div>
  )
}
