import { useEffect, useRef, useState } from 'react'

const NUM_BANDS = 5
const DECAY = 0.93

// Group 128 frequency bins into 5 bands (voice-weighted toward low/mid)
const BAND_RANGES: [number, number][] = [
  [1, 3],
  [3, 7],
  [7, 14],
  [14, 28],
  [28, 56],
]

export default function useAudioLevel(active: boolean): number[] {
  const [bands, setBands] = useState<number[]>(() => Array(NUM_BANDS).fill(0))
  const ctxRef = useRef<AudioContext | null>(null)
  const rafRef = useRef(0)
  const streamRef = useRef<MediaStream | null>(null)
  const displayRef = useRef<number[]>(Array(NUM_BANDS).fill(0))

  useEffect(() => {
    if (!active) {
      displayRef.current = Array(NUM_BANDS).fill(0)
      setBands(Array(NUM_BANDS).fill(0))
      return
    }

    let cancelled = false

    navigator.mediaDevices.getUserMedia({ audio: true }).then(async stream => {
      if (cancelled) {
        stream.getTracks().forEach(t => t.stop())
        return
      }

      streamRef.current = stream
      const ctx = new AudioContext()
      ctxRef.current = ctx
      if (ctx.state === 'suspended') await ctx.resume()

      const source = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 256
      analyser.smoothingTimeConstant = 0.4
      source.connect(analyser)

      const freqData = new Uint8Array(analyser.frequencyBinCount)

      function tick() {
        if (cancelled) return
        analyser.getByteFrequencyData(freqData)

        const next = displayRef.current.slice()
        for (let b = 0; b < NUM_BANDS; b++) {
          const [lo, hi] = BAND_RANGES[b]
          // Peak value in this band
          let peak = 0
          for (let i = lo; i < hi && i < freqData.length; i++) {
            if (freqData[i] > peak) peak = freqData[i]
          }
          const raw = peak / 255

          // Fast attack, slow decay (gravity)
          if (raw >= next[b]) {
            next[b] = raw
          } else {
            next[b] = next[b] * DECAY
            if (next[b] < 0.01) next[b] = 0
          }
        }

        displayRef.current = next
        setBands(next)
        rafRef.current = requestAnimationFrame(tick)
      }

      rafRef.current = requestAnimationFrame(tick)
    }).catch(() => {
      // getUserMedia denied or unavailable
    })

    return () => {
      cancelled = true
      cancelAnimationFrame(rafRef.current)
      streamRef.current?.getTracks().forEach(t => t.stop())
      streamRef.current = null
      ctxRef.current?.close()
      ctxRef.current = null
      displayRef.current = Array(NUM_BANDS).fill(0)
      setBands(Array(NUM_BANDS).fill(0))
    }
  }, [active])

  return bands
}
