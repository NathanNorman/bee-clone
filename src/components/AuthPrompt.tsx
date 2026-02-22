import { useState } from 'react'
import styles from './AuthPrompt.module.css'

interface Props {
  onSignIn: (email: string) => Promise<{ error: string | null }>
  onSkip: () => void
}

export default function AuthPrompt({ onSignIn, onSkip }: Props) {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('sending')
    const { error } = await onSignIn(email)
    if (error) {
      setErrorMsg(error)
      setStatus('error')
    } else {
      setStatus('sent')
    }
  }

  if (status === 'sent') {
    return (
      <div className={styles.overlay}>
        <div className={styles.card}>
          <h2>Check your email</h2>
          <p>We sent a sign-in link to <strong>{email}</strong>.</p>
          <p>Click it to sync your progress across devices.</p>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.card}>
        <h2>Sync your progress</h2>
        <p>Enter your email to save stats and continue on any device.</p>
        <form onSubmit={handleSubmit} className={styles.form}>
          <input
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            disabled={status === 'sending'}
            className={styles.input}
          />
          {status === 'error' && <p className={styles.error}>{errorMsg}</p>}
          <div className={styles.actions}>
            <button type="submit" disabled={status === 'sending'} className={styles.primary}>
              {status === 'sending' ? 'Sending…' : 'Send magic link'}
            </button>
            <button type="button" onClick={onSkip} className={styles.skip}>
              Play without syncing
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
