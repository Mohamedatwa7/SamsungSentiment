"use client"

import { useEffect, useRef, useState } from "react"

interface CountUpProps {
  value: number
  /** Render the final number, e.g. add separators or a suffix. */
  format?: (n: number) => string
  durationMs?: number
  className?: string
}

/**
 * Animates a number from 0 to `value` on first render. Purely presentational —
 * the displayed final value is always exactly `value`.
 */
export function CountUp({ value, format, durationMs = 800, className }: CountUpProps) {
  const [display, setDisplay] = useState(0)
  const startedRef = useRef(false)

  useEffect(() => {
    if (startedRef.current) {
      // Value changed after mount (filters etc.) — snap, don't re-animate.
      setDisplay(value)
      return
    }
    startedRef.current = true

    if (typeof window === "undefined" || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setDisplay(value)
      return
    }

    let raf = 0
    const start = performance.now()
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs)
      const eased = 1 - Math.pow(1 - t, 3)
      setDisplay(value * eased)
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value, durationMs])

  const rounded = Math.round(display * 10) / 10
  const text = format ? format(rounded) : Math.round(rounded).toLocaleString()
  return <span className={className}>{text}</span>
}
