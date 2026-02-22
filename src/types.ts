export interface Puzzle {
  center: string       // single uppercase letter, required in every word
  letters: string[]    // 6 surrounding uppercase letters
  answers: string[]    // all valid words for this puzzle (lowercase)
}

export interface GameState {
  input: string[]        // current letters typed, e.g. ['S','T','A','R']
  foundWords: string[]   // accepted words this session
  score: number
  surroundingLetters: string[]  // current order of surrounding tiles (shuffleable)
  message: string        // last validation message to display (empty string = no message)
}

export type GameAction =
  | { type: 'ADD_LETTER'; letter: string }
  | { type: 'DELETE_LETTER' }
  | { type: 'CLEAR_INPUT' }
  | { type: 'SUBMIT_WORD' }
  | { type: 'SUBMIT_VOICE_WORD'; word: string }
  | { type: 'SHUFFLE' }

export interface ValidationResult {
  valid: boolean
  message: string  // e.g. "Too short", "Not in word list", "Amazing!" etc.
}
