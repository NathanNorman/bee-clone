import type { Puzzle } from '../types'
import HexTile from './HexTile'
import styles from './HexBoard.module.css'

interface HexBoardProps {
  puzzle: Puzzle
  surroundingLetters: string[]
  onLetterClick: (letter: string) => void
}

const POSITIONS: { top: number; left: number }[] = [
  { top: 5, left: 100 },    // top
  { top: 50, left: 178 },   // top-right
  { top: 140, left: 178 },  // bottom-right
  { top: 185, left: 100 },  // bottom
  { top: 140, left: 22 },   // bottom-left
  { top: 50, left: 22 },    // top-left
]

export default function HexBoard({ puzzle, surroundingLetters, onLetterClick }: HexBoardProps) {
  return (
    <div className={styles.board}>
      {/* Center tile */}
      <div className={styles.tileWrapper} style={{ top: 95, left: 100 }}>
        <HexTile
          letter={puzzle.center}
          isCenter
          onClick={() => onLetterClick(puzzle.center)}
        />
      </div>
      {/* Surrounding tiles */}
      {surroundingLetters.map((letter, i) => (
        <div
          key={letter + i}
          className={styles.tileWrapper}
          style={{ top: POSITIONS[i].top, left: POSITIONS[i].left }}
        >
          <HexTile
            letter={letter}
            onClick={() => onLetterClick(letter)}
          />
        </div>
      ))}
    </div>
  )
}
