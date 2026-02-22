import type { Puzzle, ValidationResult } from '../types'

export function validateWord(
  word: string,
  puzzle: Puzzle,
  foundWords: string[],
  dictionary: Set<string>
): ValidationResult {
  if (word.length < 4) {
    return { valid: false, message: 'Too short' }
  }

  if (foundWords.includes(word.toLowerCase())) {
    return { valid: false, message: 'Already found' }
  }

  const allLetters = new Set([puzzle.center.toLowerCase(), ...puzzle.letters.map(l => l.toLowerCase())])
  for (const ch of word.toLowerCase()) {
    if (!allLetters.has(ch)) {
      return { valid: false, message: 'Bad letters' }
    }
  }

  if (!word.toLowerCase().includes(puzzle.center.toLowerCase())) {
    return { valid: false, message: 'Missing center letter' }
  }

  if (!dictionary.has(word.toLowerCase())) {
    return { valid: false, message: 'Not in word list' }
  }

  const wordLetters = new Set([...word.toLowerCase()])
  const isPangram = allLetters.size === wordLetters.size &&
    [...allLetters].every(l => wordLetters.has(l))

  return { valid: true, message: isPangram ? 'Pangram!' : 'Nice!' }
}
