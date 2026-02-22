import { useReducer, useMemo } from 'react'
import { PUZZLE } from '../data/puzzle'
import { WORDS } from '../data/words'
import { validateWord } from '../lib/validateWord'
import { scoreWord, getRank } from '../lib/scoring'
import type { GameState, GameAction } from '../types'

const initialState: GameState = {
  input: [],
  foundWords: [],
  score: 0,
  surroundingLetters: [...PUZZLE.letters],
  message: '',
}

function reducer(state: GameState, action: GameAction): GameState {
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
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
      }
      return { ...state, surroundingLetters: shuffled }
    }

    case 'SUBMIT_WORD': {
      const word = state.input.join('').toLowerCase()
      const result = validateWord(word, PUZZLE, state.foundWords, WORDS)

      if (result.valid) {
        const newFoundWords = [...state.foundWords, word].sort()
        return {
          ...state,
          input: [],
          foundWords: newFoundWords,
          score: state.score + scoreWord(word, PUZZLE),
          message: result.message,
        }
      }

      return {
        ...state,
        input: [],
        message: result.message,
      }
    }

    case 'SUBMIT_VOICE_WORD': {
      const word = action.word.toLowerCase()
      const result = validateWord(word, PUZZLE, state.foundWords, WORDS)

      if (result.valid) {
        const newFoundWords = [...state.foundWords, word].sort()
        return {
          ...state,
          foundWords: newFoundWords,
          score: state.score + scoreWord(word, PUZZLE),
          message: result.message,
        }
      }

      return { ...state, message: result.message }
    }

    default:
      return state
  }
}

export default function useGameState() {
  const [state, dispatch] = useReducer(reducer, initialState)

  const maxScore = useMemo(
    () => PUZZLE.answers.reduce((sum, word) => sum + scoreWord(word, PUZZLE), 0),
    []
  )

  const rank = getRank(state.score, maxScore)

  return { puzzle: PUZZLE, state, dispatch, maxScore, rank }
}
