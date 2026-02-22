import styles from './InputDisplay.module.css'

interface InputDisplayProps {
  input: string[]
  centerLetter: string
}

export default function InputDisplay({ input, centerLetter }: InputDisplayProps) {
  if (input.length === 0) {
    return (
      <div className={styles.display}>
        <span className={styles.cursor} />
      </div>
    )
  }

  return (
    <div className={styles.display}>
      {input.map((letter, i) => (
        <span
          key={i}
          className={letter.toUpperCase() === centerLetter.toUpperCase() ? styles.centerLetter : undefined}
        >
          {letter}
        </span>
      ))}
    </div>
  )
}
