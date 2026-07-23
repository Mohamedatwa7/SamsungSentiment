"use client"

import { useEffect, useMemo, useState } from "react"
import useSWR from "swr"
import {
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts"
import {
  Award,
  Flame,
  Heart,
  Languages,
  Loader2,
  MessageSquare,
  Minus,
  Rocket,
  ShoppingCart,
  Swords,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { type DateRange } from "@/components/dashboard/date-filter"
import { useDashboardData, type Comment, type CommentPlatform } from "@/contexts/dashboard-data-context"
import type { UnpackedPayload, UnpackedVideo } from "@/lib/unpacked-data"

const swrFetcher = (url: string) => fetch(url).then((r) => r.json())

// Influencer campaign comments (Galaxy Unpacked tracker + FF8 roster) mapped
// into the dashboard Comment shape so the same device/topic analysis runs on
// them. Deduped by raw comment id — the same comment can be ingested by both
// influencer pipelines under different prefixes.
function mapInfluencerComments(payloads: (UnpackedPayload | { videos?: UnpackedVideo[] } | undefined)[]): Comment[] {
  const seen = new Set<string>()
  const out: Comment[] = []
  for (const payload of payloads) {
    for (const v of payload?.videos || []) {
      for (const c of v.comments) {
        const rawId = c.id.replace(/^(unpacked_|roster_)/, "")
        if (seen.has(rawId)) continue
        seen.add(rawId)
        out.push({
          id: c.id,
          platform: v.platform,
          text: c.text,
          username: c.username,
          postCaption: v.caption,
          postUrl: v.url,
          sentiment: c.sentiment,
          sentimentFlags: [] as any,
          product: "General",
          productModel: "General",
          // Marker: influencer campaign videos are FF8 content by definition,
          // so their comments qualify regardless of the launch date gate.
          productCategory: "InfluencerCampaign",
          department: "Brand",
          features: [],
          likes: c.likes,
          createdAt: c.publishedAt || "",
          source: "synced",
        })
      }
    }
  }
  return out
}

type SourceFilter = "combined" | "samsung" | "influencers"

// Day options since launch (Gulf days), for the section's date filter.
function launchDays(): { key: string; label: string }[] {
  const out: { key: string; label: string }[] = []
  const dayMs = 86400000
  const elapsed = Math.max(1, Math.floor((Date.now() - LAUNCH_DATE.getTime()) / dayMs) + 1)
  for (let i = 0; i < elapsed; i++) {
    const d = new Date(LAUNCH_DATE.getTime() + i * dayMs)
    out.push({
      key: String(d.getTime()),
      label: d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "Asia/Dubai" }),
    })
  }
  return out
}

// Galaxy Unpacked — July 22nd, 2026. Devices launched: Z Fold 8, Z Fold 8
// Ultra, Z Flip 8.
const LAUNCH_DATE = new Date("2026-07-22T00:00:00+04:00")

interface DeviceDef {
  key: string
  name: string
  short: string
  // order matters: "Fold 8 Ultra" must match before "Fold 8"
  pattern: RegExp
  genericPattern: RegExp
}

const DEVICES: DeviceDef[] = [
  {
    key: "fold8ultra",
    name: "Galaxy Z Fold 8 Ultra",
    short: "Fold 8 Ultra",
    pattern: /(?:z\s*)?fold\s*8\s*ultra|fold8ultra|فولد\s*8\s*(?:الترا|ألترا)/i,
    genericPattern: /fold\s*ultra|فولد\s*(?:الترا|ألترا)/i,
  },
  {
    key: "fold8",
    name: "Galaxy Z Fold 8",
    short: "Fold 8",
    pattern: /(?:z\s*)?fold\s*8|zfold8|فولد\s*8/i,
    genericPattern: /\bz?\s*fold\b|فولد/i,
  },
  {
    key: "flip8",
    name: "Galaxy Z Flip 8",
    short: "Flip 8",
    pattern: /(?:z\s*)?flip\s*8|zflip8|فليب\s*8|فلب\s*8/i,
    genericPattern: /\bz?\s*flip\b|فليب/i,
  },
]

// Launch conversation that doesn't name a specific device — reactions to
// teaser/launch content ("new shape", Unpacked posts). Counted in the overall
// analysis and shown as its own share-of-voice bucket.
const GENERAL_BUCKET: DeviceDef = {
  key: "general",
  name: "Launch — No Device Named",
  short: "General",
  pattern: /$^/,
  genericPattern: /$^/,
}

const CAMPAIGN_GENERIC = /galaxy\s*unpacked|galaxyunpacked|new\s*shape|newshape|\bff8\b/i

// Launch-vs-launch comparison: day-0 aligned windows (Gulf time). Last
// year's Unpacked launched the Fold 7 / Flip 7 on July 9th, 2025; FF8 on
// July 22nd, 2026 — so Jul 9 '25 ↔ Jul 22 '26, Jul 10 ↔ Jul 23, and each
// new FF8 day extends BOTH windows by one day (F7 data pulled through
// Jul 20, 2025 = 12 comparable days).
const F7_LAUNCH = new Date("2025-07-09T00:00:00+04:00")
const MAX_COMPARE_DAYS = 12

function launchCompareWindows() {
  const dayMs = 86400000
  const elapsed = Math.min(
    MAX_COMPARE_DAYS,
    Math.max(1, Math.floor((Date.now() - LAUNCH_DATE.getTime()) / dayMs) + 1),
  )
  return {
    days: elapsed,
    f7: { start: F7_LAUNCH, end: new Date(F7_LAUNCH.getTime() + elapsed * dayMs) },
    f8: { start: LAUNCH_DATE, end: new Date(LAUNCH_DATE.getTime() + elapsed * dayMs) },
  }
}

function windowLabel(start: Date, days: number): string {
  const end = new Date(start.getTime() + (days - 1) * 86400000)
  const fmt = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "Asia/Dubai" })
  return days === 1 ? `${fmt(start)}, ${start.getFullYear()}` : `${fmt(start)} – ${fmt(end)}, ${start.getFullYear()}`
}
const FOLDABLE_MARKERS = /fold|flip|فولد|فليب|فلب|unpacked|انباكد|أنباكد/i

function foldableLaunchSplit(
  comments: Comment[],
  window: { start: Date; end: Date },
): { positive: number; neutral: number; negative: number; total: number } {
  const out = { positive: 0, neutral: 0, negative: 0, total: 0 }
  for (const c of comments) {
    const t = new Date(c.createdAt).getTime()
    if (isNaN(t) || t < window.start.getTime() || t >= window.end.getTime()) continue
    if (!FOLDABLE_MARKERS.test(c.text || "") && !FOLDABLE_MARKERS.test(c.postCaption || "")) continue
    out.total++
    out[c.sentiment]++
  }
  return out
}

const PIE_COLORS: Record<string, string> = {
  Positive: "var(--positive)",
  Neutral: "oklch(0.6 0.015 260)",
  Negative: "var(--negative)",
}

function LaunchPie({
  title,
  subtitle,
  split,
}: {
  title: string
  subtitle: string
  split: { positive: number; neutral: number; negative: number; total: number }
}) {
  const data = [
    { name: "Positive", value: split.positive },
    { name: "Neutral", value: split.neutral },
    { name: "Negative", value: split.negative },
  ].filter((d) => d.value > 0)

  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
      <p className="text-sm font-semibold">{title}</p>
      <p className="text-xs text-muted-foreground">{subtitle}</p>
      {split.total === 0 ? (
        <p className="py-12 text-center text-xs text-muted-foreground">
          No foldable-related comments captured in this window.
        </p>
      ) : (
        <>
          <div className="h-[220px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={48}
                  outerRadius={78}
                  paddingAngle={2}
                  strokeWidth={0}
                >
                  {data.map((d) => (
                    <Cell key={d.name} fill={PIE_COLORS[d.name]} />
                  ))}
                </Pie>
                <RechartsTooltip
                  formatter={(value: number, name: string) => [
                    `${value.toLocaleString()} (${Math.round((value / split.total) * 100)}%)`,
                    name,
                  ]}
                  contentStyle={{
                    background: "rgba(10,12,19,0.97)",
                    border: "1px solid rgba(255,255,255,0.15)",
                    borderRadius: "0.75rem",
                    fontSize: "12px",
                  }}
                  // Recharts colors tooltip text with the slice fill by
                  // default — unreadable on the dark panel. Force white.
                  itemStyle={{ color: "rgba(255,255,255,0.95)" }}
                  labelStyle={{ color: "rgba(255,255,255,0.7)" }}
                />
                <Legend
                  formatter={(value: string) => <span style={{ fontSize: 11 }}>{value}</span>}
                  iconSize={8}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-between text-[11px]">
            <span className="text-positive">{pct(split.positive, split.total)}% positive</span>
            <span className="text-muted-foreground">{split.total.toLocaleString()} comments</span>
            <span className="text-negative">{pct(split.negative, split.total)}% negative</span>
          </div>
        </>
      )}
    </div>
  )
}

// Business topics tracked across launch conversation. LLM flags supplement
// the keyword patterns where available.
const TOPICS: { key: string; label: string; pattern: RegExp; flags?: string[] }[] = [
  { key: "price", label: "Price & Value", pattern: /price|expensive|cheap|cost|discount|offer|deal|غالي|رخيص|سعر|بكم|عرض|خصم|aed|sar|qar|kwd|درهم|ريال|دينار/i, flags: ["price_complaint"] },
  { key: "design", label: "Design & Thinness", pattern: /design|thin|slim|sleek|light|beautiful|gorgeous|شكل|تصميم|نحيف|خفيف|أنحف|انحف|جميل/i },
  { key: "crease", label: "Crease & Hinge", pattern: /crease|hinge|fold\s*mark|مفصل|ثنية|طية|كسرة/i },
  { key: "durability", label: "Durability", pattern: /durab|fragile|break|crack|scratch|water|dust|ip4|ip5|ip6|يتكسر|ينكسر|متين|قوي|مقاوم/i },
  { key: "battery", label: "Battery & Charging", pattern: /battery|charg|mah|بطارية|بطاريه|شحن|شاحن/i, flags: ["battery_issue"] },
  { key: "camera", label: "Camera", pattern: /camera|zoom|photo|selfie|video quality|200\s*mp|كاميرا|كاميرة|تصوير|زوم/i, flags: ["camera_praise"] },
  { key: "display", label: "Display & Cover Screen", pattern: /screen|display|amoled|bezel|cover\s*screen|refresh|شاشة|شاشه/i, flags: ["green_line_defect"] },
  { key: "ai", label: "Galaxy AI", pattern: /galaxy\s*ai|\bai\b|gemini|ذكاء|الذكاء/i },
  { key: "performance", label: "Performance & Chip", pattern: /snapdragon|elite|chip|processor|performance|ram|lag|smooth|fast|أداء|سريع|معالج/i },
  { key: "spen", label: "S Pen", pattern: /s\s*pen|spen|stylus|قلم/i },
  { key: "competition", label: "vs iPhone & Rivals", pattern: /iphone|apple|huawei|pixel|xiaomi|oppo|ايفون|آيفون|أيفون|هواوي|شاومي/i, flags: ["comparison_iphone", "comparison_huawei"] },
  { key: "buying", label: "Purchase Intent & Pre-orders", pattern: /pre.?order|buy|bought|order|upgrade|take my money|حجزت|طلبت|اشتري|أشتري|بشتري|راح\s*اخذ|هاخد/i, flags: ["purchase_intent"] },
  { key: "availability", label: "Availability & Release", pattern: /when|release|available|launch date|arrive|متى|امتى|وين|متوفر|ينزل|نزل/i },
]

interface DeviceStats {
  def: DeviceDef
  total: number
  positive: number
  negative: number
  neutral: number
  topTopic: string | null
}

interface TopicStats {
  key: string
  label: string
  total: number
  positive: number
  negative: number
  neutral: number
}

function pct(part: number, total: number): number {
  return total > 0 ? Math.round((part / total) * 100) : 0
}

function SplitBar({ positive, neutral, negative }: { positive: number; neutral: number; negative: number }) {
  const total = positive + neutral + negative
  if (total === 0) return <div className="h-1.5 w-full rounded-full bg-white/[0.06]" />
  return (
    <div className="flex h-1.5 w-full gap-px overflow-hidden rounded-full">
      {positive > 0 && <div className="bg-positive" style={{ width: `${(positive / total) * 100}%` }} />}
      {neutral > 0 && <div className="bg-white/[0.15]" style={{ width: `${(neutral / total) * 100}%` }} />}
      {negative > 0 && <div className="bg-negative" style={{ width: `${(negative / total) * 100}%` }} />}
    </div>
  )
}

function SentimentIcon({ sentiment }: { sentiment: string }) {
  if (sentiment === "positive") return <ThumbsUp className="h-3 w-3 shrink-0 text-positive" />
  if (sentiment === "negative") return <ThumbsDown className="h-3 w-3 shrink-0 text-negative" />
  return <Minus className="h-3 w-3 shrink-0 text-muted-foreground" />
}

interface DrilldownState {
  title: string
  subtitle: string
  comments: Comment[]
}

interface F8LaunchAnalysisProps {
  platformFilter?: CommentPlatform[]
  dateRange?: DateRange
}

export function F8LaunchAnalysis({ platformFilter }: F8LaunchAnalysisProps) {
  const { getFilteredComments } = useDashboardData()
  const [activeDevice, setActiveDevice] = useState<string>("all")
  const [source, setSource] = useState<SourceFilter>("combined")
  // Selected Gulf-day start timestamps (ms). Empty set = all days. Multiple
  // days can be active at once — every stat narrows to their union.
  const [selectedDays, setSelectedDays] = useState<Set<string>>(new Set())
  const toggleDay = (key: string) =>
    setSelectedDays((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  const [drilldown, setDrilldown] = useState<DrilldownState | null>(null)

  // Translation (Arabic/other → English) with a per-comment cache so nothing
  // is translated twice. Applies to the VoC lists and the drill-down dialog.
  const [showTranslations, setShowTranslations] = useState(false)
  const [translating, setTranslating] = useState(false)
  const [translations, setTranslations] = useState<Map<string, string>>(new Map())

  const ensureTranslations = async (comments: Comment[]) => {
    const pending = comments.filter((c) => !translations.has(c.id) && (c.text || "").trim().length > 0)
    if (pending.length === 0) return
    setTranslating(true)
    const results = new Map(translations)
    const CONCURRENCY = 8
    for (let i = 0; i < pending.length; i += CONCURRENCY) {
      const batch = pending.slice(i, i + CONCURRENCY)
      await Promise.all(
        batch.map(async (c) => {
          try {
            const res = await fetch("/api/translate", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ text: c.text }),
            })
            const out = await res.json()
            if (out?.translatedText) results.set(c.id, out.translatedText)
          } catch {
            // leave the original text; retried next time the toggle is used
          }
        }),
      )
      // Progressive: comments appear translated as batches complete.
      setTranslations(new Map(results))
    }
    setTranslating(false)
  }

  const displayText = (c: Comment) =>
    showTranslations ? translations.get(c.id) || c.text || "" : c.text || ""

  // Influencer campaign data (Galaxy Unpacked tracker + FF8 roster)
  const { data: unpackedData } = useSWR<UnpackedPayload>("/api/unpacked", swrFetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60000,
  })
  const { data: rosterData } = useSWR<{ videos?: UnpackedVideo[] }>("/api/roster", swrFetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60000,
  })
  const influencerComments = useMemo(
    () => mapInfluencerComments([unpackedData, rosterData]),
    [unpackedData, rosterData],
  )

  const analysis = useMemo(() => {
    // Launch conversation corpus: every comment that names a device (any
    // date — leaks/teaser talk counts), plus every comment posted since
    // launch day on a post whose caption names a device. The dashboard's
    // date filter is deliberately NOT applied — this section tracks the
    // launch, not the filtered window.
    const brandAll = getFilteredComments(platformFilter, undefined, undefined)
    const brand = source === "influencers" ? [] : brandAll
    // YouTube always passes the platform filter — the dashboard's filter UI
    // only offers the four social platforms, so it can never select YouTube.
    const influencers =
      source === "samsung"
        ? []
        : platformFilter && platformFilter.length > 0
          ? influencerComments.filter(
              (c) => c.platform === "youtube" || platformFilter.includes(c.platform),
            )
          : influencerComments
    const all = [...brand, ...influencers]

    const matchDevice = (text: string, sinceLaunch: boolean): DeviceDef | null => {
      for (const d of DEVICES) {
        if (d.pattern.test(text)) return d
      }
      // Generic "fold"/"flip" talk only counts once the devices are out.
      if (sinceLaunch) {
        for (const d of DEVICES) {
          if (d.key !== "fold8ultra" && d.genericPattern.test(text)) return d
        }
      }
      return null
    }

    const corpus: { comment: Comment; device: DeviceDef }[] = []
    for (const c of all) {
      const created = new Date(c.createdAt)
      const sinceLaunch = !isNaN(created.getTime()) && created >= LAUNCH_DATE
      // Influencer campaign videos are FF8 content by definition (teasers
      // included), so their comments qualify regardless of the launch gate.
      const isCampaign = c.productCategory === "InfluencerCampaign"
      const own = matchDevice(c.text || "", sinceLaunch || isCampaign)
      if (own) {
        corpus.push({ comment: c, device: own })
        continue
      }
      // No device in the comment itself — attribute via the parent post's
      // caption; comments on campaign/launch posts that name no device land
      // in the General bucket instead of being dropped.
      if ((sinceLaunch || isCampaign) && c.postCaption) {
        const viaPost = matchDevice(c.postCaption, true)
        if (viaPost) {
          corpus.push({ comment: c, device: viaPost })
        } else if (isCampaign || CAMPAIGN_GENERIC.test(c.postCaption)) {
          corpus.push({ comment: c, device: GENERAL_BUCKET })
        }
      }
    }

    // Overall + per-device sentiment
    const overall = { total: 0, positive: 0, negative: 0, neutral: 0 }
    const byDevice = new Map<string, DeviceStats>(
      [...DEVICES, GENERAL_BUCKET].map((d) => [
        d.key,
        { def: d, total: 0, positive: 0, negative: 0, neutral: 0, topTopic: null },
      ]),
    )
    const deviceTopicCounts = new Map<string, Map<string, number>>()

    // Topics + the comments behind every number (for drill-down dialogs)
    const topics = new Map<string, TopicStats>(
      TOPICS.map((t) => [t.key, { key: t.key, label: t.label, total: 0, positive: 0, negative: 0, neutral: 0 }]),
    )
    const topicComments = new Map<string, Comment[]>(TOPICS.map((t) => [t.key, []]))

    const selectionComments: Comment[] = []
    const purchaseComments: Comment[] = []
    const competitorComments: Comment[] = []

    // Daily sentiment trend from launch day (Jul 22) onward — each new day
    // appends automatically as comments arrive.
    const trendStart = LAUNCH_DATE
    const daily = new Map<string, { day: string; total: number; positive: number; negative: number }>()

    const buyingTopic = TOPICS.find((t) => t.key === "buying")!
    const competitionTopic = TOPICS.find((t) => t.key === "competition")!

    const dayWindows = [...selectedDays].map((key) => {
      const start = Number(key)
      return { start, end: start + 86400000 }
    })

    for (const { comment: c, device } of corpus) {
      // Date filter narrows everything — device cards included. Multiple
      // selected days act as a union.
      if (dayWindows.length > 0) {
        const t = new Date(c.createdAt).getTime()
        if (isNaN(t) || !dayWindows.some((w) => t >= w.start && t < w.end)) continue
      }
      const inSelection = activeDevice === "all" || device.key === activeDevice

      const dev = byDevice.get(device.key)!
      dev.total++
      dev[c.sentiment]++

      if (!inSelection) continue

      selectionComments.push(c)
      overall.total++
      overall[c.sentiment]++

      const text = c.text || ""
      const flags = (c.sentimentFlags as unknown as string[]) || []
      for (const t of TOPICS) {
        const hit = t.pattern.test(text) || (t.flags?.some((f) => flags.includes(f)) ?? false)
        if (!hit) continue
        const stats = topics.get(t.key)!
        stats.total++
        stats[c.sentiment]++
        topicComments.get(t.key)!.push(c)
        let m = deviceTopicCounts.get(device.key)
        if (!m) deviceTopicCounts.set(device.key, (m = new Map()))
        m.set(t.key, (m.get(t.key) || 0) + 1)
      }

      if (flags.includes("purchase_intent") || buyingTopic.pattern.test(text)) purchaseComments.push(c)
      if (competitionTopic.pattern.test(text) || flags.some((f) => f.startsWith("comparison")))
        competitorComments.push(c)

      const created = new Date(c.createdAt)
      if (!isNaN(created.getTime()) && created >= trendStart) {
        const key = created.toISOString().slice(0, 10)
        let bucket = daily.get(key)
        if (!bucket) {
          daily.set(
            key,
            (bucket = {
              day: created.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
              total: 0,
              positive: 0,
              negative: 0,
            }),
          )
        }
        bucket.total++
        if (c.sentiment === "positive") bucket.positive++
        if (c.sentiment === "negative") bucket.negative++
      }
    }

    // Per-device top topic
    for (const [deviceKey, counts] of deviceTopicCounts) {
      const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]
      if (top) byDevice.get(deviceKey)!.topTopic = TOPICS.find((t) => t.key === top[0])?.label || null
    }

    const topicList = [...topics.values()].filter((t) => t.total > 0)
    const discussed = [...topicList].sort((a, b) => b.total - a.total)
    // Ranked by VOLUME of positive/negative comments (not percentage), so the
    // heavily-discussed topics rank consistently with the discussed list.
    const mostPraised = [...topicList]
      .filter((t) => t.positive > 0)
      .sort((a, b) => b.positive - a.positive || pct(b.positive, b.total) - pct(a.positive, a.total))
      .slice(0, 3)
    const leastPraised = [...topicList]
      .filter((t) => t.negative > 0)
      .sort((a, b) => b.negative - a.negative || pct(b.negative, b.total) - pct(a.negative, a.total))
      .slice(0, 3)
    // Heavily-discussed but sentiment-flat topics (questions, availability
    // asks) — the neutral side of the conversation.
    const mostNeutral = [...topicList]
      .filter((t) => t.neutral > 0)
      .sort((a, b) => b.neutral - a.neutral || pct(b.neutral, b.total) - pct(a.neutral, a.total))
      .slice(0, 3)

    const trend = [...daily.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([, v]) => ({ ...v, positivePercent: pct(v.positive, v.total) }))

    const topPositive = selectionComments
      .filter((c) => c.sentiment === "positive" && (c.text || "").trim().length > 4)
      .sort((a, b) => b.likes - a.likes)
      .slice(0, 3)
    const topNegative = selectionComments
      .filter((c) => c.sentiment === "negative" && (c.text || "").trim().length > 4)
      .sort((a, b) => b.likes - a.likes)
      .slice(0, 3)

    // Launch-vs-launch pies. F7 always reads the brand corpus — influencer
    // tracking didn't exist in July 2025. F8 follows the current selection.
    const compare = launchCompareWindows()
    const f7Split = foldableLaunchSplit(brandAll, compare.f7)
    const f8Split = foldableLaunchSplit(selectionComments, compare.f8)

    return {
      overall,
      devices: [...byDevice.values()],
      corpusTotal: corpus.length,
      discussed,
      mostPraised,
      leastPraised,
      mostNeutral,
      f7Split,
      f8Split,
      compareDays: compare.days,
      topicComments,
      selectionComments,
      purchaseComments,
      competitorComments,
      trend,
      topPositive,
      topNegative,
    }
  }, [getFilteredComments, platformFilter, activeDevice, source, selectedDays, influencerComments])

  const { overall } = analysis
  const netSentiment = pct(overall.positive, overall.total) - pct(overall.negative, overall.total)

  // Translate whatever is currently visible when the toggle is on.
  useEffect(() => {
    if (!showTranslations) return
    const visible = [...analysis.topPositive, ...analysis.topNegative, ...(drilldown?.comments || [])]
    void ensureTranslations(visible)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showTranslations, drilldown, analysis.topPositive, analysis.topNegative])

  const byLikes = (list: Comment[]) => [...list].sort((a, b) => b.likes - a.likes)

  const openDrilldown = (title: string, comments: Comment[], subtitle?: string) =>
    setDrilldown({
      title,
      subtitle: subtitle ?? `${comments.length.toLocaleString()} comments`,
      comments: byLikes(comments).slice(0, 300),
    })

  const kpiTileClass =
    "rounded-lg px-4 py-2 text-left transition-colors hover:bg-white/[0.04] cursor-pointer first:pl-0 first:rounded-l-none"

  return (
    <Card className="glass-panel animate-in fade-in duration-500">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Rocket className="h-4 w-4 text-muted-foreground" />
              Galaxy F8 Launch Analysis
            </CardTitle>
            <CardDescription>
              Z Fold 8 · Z Fold 8 Ultra · Z Flip 8 — Unpacked, July 22nd · click any number to see its comments
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {[{ key: "all", short: "All Devices" }, ...DEVICES, GENERAL_BUCKET].map((d) => (
              <button
                key={d.key}
                type="button"
                onClick={() => setActiveDevice(d.key)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  activeDevice === d.key
                    ? "border-primary/50 bg-primary/15 text-foreground"
                    : "border-white/[0.08] bg-white/[0.03] text-muted-foreground hover:text-foreground",
                )}
              >
                {d.short}
              </button>
            ))}
          </div>
        </div>
        {/* Audience source — Samsung's own channels vs influencer campaign videos */}
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="section-label order-last ml-2">Date</span>
          <button
            type="button"
            onClick={() => setSelectedDays(new Set())}
            className={cn(
              "order-last rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              selectedDays.size === 0
                ? "border-primary/50 bg-primary/15 text-foreground"
                : "border-white/[0.08] bg-white/[0.03] text-muted-foreground hover:text-foreground",
            )}
          >
            All days
          </button>
          {launchDays().map((d) => (
            <button
              key={d.key}
              type="button"
              onClick={() => toggleDay(d.key)}
              className={cn(
                "order-last rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                selectedDays.has(d.key)
                  ? "border-primary/50 bg-primary/15 text-foreground"
                  : "border-white/[0.08] bg-white/[0.03] text-muted-foreground hover:text-foreground",
              )}
            >
              {d.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setShowTranslations((v) => !v)}
            className={cn(
              "order-last ml-auto flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              showTranslations
                ? "border-primary/50 bg-primary/15 text-foreground"
                : "border-white/[0.08] bg-white/[0.03] text-muted-foreground hover:text-foreground",
            )}
          >
            {translating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Languages className="h-3 w-3" />}
            {showTranslations ? "Showing English" : "Translate to English"}
          </button>
          <span className="section-label mr-1">Source</span>
          {(
            [
              { key: "combined", label: "Samsung Socials & Influencers" },
              { key: "samsung", label: "Samsung Socials Only" },
              { key: "influencers", label: "Influencers Only" },
            ] as { key: SourceFilter; label: string }[]
          ).map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setSource(s.key)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                source === s.key
                  ? "border-accent/50 bg-accent/15 text-foreground"
                  : "border-white/[0.08] bg-white/[0.03] text-muted-foreground hover:text-foreground",
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {overall.total === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No launch-related comments found yet for this selection.
          </p>
        ) : (
          <>
            {/* Headline KPIs — every tile opens the comments behind it */}
            <div className="stat-rail divide-none grid grid-cols-2 gap-y-6 lg:grid-cols-3 xl:grid-cols-6">
              <button
                type="button"
                className={kpiTileClass}
                onClick={() => openDrilldown("Launch Comments", analysis.selectionComments)}
              >
                <p className="section-label flex items-center gap-1.5">
                  <MessageSquare className="h-3.5 w-3.5" /> Launch Comments
                </p>
                <p className="kpi-value mt-1 text-3xl">{overall.total.toLocaleString()}</p>
              </button>
              <button
                type="button"
                className={kpiTileClass}
                onClick={() =>
                  openDrilldown(
                    "Positive Launch Comments",
                    analysis.selectionComments.filter((c) => c.sentiment === "positive"),
                  )
                }
              >
                <p className="section-label flex items-center gap-1.5">
                  <ThumbsUp className="h-3.5 w-3.5" /> Positive
                </p>
                <p className="kpi-value mt-1 text-3xl text-positive">{pct(overall.positive, overall.total)}%</p>
              </button>
              <button
                type="button"
                className={kpiTileClass}
                onClick={() =>
                  openDrilldown(
                    "Negative Launch Comments",
                    analysis.selectionComments.filter((c) => c.sentiment === "negative"),
                  )
                }
              >
                <p className="section-label flex items-center gap-1.5">
                  <ThumbsDown className="h-3.5 w-3.5" /> Negative
                </p>
                <p className="kpi-value mt-1 text-3xl text-negative">{pct(overall.negative, overall.total)}%</p>
              </button>
              <button
                type="button"
                className={kpiTileClass}
                onClick={() =>
                  openDrilldown(
                    "Net Sentiment — Positive & Negative Comments",
                    analysis.selectionComments.filter((c) => c.sentiment !== "neutral"),
                    `${overall.positive.toLocaleString()} positive vs ${overall.negative.toLocaleString()} negative`,
                  )
                }
              >
                <p className="section-label flex items-center gap-1.5">
                  <Heart className="h-3.5 w-3.5" /> Net Sentiment
                </p>
                <p className={cn("kpi-value mt-1 text-3xl", netSentiment >= 0 ? "text-positive" : "text-negative")}>
                  {netSentiment > 0 ? "+" : ""}
                  {netSentiment}%
                </p>
              </button>
              <button
                type="button"
                className={kpiTileClass}
                onClick={() => openDrilldown("Purchase Intent Comments", analysis.purchaseComments)}
              >
                <p className="section-label flex items-center gap-1.5">
                  <ShoppingCart className="h-3.5 w-3.5" /> Purchase Intent
                </p>
                <p className="kpi-value mt-1 text-3xl">{analysis.purchaseComments.length.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">
                  {pct(analysis.purchaseComments.length, overall.total)}% of launch talk
                </p>
              </button>
              <button
                type="button"
                className={kpiTileClass}
                onClick={() => openDrilldown("Competitor Comparison Comments", analysis.competitorComments)}
              >
                <p className="section-label flex items-center gap-1.5">
                  <Swords className="h-3.5 w-3.5" /> Competitor Pressure
                </p>
                <p className="kpi-value mt-1 text-3xl">{analysis.competitorComments.length.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">iPhone/rival comparisons</p>
              </button>
            </div>

            {/* Per-device share of voice + sentiment */}
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {analysis.devices.map((d) => (
                <div
                  key={d.def.key}
                  className={cn(
                    "rounded-xl border border-white/[0.08] bg-white/[0.02] p-4",
                    activeDevice === d.def.key && "border-primary/40 bg-primary/5",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold">{d.def.name}</p>
                    <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {pct(d.total, analysis.corpusTotal)}% SoV
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {d.total.toLocaleString()} comments
                    {d.topTopic ? ` · top topic: ${d.topTopic}` : ""}
                  </p>
                  <div className="mt-3 space-y-1.5">
                    <SplitBar positive={d.positive} neutral={d.neutral} negative={d.negative} />
                    <div className="flex justify-between text-[11px]">
                      <span className="text-positive">{pct(d.positive, d.total)}% positive</span>
                      <span className="text-muted-foreground">{pct(d.neutral, d.total)}% neutral</span>
                      <span className="text-negative">{pct(d.negative, d.total)}% negative</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Most discussed topics — click a row for its comments, hover the
                bar for the exact split */}
            <div>
              <p className="section-label mb-3 flex items-center gap-1.5">
                <Flame className="h-3.5 w-3.5" /> Most Discussed Topics
              </p>
              <TooltipProvider delayDuration={100}>
                <div className="space-y-1">
                  {analysis.discussed.slice(0, 8).map((t) => (
                    <Tooltip key={t.key}>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          onClick={() =>
                            openDrilldown(
                              t.label,
                              analysis.topicComments.get(t.key) || [],
                              `${t.positive} positive · ${t.neutral} neutral · ${t.negative} negative`,
                            )
                          }
                          className="flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-white/[0.04]"
                        >
                          <span className="w-44 shrink-0 truncate text-xs text-muted-foreground">{t.label}</span>
                          <div className="flex-1">
                            <SplitBar positive={t.positive} neutral={t.neutral} negative={t.negative} />
                          </div>
                          <span className="w-14 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                            {t.total.toLocaleString()}
                          </span>
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="text-xs">
                        <span className="text-positive">{t.positive} positive</span>
                        {" · "}
                        <span>{t.neutral} neutral</span>
                        {" · "}
                        <span className="text-negative">{t.negative} negative</span>
                      </TooltipContent>
                    </Tooltip>
                  ))}
                </div>
              </TooltipProvider>
            </div>

            {/* Most praised / most neutral / least praised — ranked by
                comment volume so they align with the discussed list; click
                for the comments behind each number */}
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-xl border border-positive/20 bg-positive/[0.04] p-4">
                <p className="section-label mb-3 flex items-center gap-1.5 text-positive">
                  <Award className="h-3.5 w-3.5" /> Most Praised
                </p>
                <div className="space-y-1">
                  {analysis.mostPraised.map((t) => (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() =>
                        openDrilldown(
                          `${t.label} — Positive Comments`,
                          (analysis.topicComments.get(t.key) || []).filter((c) => c.sentiment === "positive"),
                        )
                      }
                      className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors hover:bg-positive/10"
                    >
                      <span>{t.label}</span>
                      <span className="text-xs font-semibold text-positive">
                        {t.positive} positive · {pct(t.positive, t.total)}% of {t.total}
                      </span>
                    </button>
                  ))}
                  {analysis.mostPraised.length === 0 && (
                    <p className="text-xs text-muted-foreground">No positive topic mentions yet.</p>
                  )}
                </div>
              </div>
              <div className="rounded-xl border border-white/[0.1] bg-white/[0.02] p-4">
                <p className="section-label mb-3 flex items-center gap-1.5">
                  <Minus className="h-3.5 w-3.5" /> Most Neutral
                </p>
                <div className="space-y-1">
                  {analysis.mostNeutral.map((t) => (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() =>
                        openDrilldown(
                          `${t.label} — Neutral Comments`,
                          (analysis.topicComments.get(t.key) || []).filter((c) => c.sentiment === "neutral"),
                        )
                      }
                      className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors hover:bg-white/[0.06]"
                    >
                      <span>{t.label}</span>
                      <span className="text-xs font-semibold text-muted-foreground">
                        {t.neutral} neutral · {pct(t.neutral, t.total)}% of {t.total}
                      </span>
                    </button>
                  ))}
                  {analysis.mostNeutral.length === 0 && (
                    <p className="text-xs text-muted-foreground">No neutral topic mentions yet.</p>
                  )}
                </div>
              </div>
              <div className="rounded-xl border border-negative/20 bg-negative/[0.04] p-4">
                <p className="section-label mb-3 flex items-center gap-1.5 text-negative">
                  <ThumbsDown className="h-3.5 w-3.5" /> Least Praised
                </p>
                <div className="space-y-1">
                  {analysis.leastPraised.map((t) => (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() =>
                        openDrilldown(
                          `${t.label} — Negative Comments`,
                          (analysis.topicComments.get(t.key) || []).filter((c) => c.sentiment === "negative"),
                        )
                      }
                      className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors hover:bg-negative/10"
                    >
                      <span>{t.label}</span>
                      <span className="text-xs font-semibold text-negative">
                        {t.negative} negative · {pct(t.negative, t.total)}% of {t.total}
                      </span>
                    </button>
                  ))}
                  {analysis.leastPraised.length === 0 && (
                    <p className="text-xs text-muted-foreground">No negative topic mentions yet.</p>
                  )}
                </div>
              </div>
            </div>

            {/* Daily sentiment trend since launch */}
            {analysis.trend.length > 1 && (
              <div>
                <p className="section-label mb-3">Launch Sentiment Trend (daily positive % · from July 22)</p>
                <div className="h-[200px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={analysis.trend} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                      <XAxis dataKey="day" stroke="rgba(255,255,255,0.35)" fontSize={11} tickLine={false} axisLine={false} />
                      <YAxis
                        stroke="rgba(255,255,255,0.35)"
                        fontSize={11}
                        tickLine={false}
                        axisLine={false}
                        width={40}
                        domain={[0, 100]}
                        tickFormatter={(v: number) => `${v}%`}
                      />
                      <RechartsTooltip
                        formatter={(value: number, name: string) =>
                          name === "positivePercent" ? [`${value}%`, "Positive"] : [value, "Comments"]
                        }
                        contentStyle={{
                          background: "rgba(10,12,19,0.95)",
                          border: "1px solid rgba(255,255,255,0.1)",
                          borderRadius: "0.75rem",
                          fontSize: "12px",
                        }}
                        labelStyle={{ color: "rgba(255,255,255,0.6)" }}
                      />
                      <Line
                        type="monotone"
                        dataKey="positivePercent"
                        stroke="var(--positive)"
                        strokeWidth={2}
                        dot={{ r: 2.5, fill: "var(--positive)" }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Launch vs launch — day-0 aligned F7 (2025) vs FF8 (2026) */}
            <div>
              <p className="section-label mb-3">
                Launch vs Launch — Sentiment Split (day 0–{analysis.compareDays - 1} aligned)
              </p>
              <div className="grid gap-3 md:grid-cols-2">
                <LaunchPie
                  title="Fold 7 / Flip 7 Launch"
                  subtitle={`${windowLabel(F7_LAUNCH, analysis.compareDays)} · Samsung socials`}
                  split={analysis.f7Split}
                />
                <LaunchPie
                  title="Fold 8 / Fold 8 Ultra / Flip 8 Launch"
                  subtitle={`${windowLabel(LAUNCH_DATE, analysis.compareDays)} · current selection`}
                  split={analysis.f8Split}
                />
              </div>
            </div>

            {/* Voice of the customer */}
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="section-label mb-2 text-positive">Top Positive Comments</p>
                <div className="space-y-2">
                  {analysis.topPositive.map((c) => (
                    <div key={c.id} className="rounded-lg border-l-2 border-l-positive bg-white/[0.02] p-2.5 text-xs">
                      <span className="font-medium">@{c.username}:</span>{" "}
                      <span className="text-muted-foreground">{displayText(c).slice(0, 160)}</span>
                      <span className="ml-2 text-muted-foreground/60">♥ {c.likes}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <p className="section-label mb-2 text-negative">Top Negative Comments</p>
                <div className="space-y-2">
                  {analysis.topNegative.map((c) => (
                    <div key={c.id} className="rounded-lg border-l-2 border-l-negative bg-white/[0.02] p-2.5 text-xs">
                      <span className="font-medium">@{c.username}:</span>{" "}
                      <span className="text-muted-foreground">{displayText(c).slice(0, 160)}</span>
                      <span className="ml-2 text-muted-foreground/60">♥ {c.likes}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </CardContent>

      {/* Drill-down: the comments behind whichever number was clicked */}
      <Dialog open={!!drilldown} onOpenChange={(open) => !open && setDrilldown(null)}>
        <DialogContent className="max-h-[80vh] max-w-2xl overflow-hidden">
          <DialogHeader>
            <DialogTitle>{drilldown?.title}</DialogTitle>
            <DialogDescription className="flex items-center justify-between gap-3">
              <span>{drilldown?.subtitle}</span>
              <button
                type="button"
                onClick={() => setShowTranslations((v) => !v)}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  showTranslations
                    ? "border-primary/50 bg-primary/15 text-foreground"
                    : "border-white/[0.08] bg-white/[0.03] text-muted-foreground hover:text-foreground",
                )}
              >
                {translating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Languages className="h-3 w-3" />}
                {showTranslations ? "English" : "Translate"}
              </button>
            </DialogDescription>
          </DialogHeader>
          <div className="-mr-2 max-h-[60vh] space-y-2 overflow-y-auto pr-2">
            {drilldown?.comments.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">No comments in this bucket.</p>
            )}
            {drilldown?.comments.map((c) => (
              <div key={c.id} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-muted-foreground">
                      @{c.username} · {c.platform}
                    </p>
                    <p className="mt-1 text-sm leading-relaxed">{displayText(c)}</p>
                    {showTranslations && translations.has(c.id) && translations.get(c.id) !== c.text && (
                      <p className="mt-1 text-xs text-muted-foreground/60" dir="auto">
                        {c.text}
                      </p>
                    )}
                  </div>
                  <SentimentIcon sentiment={c.sentiment} />
                </div>
                <div className="mt-2 flex items-center gap-3 text-[11px] text-muted-foreground">
                  <span>♥ {c.likes}</span>
                  {c.createdAt && <span>{new Date(c.createdAt).toLocaleDateString()}</span>}
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
