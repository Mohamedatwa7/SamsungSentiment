"use client"

import Link from "next/link"
import Image from "next/image"
import useSWR from "swr"
import { useEffect, useRef, useState } from "react"
import { ArrowRight, ArrowUpRight, LayoutDashboard, MessageSquareText, Star } from "lucide-react"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

/* Animated count-up that starts when the value arrives */
function Counter({ value, suffix = "" }: { value: number | null; suffix?: string }) {
  const [display, setDisplay] = useState(0)
  const started = useRef(false)

  useEffect(() => {
    if (value == null || started.current) return
    started.current = true
    const duration = 1400
    const t0 = performance.now()
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / duration)
      const eased = 1 - Math.pow(1 - p, 3)
      setDisplay(Math.round(value * eased))
      if (p < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [value])

  return (
    <span className="kpi-value tabular-nums">
      {value == null ? "—" : display.toLocaleString()}
      {value != null && suffix}
    </span>
  )
}

const MODULES = [
  {
    index: "01",
    title: "Social Reviews Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    description:
      "Live sentiment intelligence across Instagram, TikTok, Facebook and X — comment health, product drivers, feature sentiment and critical alerts.",
    tags: ["Sentiment Engine", "4 Platforms", "Daily Auto-Sync"],
  },
  {
    index: "02",
    title: "S.com Reviews",
    href: "/reviews",
    icon: Star,
    description:
      "Samsung.com product review analytics — S26 vs S25 comparisons, rating distributions, theme analysis and year-over-year trends.",
    tags: ["Product Reviews", "Theme Analysis", "YoY Trends"],
  },
  {
    index: "03",
    title: "AI Chatbot",
    href: "/chatbot",
    icon: MessageSquareText,
    description:
      "Ask anything about Samsung Gulf customer sentiment in natural language. Answers grounded in the full comment corpus with citations.",
    tags: ["Natural Language", "Cited Answers", "Gulf Focus"],
  },
]

export default function HomePage() {
  // Warms the edge cache for the dashboard too — by the time a stakeholder
  // clicks through, the data is usually already cached.
  const { data } = useSWR("/api/comments", fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60000,
  })
  const totals = data?.meta

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Hero glow behind the headline */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-[-20%] h-[60vh] w-[90vw] -translate-x-1/2 rounded-full opacity-40 blur-3xl"
        style={{
          background:
            "radial-gradient(ellipse at center, oklch(0.45 0.16 258 / 0.5), oklch(0.4 0.13 300 / 0.25) 50%, transparent 70%)",
        }}
      />

      {/* Header */}
      <header className="relative z-10 mx-auto flex h-20 max-w-6xl items-center justify-between px-6">
        <div className="flex items-center gap-3">
          <Image
            src="/images/samsung-logo.jpg"
            alt="Samsung"
            width={110}
            height={22}
            className="dark:invert"
            style={{ width: "auto", height: "20px" }}
          />
          <span className="section-label">Sentiment AI</span>
        </div>
        <Link
          href="/dashboard"
          className="group flex items-center gap-2 rounded-full border border-white/[0.1] bg-white/[0.04] px-4 py-2 text-sm font-medium text-foreground transition-all hover:border-primary/50 hover:bg-primary/10 hover:shadow-[0_0_24px_var(--glow-primary)]"
        >
          Open Dashboard
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </header>

      <main className="relative z-10 mx-auto max-w-6xl px-6">
        {/* Hero */}
        <section className="flex flex-col items-center pb-16 pt-20 text-center md:pt-28">
          <p className="mb-6 flex items-center gap-2 rounded-full border border-white/[0.1] bg-white/[0.03] px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-positive opacity-60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-positive" />
            </span>
            Samsung Gulf · Live since Jan 2025
          </p>
          <h1 className="display-title max-w-4xl text-5xl leading-[1.05] md:text-7xl">
            Every customer voice,
            <br />
            <span className="text-gradient">measured in real time.</span>
          </h1>
          <p className="mt-7 max-w-xl text-base text-muted-foreground md:text-lg">
            AI-scored sentiment across every comment, review and reply on Samsung Gulf&apos;s
            social channels — synced nightly, analyzed automatically.
          </p>

          {/* Live counters */}
          <div className="mt-14 grid w-full max-w-3xl grid-cols-2 gap-y-10 md:grid-cols-4">
            <div>
              <p className="text-4xl md:text-[2.6rem]"><Counter value={totals ? totals.totalComments : null} /></p>
              <p className="section-label mt-2">Comments Analyzed</p>
            </div>
            <div>
              <p className="text-4xl md:text-[2.6rem]"><Counter value={totals ? totals.totalPosts : null} /></p>
              <p className="section-label mt-2">Posts Tracked</p>
            </div>
            <div>
              <p className="text-4xl md:text-[2.6rem]"><Counter value={4} /></p>
              <p className="section-label mt-2">Platforms</p>
            </div>
            <div>
              <p className="text-4xl md:text-[2.6rem]">
                <Counter value={totals ? Math.round((totals.analyzedComments / Math.max(1, totals.totalComments)) * 100) : null} suffix="%" />
              </p>
              <p className="section-label mt-2">AI Coverage</p>
            </div>
          </div>
        </section>

        {/* Modules */}
        <section className="pb-28">
          <p className="section-label mb-6">Modules</p>
          <div className="flex flex-col gap-4">
            {MODULES.map((m) => (
              <Link key={m.href} href={m.href} className="group">
                <div className="glass-panel relative flex flex-col gap-5 overflow-hidden p-7 transition-transform duration-300 group-hover:-translate-y-0.5 md:flex-row md:items-center md:gap-10 md:p-9">
                  {/* gradient sweep on hover */}
                  <div
                    aria-hidden
                    className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
                    style={{
                      background:
                        "linear-gradient(110deg, transparent 30%, oklch(0.62 0.19 258 / 0.07) 50%, oklch(0.78 0.13 210 / 0.05) 65%, transparent 80%)",
                    }}
                  />
                  <span className="font-mono text-sm text-muted-foreground/60">{m.index}</span>
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.04] text-foreground transition-all duration-300 group-hover:border-primary/40 group-hover:shadow-[0_0_20px_var(--glow-primary)]">
                    <m.icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="display-title text-xl md:text-2xl">{m.title}</h2>
                    <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground md:text-[15px]">
                      {m.description}
                    </p>
                  </div>
                  <div className="flex items-center gap-4 md:flex-col md:items-end md:gap-3">
                    <div className="flex flex-wrap gap-1.5">
                      {m.tags.map((t) => (
                        <span
                          key={t}
                          className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                    <ArrowUpRight className="h-5 w-5 shrink-0 text-muted-foreground transition-all duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-accent" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/[0.06] py-8 text-center text-xs text-muted-foreground">
        Data sourced from @samsunggulf channels across UAE, Kuwait, Qatar, Bahrain and Oman ·
        synced nightly via Apify · sentiment scored by LLM
      </footer>
    </div>
  )
}
