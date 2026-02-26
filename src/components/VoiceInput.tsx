import { useEffect, useRef } from 'react'
import { WORDS } from '../data/words'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const SpeechRecognitionAPI: any =
  typeof window !== 'undefined'
    ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    : null

const INACTIVITY_MS = 60_000

interface VoiceInputProps {
  active: boolean
  onWord: (word: string, alternatives?: string[]) => void
  onAutoStop: () => void
}

export default function VoiceInput({ active, onWord, onAutoStop }: VoiceInputProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null)
  const continuousActiveRef = useRef(false)
  const pendingTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([])
  const inactivityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const onWordRef = useRef(onWord)
  const onAutoStopRef = useRef(onAutoStop)
  // Per result index, tracks which words we've already submitted.
  // Interim words only go through if they're real English words (in WORDS).
  // Final results submit anything not yet sent for that result, as a safety net.
  const sentPerResult = useRef(new Map<number, Set<string>>())
  useEffect(() => { onWordRef.current = onWord }, [onWord])
  useEffect(() => { onAutoStopRef.current = onAutoStop }, [onAutoStop])

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

  function submitWord(resultIdx: number, word: string, alternatives?: string[]) {
    let sent = sentPerResult.current.get(resultIdx)
    if (!sent) {
      sent = new Set()
      sentPerResult.current.set(resultIdx, sent)
    }
    if (sent.has(word)) return
    sent.add(word)
    console.log(`${ts()} [CONT] submitting[${resultIdx}]: "${word}"${alternatives?.length ? ` alts=[${alternatives.join(',')}]` : ''}`)
    onWordRef.current(word, alternatives)
  }

  function startContinuous() {
    if (!SpeechRecognitionAPI) return
    const rec = new SpeechRecognitionAPI()
    rec.lang = 'en-US'
    rec.interimResults = true
    rec.continuous = true
    rec.maxAlternatives = 5
    rec.onresult = (e: any) => {
      resetInactivityTimer()
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
            submitWord(i, w, alternatives)
          }
          sentPerResult.current.delete(i)
        } else {
          // Interim: only submit words that exist in the dictionary
          for (const w of words) {
            if (WORDS.has(w)) {
              submitWord(i, w, alternatives)
            }
          }
        }
      }
    }
    rec.onend = () => {
      if (continuousActiveRef.current) {
        console.log(`${ts()} [CONT] restarting after onend`)
        setTimeout(() => {
          if (!continuousActiveRef.current) return
          try {
            rec.start()
          } catch (_) {
            // Same instance restart failed — create fresh recognition
            console.log(`${ts()} [CONT] restart failed, creating fresh instance`)
            recognitionRef.current = null
            startContinuous()
          }
        }, 50)
      } else {
        console.log(`${ts()} [CONT] ended`)
      }
    }
    rec.onerror = (e: any) => {
      console.warn(`${ts()} [CONT] error: ${e.error}`)
    }
    recognitionRef.current = rec
    try {
      rec.start()
      console.log(`${ts()} [CONT] recognition started`)
      resetInactivityTimer()
    } catch (err) {
      console.error(`${ts()} [CONT] failed to start:`, err)
    }
  }

  useEffect(() => {
    if (active) {
      continuousActiveRef.current = true
      startContinuous()
    } else {
      continuousActiveRef.current = false
      recognitionRef.current?.stop()
      recognitionRef.current = null
      clearPendingTimeouts()
      clearInactivityTimer()
      sentPerResult.current.clear()
    }
    return () => {
      continuousActiveRef.current = false
      recognitionRef.current?.stop()
      clearPendingTimeouts()
      clearInactivityTimer()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active])

  return null
}
