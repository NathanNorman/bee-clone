import { useState, useEffect, useRef } from 'react'
import useAuth from './hooks/useAuth'
import usePuzzle, { getTodayDateString } from './hooks/usePuzzle'
import useGameSession from './hooks/useGameSession'
import HexBoard from './components/HexBoard'
import InputDisplay from './components/InputDisplay'
import GameControls from './components/GameControls'
import ScoreDisplay from './components/ScoreDisplay'
import FoundWordsList from './components/FoundWordsList'
import Toast from './components/Toast'
import VoiceInput from './components/VoiceInput'
import AuthPrompt from './components/AuthPrompt'
import HintsPanel from './components/HintsPanel'
import StatsModal from './components/StatsModal'
import ArchivePanel from './components/ArchivePanel'
import QueenBeeCelebration from './components/QueenBeeCelebration'
import { validateWord } from './lib/validateWord'
import { scoreWord } from './lib/scoring'
import { getHomophones } from './lib/homophones'
import { WORDS } from './data/words'
import type { GameAction } from './types'
import styles from './App.module.css'

type Modal = 'none' | 'hints' | 'stats' | 'archive' | 'auth'

// Fallback puzzle shown briefly before hydration — never used for gameplay
const EMPTY_PUZZLE = { center: '', letters: [], answers: [] }

export default function App() {
  const { authState, signInWithEmail, signOut } = useAuth()
  const user = authState.status === 'authenticated' ? authState.user : null

  const [selectedDate, setSelectedDate] = useState(getTodayDateString())
  const puzzle = usePuzzle(selectedDate) ?? EMPTY_PUZZLE

  const [modal, setModal] = useState<Modal>('none')
  const hasPromptedAuth = useRef(false)
  useEffect(() => {
    if (authState.status === 'unauthenticated' && !hasPromptedAuth.current) {
      hasPromptedAuth.current = true
      const t = setTimeout(() => setModal('auth'), 1000)
      return () => clearTimeout(t)
    }
  }, [authState.status])

  const { state, wrappedDispatch, maxScore, rank } = useGameSession(puzzle, selectedDate, user)

  const [voiceActive, setVoiceActive] = useState(false)
  const [toastKey, setToastKey] = useState(0)
  const [toastValid, setToastValid] = useState(false)
  const [toastScore, setToastScore] = useState(0)
  const [showQueenBee, setShowQueenBee] = useState(false)

  // Flash newly found word in the list
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

  // Queen Bee: detect when all words found
  const prevFoundCountRef = useRef(0)
  useEffect(() => {
    const prevCount = prevFoundCountRef.current
    prevFoundCountRef.current = state.foundWords.length
    if (
      puzzle.answers.length > 0 &&
      prevCount < puzzle.answers.length &&
      state.foundWords.length === puzzle.answers.length
    ) {
      setShowQueenBee(true)
    }
  }, [state.foundWords.length, puzzle.answers.length])

  function handleDispatch(action: GameAction) {
    if (action.type === 'SUBMIT_WORD') {
      const word = state.input.join('').toLowerCase()
      const result = wrappedDispatch(action)
      if (result) {
        setToastValid(result.valid)
        setToastScore(result.valid ? scoreWord(word, puzzle) : 0)
        setToastKey(k => k + 1)
      }
    } else {
      wrappedDispatch(action)
    }
  }

  function handleVoiceWord(word: string): { valid: boolean; score: number; duplicate: boolean } {
    const lw = word.toLowerCase()
    let result = validateWord(lw, puzzle, state.foundWords, WORDS)
    let submittedWord = lw

    if (!result.valid && result.message === 'Bad letters') {
      for (const candidate of getHomophones(lw)) {
        const alt = validateWord(candidate, puzzle, state.foundWords, WORDS)
        if (alt.valid) {
          result = alt
          submittedWord = candidate
          break
        }
      }
    }

    const pts = result.valid ? scoreWord(submittedWord, puzzle) : 0
    const duplicate = result.message === 'Already found'
    setToastValid(result.valid)
    setToastScore(pts)
    setToastKey(k => k + 1)
    wrappedDispatch({ type: 'SUBMIT_VOICE_WORD', word: submittedWord })
    return { valid: result.valid, score: pts, duplicate }
  }

  return (
    <div className={styles.app}>
      {showQueenBee && <QueenBeeCelebration onDismiss={() => setShowQueenBee(false)} />}

      {modal === 'auth' && (
        <AuthPrompt onSignIn={signInWithEmail} onSkip={() => setModal('none')} />
      )}
      {modal === 'hints' && puzzle.answers.length > 0 && (
        <HintsPanel answers={puzzle.answers} foundWords={state.foundWords} onClose={() => setModal('none')} />
      )}
      {modal === 'stats' && (
        <StatsModal user={user} onClose={() => setModal('none')} />
      )}
      {modal === 'archive' && (
        <ArchivePanel
          user={user}
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
          onClose={() => setModal('none')}
        />
      )}

      <header className={styles.header}>
        <h1 className={styles.title}>Spelling Bee</h1>
        <div className={styles.headerActions}>
          <button className={styles.navBtn} onClick={() => setModal('archive')}>Archive</button>
          <button className={styles.navBtn} onClick={() => setModal('stats')}>Stats</button>
          {user
            ? <button className={styles.navBtn} onClick={signOut}>Sign out</button>
            : <button className={styles.navBtn} onClick={() => setModal('auth')}>Sign in</button>
          }
        </div>
      </header>

      <main className={styles.main}>
        <div className={styles.gameColumn}>
          <div className={styles.toastWrapper}>
            <Toast key={toastKey} message={state.message} valid={toastValid} score={toastScore} />
          </div>

          <InputDisplay input={state.input} centerLetter={puzzle.center} />

          <HexBoard
            puzzle={puzzle}
            surroundingLetters={state.surroundingLetters}
            onLetterClick={(letter) => handleDispatch({ type: 'ADD_LETTER', letter })}
          />

          <div className={styles.controlsGroup}>
            <VoiceInput
              active={voiceActive}
              onWord={handleVoiceWord}
              onAutoStop={() => setVoiceActive(false)}
            />
            <GameControls
              puzzle={puzzle}
              onDelete={() => handleDispatch({ type: 'DELETE_LETTER' })}
              onShuffle={() => handleDispatch({ type: 'SHUFFLE' })}
              onSubmit={() => handleDispatch({ type: 'SUBMIT_WORD' })}
              onKeyLetter={(letter) => handleDispatch({ type: 'ADD_LETTER', letter })}
              onMicToggle={() => setVoiceActive(v => !v)}
              micActive={voiceActive}
            />
            <button className={styles.hintsBtn} onClick={() => setModal('hints')}>
              Hints
            </button>
          </div>
        </div>

        <div className={styles.sideColumn}>
          <ScoreDisplay score={state.score} maxScore={maxScore} rank={rank} />
          <FoundWordsList
            words={state.foundWords}
            wordTimestamps={state.wordTimestamps}
            flashWord={flashWord}
            puzzle={puzzle}
          />
        </div>
      </main>
    </div>
  )
}
