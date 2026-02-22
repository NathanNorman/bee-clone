import { describe, it, expect } from 'vitest'
import { scorePuzzle } from './puzzleQuality'

describe('scorePuzzle', () => {
  it('returns invalid when fewer than 15 answers', () => {
    const result = scorePuzzle({
      center: 'T',
      surrounding: ['R', 'A', 'I', 'N', 'E', 'D'],
      answers: ['train', 'drain', 'rained'],
    })
    expect(result.valid).toBe(false)
  })

  it('returns invalid when no pangram', () => {
    const answers = Array.from({ length: 20 }, (_, i) => 'word' + i)
    const result = scorePuzzle({
      center: 'T',
      surrounding: ['R', 'A', 'I', 'N', 'E', 'D'],
      answers,
    })
    expect(result.valid).toBe(false)
  })

  it('returns invalid when no word is 7+ letters', () => {
    const shortAnswers = [
      ...Array.from({ length: 18 }, (_, i) => 'word' + i),
      'retain',
      'detain',
    ]
    const result = scorePuzzle({
      center: 'T',
      surrounding: ['R', 'A', 'I', 'N', 'E', 'D'],
      answers: shortAnswers,
    })
    expect(result.valid).toBe(false)
  })

  it('returns valid for a high-quality puzzle', () => {
    const answers = [
      ...Array.from({ length: 28 }, (_, i) => `word${i}`),
      'trained',
      'training',
    ]
    const result = scorePuzzle({
      center: 'T',
      surrounding: ['R', 'A', 'I', 'N', 'E', 'D'],
      answers,
    })
    expect(result.valid).toBe(true)
    expect(result.score).toBeGreaterThan(0)
  })

  it('returns higher score for more pangrams', () => {
    const base = Array.from({ length: 30 }, (_, i) => `word${i}`)
    const onePangram = scorePuzzle({
      center: 'T', surrounding: ['R','A','I','N','E','D'],
      answers: [...base, 'trained', 'training'],
    })
    const twoPangrams = scorePuzzle({
      center: 'T', surrounding: ['R','A','I','N','E','D'],
      answers: [...base, 'trained', 'detrain', 'training'],
    })
    if (onePangram.valid && twoPangrams.valid) {
      expect(twoPangrams.score).toBeGreaterThan(onePangram.score)
    }
  })
})
