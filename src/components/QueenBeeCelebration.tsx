import { useEffect } from 'react'
import styles from './QueenBeeCelebration.module.css'

interface Props {
  onDismiss: () => void
}

export default function QueenBeeCelebration({ onDismiss }: Props) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 5000)
    return () => clearTimeout(timer)
  }, [onDismiss])

  return (
    <div className={styles.overlay} onClick={onDismiss}>
      <div className={styles.content}>
        <div className={styles.emoji}>🐝</div>
        <h1 className={styles.title}>Queen Bee!</h1>
        <p className={styles.subtitle}>You found every word!</p>
        <p className={styles.dismiss}>tap to dismiss</p>
      </div>
    </div>
  )
}
