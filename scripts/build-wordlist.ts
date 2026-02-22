import { readFileSync, writeFileSync } from 'fs'
import { resolve } from 'path'

const inputPath = resolve(__dirname, '../src/data/enable.txt')
const outputPath = resolve(__dirname, '../src/data/words.ts')

const raw = readFileSync(inputPath, 'utf-8')
const words = raw
  .split('\n')
  .map(w => w.trim().toLowerCase())
  .filter(w => w.length >= 4)

const output = `// Auto-generated from ENABLE word list. Do not edit.
// Source: enable.txt filtered to words >= 4 letters
export const WORDS: Set<string> = new Set(${JSON.stringify(words)})
`

writeFileSync(outputPath, output, 'utf-8')
console.log(`Written ${words.length} words to ${outputPath}`)
