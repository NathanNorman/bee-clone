import { useState, useEffect } from 'react'
import styles from './Toast.module.css'

interface ToastProps {
  message: string
  valid?: boolean
  score?: number
}

export default function Toast({ message, valid = false, score = 0 }: ToastProps) {
  const [visible, setVisible] = useState(false)
  const [displayMessage, setDisplayMessage] = useState('')

  useEffect(() => {
    if (message) {
      setDisplayMessage(message)
      setVisible(true)
      const timer = setTimeout(() => setVisible(false), 1500)
      return () => clearTimeout(timer)
    }
  }, [message])

  if (!visible) return null

  return (
    <div className={`${styles.toast} ${valid ? styles.toastValid : styles.toastInvalid}`}>
      <span>{displayMessage}</span>
      {valid && score > 0 && <span className={styles.score}>+{score}</span>}
    </div>
  )
}
