/**
 * Find the closest dictionary word to a misheard speech input.
 * Uses Levenshtein edit distance, filtered to only puzzle-valid words.
 */

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length
  const dp: number[] = Array.from({ length: n + 1 }, (_, i) => i)
  for (let i = 1; i <= m; i++) {
    let prev = dp[0]
    dp[0] = i
    for (let j = 1; j <= n; j++) {
      const temp = dp[j]
      dp[j] = a[i - 1] === b[j - 1]
        ? prev
        : 1 + Math.min(prev, dp[j], dp[j - 1])
      prev = temp
    }
  }
  return dp[n]
}

export function closestWord(
  heard: string,
  candidates: Iterable<string>,
  maxDist = 2
): string | null {
  let best: string | null = null
  let bestDist = maxDist + 1
  for (const w of candidates) {
    if (Math.abs(w.length - heard.length) > maxDist) continue
    const d = levenshtein(heard, w)
    if (d < bestDist) {
      bestDist = d
      best = w
    }
    if (d === 1) break // 1-edit match is good enough
  }
  return best
}
