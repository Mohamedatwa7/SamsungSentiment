"use client"

import { useEffect, useState } from "react"

const STAGES = [
  "Connecting to live data…",
  "Loading 30,000+ comments…",
  "Computing sentiment metrics…",
  "Building comment health index…",
  "Rendering analytics…",
]

/* Full-area branded loader shown while the comment corpus loads (the initial
   fetch can take ~15s cold). Cycling stage text + animated progress reassure
   the user that the page is working, not broken. */
export function LoadingScreen() {
  const [stage, setStage] = useState(0)

  useEffect(() => {
    const t = setInterval(() => setStage((s) => Math.min(s + 1, STAGES.length - 1)), 2800)
    return () => clearInterval(t)
  }, [])

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-6">
      {/* pulsing gradient orb */}
      <div className="relative mb-10 flex h-20 w-20 items-center justify-center">
        <div
          className="absolute inset-0 animate-ping rounded-full opacity-20"
          style={{ background: "linear-gradient(135deg, var(--primary), var(--accent))", animationDuration: "2.2s" }}
        />
        <div
          className="absolute inset-1 rounded-full opacity-30 blur-xl"
          style={{ background: "linear-gradient(135deg, var(--primary), var(--accent))" }}
        />
        <div
          className="relative flex h-16 w-16 items-center justify-center rounded-2xl text-xl font-black tracking-tighter text-white shadow-[0_0_32px_var(--glow-primary)]"
          style={{ background: "linear-gradient(135deg, var(--primary), var(--accent))" }}
        >
          S
        </div>
      </div>

      <p className="section-label mb-3">Sentiment Intelligence</p>
      <p className="min-h-6 text-sm text-muted-foreground" aria-live="polite">
        {STAGES[stage]}
      </p>

      {/* indeterminate shimmer bar */}
      <div className="mt-8 h-1 w-64 overflow-hidden rounded-full bg-white/[0.06]">
        <div
          className="h-full w-1/3 rounded-full"
          style={{
            background: "linear-gradient(90deg, var(--primary), var(--accent))",
            animation: "loading-slide 1.4s ease-in-out infinite",
          }}
        />
      </div>
      <style jsx>{`
        @keyframes loading-slide {
          0% { transform: translateX(-110%); }
          55% { transform: translateX(220%); }
          100% { transform: translateX(220%); }
        }
      `}</style>

      <p className="mt-10 max-w-xs text-center text-xs text-muted-foreground/60">
        First load reads the full comment corpus — subsequent visits are much faster.
      </p>
    </div>
  )
}
