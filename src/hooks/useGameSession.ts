import { useReducer, useMemo, useEffect, useRef } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../supabase/client'
import { validateWord } from '../lib/validateWord'
import { scoreWord, getRank } from '../lib/scoring'
import { WORDS } from '../data/words'
import type { GameState, GameAction, Puzzle } from '../types'

const makeInitialState = (puzzle: Puzzle): GameState => ({
  input: [],
  foundWords: [],
  wordTimestamps: {},
  score: 0,
  surroundingLetters: [...puzzle.letters],
  message: '',
})

// Internal action for adding a found word — avoids double validation
type InternalAction = GameAction | {
  type: '_WORD_FOUND'
  word: string
  score: number
  message: string
  timestamp: string
} | {
  type: '_RESET'
  puzzle: Puzzle
}

function reducer(state: GameState, action: InternalAction): GameState {
  switch (action.type) {
    case 'ADD_LETTER':
      return { ...state, input: [...state.input, action.letter] }

    case 'DELETE_LETTER':
      return { ...state, input: state.input.slice(0, -1) }

    case 'CLEAR_INPUT':
      return { ...state, input: [] }

    case 'SHUFFLE': {
      const shuffled = [...state.surroundingLetters]
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
      }
      return { ...state, surroundingLetters: shuffled }
    }

    case 'HYDRATE':
      return {
        ...state,
        foundWords: action.foundWords,
        wordTimestamps: action.wordTimestamps,
        score: action.score,
      }

    case '_WORD_FOUND': {
      if (state.foundWords.includes(action.word)) return state
      const newFoundWords = [...state.foundWords, action.word].sort()
      return {
        ...state,
        input: [],
        foundWords: newFoundWords,
        wordTimestamps: { ...state.wordTimestamps, [action.word]: action.timestamp },
        score: state.score + action.score,
        message: action.message,
      }
    }

    case 'SUBMIT_WORD':
    case 'SUBMIT_VOICE_WORD':
      // Handled by wrappedDispatch — these cases just clear input if we somehow reach them
      return { ...state, input: [], message: state.message }

    case '_RESET':
      return makeInitialState(action.puzzle)

    default:
      return state
  }
}

export default function useGameSession(
  puzzle: Puzzle,
  dateStr: string,
  user: User | null
) {
  const [state, dispatch] = useReducer(reducer, puzzle, makeInitialState)
  const puzzleRef = useRef(puzzle)
  puzzleRef.current = puzzle

  // Reset game state when the date changes
  const prevDateRef = useRef(dateStr)
  useEffect(() => {
    if (prevDateRef.current !== dateStr) {
      prevDateRef.current = dateStr
      dispatch({ type: '_RESET', puzzle } as InternalAction)
    }
  }, [dateStr, puzzle])

  const maxScore = useMemo(
    () => puzzle.answers.reduce((sum, w) => sum + scoreWord(w, puzzle), 0),
    [puzzle]
  )

  const rank = getRank(state.score, maxScore)

  // Load existing session from Supabase on mount or date change
  useEffect(() => {
    if (!user) return

    let cancelled = false

    supabase
      .from('game_sessions')
      .select('found_words, word_timestamps, score')
      .eq('puzzle_date', dateStr)
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return
        if (data && data.found_words.length > 0) {
          dispatch({
            type: 'HYDRATE',
            foundWords: data.found_words,
            wordTimestamps: (data.word_timestamps as Record<string, string>) ?? {},
            score: data.score,
          })
        }
      })

    return () => { cancelled = true }
  }, [dateStr, user?.id])

  // Debounced sync to Supabase after state changes
  const syncTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => {
    if (!user || state.foundWords.length === 0) return

    clearTimeout(syncTimeoutRef.current)
    syncTimeoutRef.current = setTimeout(async () => {
      const currentPuzzle = puzzleRef.current
      const currentRank = getRank(state.score, maxScore)
      const isGenius = maxScore > 0 && state.score >= maxScore * 0.7
      const isQueenBee =
        currentPuzzle.answers.length > 0 &&
        state.foundWords.length === currentPuzzle.answers.length

      await supabase.from('game_sessions').upsert(
        {
          user_id: user.id,
          puzzle_date: dateStr,
          found_words: state.foundWords,
          word_timestamps: state.wordTimestamps,
          score: state.score,
          rank: currentRank,
          ...(isGenius ? { genius_at: new Date().toISOString() } : {}),
          ...(isQueenBee ? { queen_bee_at: new Date().toISOString() } : {}),
        },
        { onConflict: 'user_id,puzzle_date' }
      )
    }, 500)

    return () => clearTimeout(syncTimeoutRef.current)
  }, [state.foundWords, state.score, user?.id, dateStr, maxScore])

  function wrappedDispatch(action: GameAction): import('../types').ValidationResult | null {
    if (action.type === 'SUBMIT_WORD') {
      const word = state.input.join('').toLowerCase()
      const result = validateWord(word, puzzle, state.foundWords, WORDS)
      if (result.valid) {
        dispatch({
          type: '_WORD_FOUND',
          word,
          score: scoreWord(word, puzzle),
          message: result.message,
          timestamp: new Date().toISOString(),
        } as InternalAction)
      } else {
        dispatch({ type: 'CLEAR_INPUT' })
      }
      return result
    }

    if (action.type === 'SUBMIT_VOICE_WORD') {
      const word = action.word.toLowerCase()
      const result = validateWord(word, puzzle, state.foundWords, WORDS)
      if (result.valid) {
        dispatch({
          type: '_WORD_FOUND',
          word,
          score: scoreWord(word, puzzle),
          message: result.message,
          timestamp: new Date().toISOString(),
        } as InternalAction)
      }
      return result
    }

    dispatch(action)
    return null
  }

  return { state, wrappedDispatch, maxScore, rank }
}
