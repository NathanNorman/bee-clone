export interface PuzzleCandidate {
  center: string         // uppercase letter
  surrounding: string[]  // 6 uppercase letters
  answers: string[]      // all valid answers (lowercase)
}

export interface QualityScore {
  valid: boolean
  score: number
}

export function scorePuzzle(candidate: PuzzleCandidate): QualityScore {
  const { center, surrounding, answers } = candidate
  const allLetters = new Set([center, ...surrounding])

  if (allLetters.size !== 7) return { valid: false, score: 0 }
  if (answers.length < 15 || answers.length > 100) return { valid: false, score: 0 }

  const pangrams = answers.filter(w => {
    const wLetters = new Set([...w.toUpperCase()])
    return [...allLetters].every(l => wLetters.has(l))
  })
  if (pangrams.length < 1) return { valid: false, score: 0 }
  if (!answers.some(w => w.length >= 7)) return { valid: false, score: 0 }

  const answerScore = 100 - Math.abs(answers.length - 40)
  const pangramScore = pangrams.length * 10
  const longWordScore = Math.min(answers.filter(w => w.length >= 7).length * 3, 30)

  return { valid: true, score: answerScore + pangramScore + longWordScore }
}
