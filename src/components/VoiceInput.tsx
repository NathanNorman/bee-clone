import { useEffect, useRef, useState } from 'react'
import styles from './VoiceInput.module.css'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const SpeechRecognitionAPI: any =
  typeof window !== 'undefined'
    ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    : null

const INACTIVITY_MS = 60_000
const FLOAT_DURATION_MS = 2000

interface VoiceInputProps {
  active: boolean
  onWord: (word: string) => { valid: boolean; score: number; duplicate: boolean }
  onAutoStop: () => void
}

interface FloatingWord {
  id: string
  word: string
  kind: 'correct' | 'duplicate' | 'incorrect'
  score: number
  x: number  // vw %
  y: number  // vh %
}

// 8 screen zones: words get shuffled into different zones so they don't cluster
const ZONES = [
  { xMin: 5,  xMax: 28, yMin: 10, yMax: 35 },
  { xMin: 40, xMax: 62, yMin: 8,  yMax: 28 },
  { xMin: 68, xMax: 88, yMin: 10, yMax: 35 },
  { xMin: 5,  xMax: 28, yMin: 55, yMax: 78 },
  { xMin: 38, xMax: 62, yMin: 60, yMax: 80 },
  { xMin: 68, xMax: 88, yMin: 55, yMax: 78 },
  { xMin: 12, xMax: 35, yMin: 38, yMax: 52 },
  { xMin: 60, xMax: 84, yMin: 38, yMax: 52 },
]

function getRandomPositions(count: number): Array<{ x: number; y: number }> {
  const shuffled = [...ZONES].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, count).map(zone => ({
    x: zone.xMin + Math.random() * (zone.xMax - zone.xMin),
    y: zone.yMin + Math.random() * (zone.yMax - zone.yMin),
  }))
}

export default function VoiceInput({ active, onWord, onAutoStop }: VoiceInputProps) {
  const [interimText, setInterimText] = useState('')
  const [floatingWords, setFloatingWords] = useState<FloatingWord[]>([])
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null)
  const continuousActiveRef = useRef(false)
  const pendingTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([])
  const inactivityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const onWordRef = useRef(onWord)
  const onAutoStopRef = useRef(onAutoStop)
  useEffect(() => { onWordRef.current = onWord }, [onWord])
  useEffect(() => { onAutoStopRef.current = onAutoStop }, [onAutoStop])

  function ts(): string {
    const d = new Date()
    return `[${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}:${d.getSeconds().toString().padStart(2,'0')}.${d.getMilliseconds().toString().padStart(3,'0')}]`
  }

  function extractFirstWord(transcript: string): string {
    return transcript.trim().toLowerCase().split(/\s+/)[0] ?? ''
  }

  function clearPendingTimeouts() {
    pendingTimeoutsRef.current.forEach(t => clearTimeout(t))
    pendingTimeoutsRef.current = []
  }

  function scheduleTimeout(fn: () => void, delay: number) {
    const t = setTimeout(fn, delay)
    pendingTimeoutsRef.current.push(t)
    return t
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

  function startContinuous() {
    if (!SpeechRecognitionAPI) return
    const rec = new SpeechRecognitionAPI()
    rec.lang = 'en-US'
    rec.interimResults = true
    rec.continuous = true
    rec.maxAlternatives = 1
    rec.onresult = (e: any) => {
      resetInactivityTimer()
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const raw = e.results[i][0].transcript
        const word = extractFirstWord(raw)
        const confidence = (e.results[i][0].confidence * 100).toFixed(0)
        if (e.results[i].isFinal) {
          const words = raw.trim().toLowerCase().split(/\s+/).filter(Boolean)
          console.log(`${ts()} [CONT] FINAL   raw="${raw}" → words=${JSON.stringify(words)} confidence=${confidence}%`)

          // Submit all words immediately and scatter them across the screen
          const positions = getRandomPositions(words.length)
          const newFloaters: FloatingWord[] = words.map((w: string, idx: number) => {
            console.log(`${ts()} [CONT] submitting guess: "${w}"`)
            const result = onWordRef.current(w)
            return {
              id: `${Date.now()}-${idx}`,
              word: w,
              kind: result.valid ? 'correct' : result.duplicate ? 'duplicate' : 'incorrect',
              score: result.score,
              x: positions[idx].x,
              y: positions[idx].y,
            }
          })

          setInterimText('')
          setFloatingWords(prev => [...prev, ...newFloaters])

          const ids = new Set(newFloaters.map(f => f.id))
          scheduleTimeout(() => {
            setFloatingWords(prev => prev.filter(f => !ids.has(f.id)))
          }, FLOAT_DURATION_MS)
        } else {
          console.log(`${ts()} [CONT] interim raw="${raw}" → word="${word}"`)
          setInterimText(raw.trim().toLowerCase())
        }
      }
    }
    rec.onend = () => {
      if (continuousActiveRef.current) {
        console.log(`${ts()} [CONT] restarting after onend`)
        try { rec.start() } catch (_) {}
      } else {
        console.log(`${ts()} [CONT] ended`)
        setInterimText('')
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
      setInterimText('')
      setFloatingWords([])
    }
    return () => {
      continuousActiveRef.current = false
      recognitionRef.current?.stop()
      clearPendingTimeouts()
      clearInactivityTimer()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active])

  return (
    <>
      {/* Interim text — absolutely positioned above controls, no flow impact */}
      {interimText && (
        <div className={styles.wordStage}>
          <span className={styles.wordText}>{interimText.toUpperCase()}</span>
        </div>
      )}

      {/* Floating words — scattered across the screen on final result */}
      {floatingWords.map(fw => (
        <div
          key={fw.id}
          className={`${styles.floatingWord} ${
            fw.kind === 'correct'   ? styles.floatingCorrect   :
            fw.kind === 'duplicate' ? styles.floatingDuplicate :
            styles.floatingIncorrect
          }`}
          style={{ left: `${fw.x}vw`, top: `${fw.y}vh` }}
        >
          <span>{fw.word.toUpperCase()}</span>
          {fw.kind === 'correct' && fw.score > 0 && (
            <span className={styles.floatingScore}>+{fw.score}</span>
          )}
        </div>
      ))}
    </>
  )
}
