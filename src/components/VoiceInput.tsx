import { useEffect, useRef } from 'react'
import { WORDS } from '../data/words'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const SpeechRecognitionAPI: any =
  typeof window !== 'undefined'
    ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    : null

const INACTIVITY_MS = 60_000
// If no result event fires within this window after recent speech, force a restart.
// Only activates after speech has been detected — prevents pointless restarts during silence.
const HEALTH_CHECK_MS = 8_000
// Health check stops forcing restarts if silence exceeds this (inactivity timer handles it)
const HEALTH_CHECK_WINDOW_MS = 30_000
// Base delay before restarting after onend — grows with exponential backoff
const RESTART_DELAY_MS = 300
// Max backoff delay on rapid consecutive failures
const MAX_BACKOFF_MS = 5_000

// Fatal errors that should stop the restart loop entirely
const FATAL_ERRORS = new Set(['not-allowed', 'audio-capture', 'service-not-available', 'language-not-supported'])

interface VoiceInputProps {
  active: boolean
  onWord: (word: string, alternatives?: string[]) => void
  onAutoStop: () => void
  onError?: (error: string) => void
}

export default function VoiceInput({ active, onWord, onAutoStop, onError }: VoiceInputProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null)
  const continuousActiveRef = useRef(false)
  const pendingTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([])
  const inactivityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const healthTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastResultTimeRef = useRef<number>(0)
  const hasSpeechRef = useRef(false) // health check only activates after first speech
  const consecutiveFailuresRef = useRef(0)
  const lastErrorRef = useRef<string | null>(null)
  const generationRef = useRef(0) // prevents stale onend from double-restarting
  const useLocalRef = useRef(true) // try on-device first, disable on failure
  const onWordRef = useRef(onWord)
  const onAutoStopRef = useRef(onAutoStop)
  const onErrorRef = useRef(onError)
  // Global dedup: tracks all words submitted across result indices within a session.
  // Prevents the same word from being submitted twice when Chrome fires overlapping
  // result events (e.g., same word appears in result index 0 and 1).
  const submittedWordsRef = useRef(new Set<string>())
  useEffect(() => { onWordRef.current = onWord }, [onWord])
  useEffect(() => { onAutoStopRef.current = onAutoStop }, [onAutoStop])
  useEffect(() => { onErrorRef.current = onError }, [onError])

  function ts(): string {
    const d = new Date()
    return `[${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}:${d.getSeconds().toString().padStart(2,'0')}.${d.getMilliseconds().toString().padStart(3,'0')}]`
  }

  function clearPendingTimeouts() {
    pendingTimeoutsRef.current.forEach(t => clearTimeout(t))
    pendingTimeoutsRef.current = []
  }

  function resetInactivityTimer() {
    if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current)
    inactivityTimerRef.current = setTimeout(() => {
      console.log(`${ts()} [CONT] inactivity timeout, stopping`)
      onAutoStopRef.current()
    }, INACTIVITY_MS)
  }

  function clearInactivityTimer() {
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current)
      inactivityTimerRef.current = null
    }
  }

  function startHealthCheck() {
    clearHealthCheck()
    healthTimerRef.current = setTimeout(() => {
      if (!continuousActiveRef.current) return
      // Only force-restart if speech was recently detected (zombie detection).
      // During prolonged silence, let the inactivity timer handle shutdown.
      if (!hasSpeechRef.current) return
      const elapsed = Date.now() - lastResultTimeRef.current
      if (elapsed >= HEALTH_CHECK_WINDOW_MS) {
        // Too long since last speech — stop health-checking, let inactivity timer take over
        console.log(`${ts()} [CONT] health check: silence for ${(elapsed / 1000).toFixed(0)}s, deferring to inactivity timer`)
        return
      }
      if (elapsed >= HEALTH_CHECK_MS) {
        console.log(`${ts()} [CONT] health check: no results for ${(elapsed / 1000).toFixed(1)}s, forcing restart`)
        forceRestart()
      }
    }, HEALTH_CHECK_MS)
  }

  function clearHealthCheck() {
    if (healthTimerRef.current) {
      clearTimeout(healthTimerRef.current)
      healthTimerRef.current = null
    }
  }

  function forceRestart() {
    if (!continuousActiveRef.current) return
    // Bump generation so the old instance's onend is ignored
    generationRef.current++
    clearPendingTimeouts()
    try { recognitionRef.current?.stop() } catch (_) { /* ignore */ }
    recognitionRef.current = null
    consecutiveFailuresRef.current = 0
    startContinuous()
  }

  function getBackoffDelay(): number {
    const failures = consecutiveFailuresRef.current
    if (failures <= 1) return RESTART_DELAY_MS
    return Math.min(RESTART_DELAY_MS * Math.pow(2, failures - 1), MAX_BACKOFF_MS)
  }

  function submitWord(word: string, alternatives?: string[]) {
    if (submittedWordsRef.current.has(word)) return
    submittedWordsRef.current.add(word)
    console.log(`${ts()} [CONT] submitting: "${word}"${alternatives?.length ? ` alts=[${alternatives.join(',')}]` : ''}`)
    onWordRef.current(word, alternatives)
  }

  function startContinuous() {
    if (!SpeechRecognitionAPI) return
    const gen = ++generationRef.current
    const rec = new SpeechRecognitionAPI()
    rec.lang = 'en-US'
    rec.interimResults = true
    rec.continuous = true
    rec.maxAlternatives = 5

    // Try Chrome's on-device recognition if available and not previously failed
    if (useLocalRef.current && 'processLocally' in rec) {
      rec.processLocally = true
      console.log(`${ts()} [CONT] using on-device recognition`)
    }

    rec.onresult = (e: any) => {
      lastResultTimeRef.current = Date.now()
      hasSpeechRef.current = true
      consecutiveFailuresRef.current = 0
      lastErrorRef.current = null
      resetInactivityTimer()
      startHealthCheck()
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const raw = e.results[i][0].transcript
        const words = raw.trim().toLowerCase().split(/\s+/).filter(Boolean)
        const isFinal = e.results[i].isFinal

        // Collect unique words from alternative hypotheses (indices 1+)
        const altWords = new Set<string>()
        for (let alt = 1; alt < e.results[i].length; alt++) {
          const altTranscript = e.results[i][alt].transcript
          const aw = altTranscript.trim().toLowerCase().split(/\s+/).filter(Boolean)
          for (const w of aw) altWords.add(w)
        }
        // Remove primary words from alternatives (no duplicates)
        for (const w of words) altWords.delete(w)
        const alternatives = altWords.size > 0 ? Array.from(altWords) : undefined

        if (isFinal) {
          const confidence = (e.results[i][0].confidence * 100).toFixed(0)
          const altInfo = alternatives ? ` alts=${JSON.stringify(alternatives)}` : ''
          console.log(`${ts()} [CONT] FINAL   raw="${raw}" → words=${JSON.stringify(words)} confidence=${confidence}%${altInfo}`)
          // Submit all final words — safety net for anything interim missed
          for (const w of words) {
            submitWord(w, alternatives)
          }
        } else {
          // Interim: submit dictionary words immediately for snappy feedback
          for (const w of words) {
            if (WORDS.has(w)) {
              submitWord(w, alternatives)
            }
          }
        }
      }
    }
    rec.onend = () => {
      // Ignore if this is a stale instance (forceRestart already created a new one)
      if (gen !== generationRef.current) return // stale instance, skip
      if (continuousActiveRef.current) {
        // Only back off for no-speech (Chrome genuinely heard nothing).
        // aborted is transient — retry quickly to minimize gaps in listening.
        const wasAborted = lastErrorRef.current === 'aborted'
        lastErrorRef.current = null
        if (!wasAborted) {
          consecutiveFailuresRef.current++
        }
        const delay = wasAborted ? RESTART_DELAY_MS : getBackoffDelay()
        recognitionRef.current = null
        const t = setTimeout(() => {
          if (!continuousActiveRef.current) return
          if (gen !== generationRef.current) return
          startContinuous()
        }, delay)
        pendingTimeoutsRef.current.push(t)
      } else {
        console.log(`${ts()} [CONT] ended`)
      }
    }
    rec.onerror = (e: any) => {
      const error = e.error as string
      lastErrorRef.current = error
      // no-speech and aborted are normal in continuous mode — don't spam the console
      if (error !== 'no-speech' && error !== 'aborted') {
        console.warn(`${ts()} [CONT] error: ${error}`)
      }

      // On-device recognition doesn't have the language pack — fall back to server-based
      // Delay the restart to let Chrome fully clean up the on-device instance
      if (error === 'language-not-supported' && useLocalRef.current) {
        console.log(`${ts()} [CONT] on-device not available for en-US, falling back to server-based`)
        useLocalRef.current = false
        generationRef.current++
        consecutiveFailuresRef.current = 0
        recognitionRef.current = null
        const t = setTimeout(() => {
          if (!continuousActiveRef.current) return
          startContinuous()
        }, 500)
        pendingTimeoutsRef.current.push(t)
        return
      }

      if (FATAL_ERRORS.has(error)) {
        console.error(`${ts()} [CONT] fatal error "${error}" — stopping voice input`)
        continuousActiveRef.current = false
        generationRef.current++
        recognitionRef.current = null
        clearHealthCheck()
        clearInactivityTimer()

        const messages: Record<string, string> = {
          'not-allowed': 'Microphone permission denied',
          'audio-capture': 'No microphone found',
          'service-not-available': 'Speech service unavailable',
          'language-not-supported': 'Language not supported',
        }
        onErrorRef.current?.(messages[error] ?? error)
        onAutoStopRef.current()
      }
      // no-speech and aborted are normal in continuous mode — onend handles restart
    }
    recognitionRef.current = rec
    try {
      rec.start()
      lastResultTimeRef.current = Date.now()
      console.log(`${ts()} [CONT] recognition started`)
      resetInactivityTimer()
      startHealthCheck()
    } catch (err) {
      console.error(`${ts()} [CONT] failed to start:`, err)
    }
  }

  // Restart recognition when user returns to the tab
  useEffect(() => {
    if (!active) return

    function handleVisibilityChange() {
      if (document.visibilityState === 'visible' && continuousActiveRef.current) {
        console.log(`${ts()} [CONT] tab visible again, forcing restart`)
        forceRestart()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active])

  useEffect(() => {
    if (active) {
      continuousActiveRef.current = true
      consecutiveFailuresRef.current = 0
      generationRef.current = 0
      hasSpeechRef.current = false
      submittedWordsRef.current.clear()
      startContinuous()
    } else {
      continuousActiveRef.current = false
      generationRef.current++
      recognitionRef.current?.stop()
      recognitionRef.current = null
      clearPendingTimeouts()
      clearInactivityTimer()
      clearHealthCheck()
      submittedWordsRef.current.clear()
    }
    return () => {
      continuousActiveRef.current = false
      generationRef.current++
      recognitionRef.current?.stop()
      clearPendingTimeouts()
      clearInactivityTimer()
      clearHealthCheck()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active])

  return null
}
