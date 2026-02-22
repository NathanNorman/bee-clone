import styles from './FoundWordsList.module.css'
import { scoreWord } from '../lib/scoring'
import { PUZZLE } from '../data/puzzle'

interface FoundWordsListProps {
  words: string[]
  flashWord?: string
}

function isPangram(word: string): boolean {
  const allLetters = new Set([
    PUZZLE.center.toLowerCase(),
    ...PUZZLE.letters.map(l => l.toLowerCase())
  ])
  const wordLetters = new Set([...word.toLowerCase()])
  return [...allLetters].every(l => wordLetters.has(l))
}

export default function FoundWordsList({ words, flashWord }: FoundWordsListProps) {
  // Group by first letter, sort each group by score descending
  const grouped: Record<string, string[]> = {}
  for (const word of words) {
    const key = word[0].toUpperCase()
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(word)
  }

  const groups = Object.keys(grouped)
    .sort()
    .map(letter => ({
      letter,
      words: [...grouped[letter]].sort((a, b) => scoreWord(b, PUZZLE) - scoreWord(a, PUZZLE))
    }))

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        {words.length} {words.length === 1 ? 'word' : 'words'} found
      </div>
      <div className={styles.groups}>
        {groups.map(({ letter, words: groupWords }) => (
          <div key={letter} className={styles.group}>
            <div className={styles.groupLabel}>{letter}</div>
            <ul className={styles.list}>
              {groupWords.map(word => (
                <li
                  key={word}
                  className={`${styles.word} ${word === flashWord ? styles.flash : ''} ${isPangram(word) ? styles.pangram : ''}`}
                >
                  <span className={styles.wordText}>{word}</span>
                  <span className={styles.wordScore}>+{scoreWord(word, PUZZLE)}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}
