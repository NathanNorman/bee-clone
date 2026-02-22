import { useState, useEffect, useRef } from 'react'
import useGameState from './hooks/useGameState'
import HexBoard from './components/HexBoard'
import InputDisplay from './components/InputDisplay'
import GameControls from './components/GameControls'
import ScoreDisplay from './components/ScoreDisplay'
import FoundWordsList from './components/FoundWordsList'
import Toast from './components/Toast'
import VoiceInput from './components/VoiceInput'
import { validateWord } from './lib/validateWord'
import { scoreWord } from './lib/scoring'
import { getHomophones } from './lib/homophones'
import { PUZZLE } from './data/puzzle'
import { WORDS } from './data/words'
import type { GameAction } from './types'
import styles from './App.module.css'

export default function App() {
  const { puzzle, state, dispatch, maxScore, rank } = useGameState()

  const [voiceActive, setVoiceActive] = useState(false)

  // Increment key on every submit so Toast remounts even for repeated messages
  const [toastKey, setToastKey] = useState(0)
  const [toastValid, setToastValid] = useState(false)
  const [toastScore, setToastScore] = useState(0)

  // Flash the newly accepted word in FoundWordsList
  const [flashWord, setFlashWord] = useState('')
  const prevFoundWordsRef = useRef<string[]>([])
  useEffect(() => {
    const prev = prevFoundWordsRef.current
    const newWord = state.foundWords.find(w => !prev.includes(w))
    prevFoundWordsRef.current = state.foundWords
    if (newWord) {
      setFlashWord(newWord)
      const timer = setTimeout(() => setFlashWord(''), 800)
      return () => clearTimeout(timer)
    }
  }, [state.foundWords])

  function wrappedDispatch(action: GameAction) {
    if (action.type === 'SUBMIT_WORD') {
      const word = state.input.join('').toLowerCase()
      const result = validateWord(word, PUZZLE, state.foundWords, WORDS)
      setToastValid(result.valid)
      setToastScore(result.valid ? scoreWord(word, PUZZLE) : 0)
      setToastKey(k => k + 1)
    }
    dispatch(action)
  }

  function handleVoiceWord(word: string): { valid: boolean; score: number; duplicate: boolean } {
    const lw = word.toLowerCase()
    let result = validateWord(lw, PUZZLE, state.foundWords, WORDS)
    let submittedWord = lw

    // Homophone substitution: Chrome picks the common spelling (e.g. "right"),
    // but the user meant a homophone valid for this puzzle (e.g. "rite").
    // Only substitute if the original fails specifically due to bad letters,
    // and the homophone passes full validation.
    if (!result.valid && result.message === 'Bad letters') {
      for (const candidate of getHomophones(lw)) {
        const alt = validateWord(candidate, PUZZLE, state.foundWords, WORDS)
        if (alt.valid) {
          result = alt
          submittedWord = candidate
          break
        }
      }
    }

    const pts = result.valid ? scoreWord(submittedWord, PUZZLE) : 0
    const duplicate = result.message === 'Already found'
    setToastValid(result.valid)
    setToastScore(pts)
    setToastKey(k => k + 1)
    dispatch({ type: 'SUBMIT_VOICE_WORD', word: submittedWord })
    return { valid: result.valid, score: pts, duplicate }
  }

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <h1 className={styles.title}>Spelling Bee</h1>
      </header>

      <main className={styles.main}>
        <div className={styles.gameColumn}>
          <div className={styles.toastWrapper}>
            <Toast key={toastKey} message={state.message} valid={toastValid} score={toastScore} />
          </div>

          <InputDisplay
            input={state.input}
            centerLetter={puzzle.center}
          />

          <HexBoard
            puzzle={puzzle}
            surroundingLetters={state.surroundingLetters}
            onLetterClick={(letter) => wrappedDispatch({ type: 'ADD_LETTER', letter })}
          />

          {/* Relative wrapper so VoiceInput's word stage can float above controls */}
          <div className={styles.controlsGroup}>
            <VoiceInput
              active={voiceActive}
              onWord={handleVoiceWord}
              onAutoStop={() => setVoiceActive(false)}
            />
            <GameControls
              puzzle={puzzle}
              onDelete={() => wrappedDispatch({ type: 'DELETE_LETTER' })}
              onShuffle={() => wrappedDispatch({ type: 'SHUFFLE' })}
              onSubmit={() => wrappedDispatch({ type: 'SUBMIT_WORD' })}
              onKeyLetter={(letter) => wrappedDispatch({ type: 'ADD_LETTER', letter })}
              onMicToggle={() => setVoiceActive(v => !v)}
              micActive={voiceActive}
            />
          </div>
        </div>

        <div className={styles.sideColumn}>
          <ScoreDisplay
            score={state.score}
            maxScore={maxScore}
            rank={rank}
          />
          <FoundWordsList words={state.foundWords} flashWord={flashWord} />
        </div>
      </main>
    </div>
  )
}
