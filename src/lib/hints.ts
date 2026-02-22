export function getRemainingCount(answers: string[], foundWords: string[]): number {
  const found = new Set(foundWords)
  return answers.filter(w => !found.has(w)).length
}

export function getTwoLetterGrid(
  answers: string[],
  foundWords: string[]
): Record<string, number> {
  const found = new Set(foundWords)
  const grid: Record<string, number> = {}

  for (const word of answers) {
    if (found.has(word)) continue
    const key = word.slice(0, 2).toUpperCase()
    grid[key] = (grid[key] ?? 0) + 1
  }

  return grid
}
