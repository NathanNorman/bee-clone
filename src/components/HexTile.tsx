import styles from './HexTile.module.css'

interface HexTileProps {
  letter: string
  isCenter?: boolean
  onClick: () => void
}

export default function HexTile({ letter, isCenter = false, onClick }: HexTileProps) {
  return (
    <svg
      className={styles.tile}
      width="80"
      height="80"
      viewBox="0 0 80 80"
      onClick={onClick}
    >
      <polygon
        className={`${styles.hex} ${isCenter ? styles.hexCenter : styles.hexSurrounding}`}
        points="40,4 72,22 72,58 40,76 8,58 8,22"
      />
      <text
        className={styles.letter}
        x="40"
        y="40"
        textAnchor="middle"
        dominantBaseline="central"
      >
        {letter}
      </text>
    </svg>
  )
}
