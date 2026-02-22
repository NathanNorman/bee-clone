export interface Puzzle {
  center: string       // single uppercase letter, required in every word
  letters: string[]    // 6 surrounding uppercase letters
  answers: string[]    // all valid words for this puzzle (lowercase)
}

export interface GameState {
  input: string[]
  foundWords: string[]
  wordTimestamps: Record<string, string>  // word → ISO timestamp
  score: number
  surroundingLetters: string[]
  message: string
}

export type GameAction =
  | { type: 'ADD_LETTER'; letter: string }
  | { type: 'DELETE_LETTER' }
  | { type: 'CLEAR_INPUT' }
  | { type: 'SUBMIT_WORD' }
  | { type: 'SUBMIT_VOICE_WORD'; word: string }
  | { type: 'SHUFFLE' }
  | {
      type: 'HYDRATE'
      foundWords: string[]
      wordTimestamps: Record<string, string>
      score: number
    }

export interface ValidationResult {
  valid: boolean
  message: string
}

// Matches the Supabase game_sessions table
export interface GameSession {
  id: string
  user_id: string
  puzzle_date: string
  found_words: string[]
  word_timestamps: Record<string, string>
  score: number
  rank: string
  started_at: string
  genius_at: string | null
  queen_bee_at: string | null
}
