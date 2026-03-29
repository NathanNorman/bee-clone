import { useState, useEffect, useRef } from 'react'
import useAuth from './hooks/useAuth'
import usePuzzle, { getTodayDateString } from './hooks/usePuzzle'
import useGameSession from './hooks/useGameSession'
import useAudioLevel from './hooks/useAudioLevel'
import HexBoard from './components/HexBoard'
import InputDisplay from './components/InputDisplay'
import GameControls from './components/GameControls'
import ScoreDisplay from './components/ScoreDisplay'
import FoundWordsList from './components/FoundWordsList'
import Toast from './components/Toast'
import VoiceInput from './components/VoiceInput'
import { VoiceTicker } from './components/VoiceTicker'
import AuthPrompt from './components/AuthPrompt'
import HintsPanel from './components/HintsPanel'
import StatsModal from './components/StatsModal'
import ArchivePanel from './components/ArchivePanel'
import QueenBeeCelebration from './components/QueenBeeCelebration'
import { validateWord } from './lib/validateWord'
import { scoreWord } from './lib/scoring'
import { getHomophones } from './lib/homophones'
import { closestWord } from './lib/fuzzyMatch'
import { WORDS } from './data/words'
import type { GameAction, TickerWord } from './types'
import styles from './App.module.css'

const BEAT_MS = 500

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
  const micBands = useAudioLevel(voiceActive)
  const [toastKey, setToastKey] = useState(0)
  const [toastValid, setToastValid] = useState(false)
  const [toastScore, setToastScore] = useState(0)
  const [toastMessage, setToastMessage] = useState('')
  const [showQueenBee, setShowQueenBee] = useState(false)
  const gameColumnRef = useRef<HTMLDivElement>(null)

  // Voice ticker queue
  const [tickerWords, setTickerWords] = useState<TickerWord[]>([])
  const [tickerActive, setTickerActive] = useState(0)
  const tickerTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const processorRef = useRef<() => void>(() => {})

  // Flash newly found word in the list
  const [flashWord, setFlashWord] = useState('')
  const prevFoundWordsRef = useRef<string[]>([])
  useEffect(() => {
    const prev = prevFoundWordsRef.current
    const newWords = state.foundWords.filter(w => !prev.includes(w))
    prevFoundWordsRef.current = state.foundWords
    if (newWords.length === 1) {
      setFlashWord(newWords[0])
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
      prevCount > 0 &&
      prevCount < puzzle.answers.length &&
      state.foundWords.length === puzzle.answers.length
    ) {
      setShowQueenBee(true)
    }
  }, [state.foundWords.length, puzzle.answers.length])

  // Reset Queen Bee celebration when switching puzzle dates
  useEffect(() => {
    setShowQueenBee(false)
  }, [selectedDate])

  function handleDispatch(action: GameAction) {
    if (action.type === 'SUBMIT_WORD') {
      if (state.input.length === 0) return
      const word = state.input.join('').toLowerCase()
      const result = wrappedDispatch(action)
      if (result) {
        setToastMessage(result.message)
        setToastValid(result.valid)
        setToastScore(result.valid ? scoreWord(word, puzzle) : 0)
        setToastKey(k => k + 1)
      }
    } else {
      wrappedDispatch(action)
    }
  }

  // Validates and submits a word from the ticker (no toast — feedback shows in the bar)
  // Fallback chain: exact → speech alternatives → homophones → suffix expansion
  function processTickerWord(word: string, alternatives?: string[]): { status: 'valid' | 'invalid'; feedback: string } {
    const lw = word.toLowerCase()
    let result = validateWord(lw, puzzle, state.foundWords, WORDS)
    let submittedWord = lw

    // Try speech recognition alternatives (API heard multiple hypotheses)
    if (!result.valid && result.message !== 'Already found' && alternatives?.length) {
      for (const alt of alternatives) {
        const altResult = validateWord(alt.toLowerCase(), puzzle, state.foundWords, WORDS)
        if (altResult.valid) {
          result = altResult
          submittedWord = alt.toLowerCase()
          break
        }
      }
    }

    // Try phonetic homophones
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

    // Suffix expansion: speech API often truncates endings ("requester" → "request")
    if (!result.valid && result.message !== 'Already found') {
      const suffixes = ['s', 'er', 'ers', 'es', 'ed', 'ing', 'ly', 'ness', 'ment', 'able', 'tion']
      for (const suffix of suffixes) {
        const extended = lw + suffix
        const alt = validateWord(extended, puzzle, state.foundWords, WORDS)
        if (alt.valid) {
          result = alt
          submittedWord = extended
          break
        }
      }
    }

    // Fuzzy match: find closest valid word by edit distance (catches minor mishearings)
    if (!result.valid && result.message !== 'Already found' && lw.length >= 4) {
      const match = closestWord(lw, puzzle.answers)
      if (match) {
        const alt = validateWord(match, puzzle, state.foundWords, WORDS)
        if (alt.valid) {
          result = alt
          submittedWord = match
        }
      }
    }

    if (result.valid) {
      wrappedDispatch({ type: 'SUBMIT_VOICE_WORD', word: submittedWord })
    }

    return {
      status: result.valid ? 'valid' : 'invalid',
      feedback: result.message,
    }
  }

  // Beat processor — reassigned every render so it always captures fresh state
  processorRef.current = () => {
    if (tickerWords.length === 0) return

    if (tickerActive >= tickerWords.length) {
      // All words processed — stop timer and schedule cleanup
      if (tickerTimerRef.current !== null) {
        clearInterval(tickerTimerRef.current)
        tickerTimerRef.current = null
      }
      setTimeout(() => {
        setTickerWords([])
        setTickerActive(0)
      }, 1500)
      return
    }

    const tw = tickerWords[tickerActive]
    const result = processTickerWord(tw.word, tw.alternatives)

    setTickerWords(prev =>
      prev.map((w, i) =>
        i === tickerActive ? { ...w, status: result.status, feedback: result.feedback } : w
      )
    )
    setTickerActive(prev => prev + 1)
  }

  function startTickerTimer() {
    if (tickerTimerRef.current !== null) return
    // Process first word immediately, then continue on beat interval
    setTimeout(() => processorRef.current(), 0)
    tickerTimerRef.current = setInterval(() => processorRef.current(), BEAT_MS)
  }

  function addToTickerQueue(word: string, alternatives?: string[]) {
    const newWord: TickerWord = {
      id: `${Date.now()}-${Math.random()}`,
      word,
      alternatives,
      status: 'pending',
      feedback: '',
    }
    setTickerWords(prev => [...prev, newWord])
    startTickerTimer()
  }

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (tickerTimerRef.current !== null) clearInterval(tickerTimerRef.current)
    }
  }, [])

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
        <div className={styles.gameColumn} ref={gameColumnRef}>
          <div className={styles.toastWrapper}>
            <Toast key={toastKey} message={toastMessage} valid={toastValid} score={toastScore} />
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
              onWord={addToTickerQueue}
              onAutoStop={() => setVoiceActive(false)}
              onError={(msg) => {
                setToastMessage(msg)
                setToastValid(false)
                setToastScore(0)
                setToastKey(k => k + 1)
              }}
            />
            <GameControls
              puzzle={puzzle}
              onDelete={() => handleDispatch({ type: 'DELETE_LETTER' })}
              onShuffle={() => handleDispatch({ type: 'SHUFFLE' })}
              onSubmit={() => handleDispatch({ type: 'SUBMIT_WORD' })}
              onKeyLetter={(letter) => handleDispatch({ type: 'ADD_LETTER', letter })}
              onMicToggle={() => setVoiceActive(v => !v)}
              micActive={voiceActive}
              micBands={micBands}
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

      <VoiceTicker words={tickerWords} activeIndex={tickerActive} />
    </div>
  )
}
