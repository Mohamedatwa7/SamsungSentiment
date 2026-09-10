"use client"

// One-click PDF export for the Competition Watch page — a stakeholder brief,
// not a data dump: executive summary, market pulse, brand-switching signals,
// and iPhone Duo vs Galaxy Fold8 strengths/weaknesses drawn from what people
// are actually saying (scored comments, tweets, headlines). Opens print-ready
// in a new window — "Save as PDF" produces the report. (Rendered by the
// browser so Arabic text and RTL shape correctly.)

import { FileDown } from "lucide-react"

import {
  computeIFoldTotals,
  ifoldCampaignDay,
  ifoldOpinions,
  formatCompactNum,
  IFOLD_PLAYBOOK,
  IFOLD_TOPIC_LABELS,
  type IFoldComment,
  type IFoldPayload,
  type IFoldPost,
  type IFoldSentiment,
  type IFoldTopicKey,
} from "@/lib/ifold-data"

interface Opinion {
  sentiment: IFoldSentiment
  topics: string[]
  lean: "apple" | "samsung" | null
  text: string
  likes: number
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
}

function pct(part: number, total: number): string {
  return total > 0 ? `${Math.round((part / total) * 100)}%` : "—"
}

function quoteHtml(o: { text: string; likes: number }, cls = ""): string {
  const t = o.text.replace(/\s+/g, " ").trim().slice(0, 200)
  return `<div class="quote ${cls}" dir="auto">“${esc(t)}”${o.likes > 0 ? `<span class="q-likes">♥ ${formatCompactNum(o.likes)}</span>` : ""}</div>`
}

const PLATFORM_NAMES: Record<string, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  twitter: "X",
  youtube: "YouTube",
  news: "Press",
}

function buildReportHtml(
  data: IFoldPayload,
  posts: IFoldPost[],
  comments: IFoldComment[],
  filterLabel: string,
): string {
  const totals = computeIFoldTotals(posts, comments)
  const opinions: Opinion[] = ifoldOpinions(posts, comments)
  const sTotal = totals.sentiment.positive + totals.sentiment.neutral + totals.sentiment.negative
  const posPct = sTotal > 0 ? Math.round((totals.sentiment.positive / sTotal) * 100) : 0
  const negPct = sTotal > 0 ? Math.round((totals.sentiment.negative / sTotal) * 100) : 0

  const baseline = data.samsungBaseline
  const bTotal = baseline.sentiment.positive + baseline.sentiment.neutral + baseline.sentiment.negative
  const bPosPct = bTotal > 0 ? Math.round((baseline.sentiment.positive / bTotal) * 100) : 0

  // ---- Topic aggregation (Duo side) ---------------------------------------
  const topics = new Map<string, { count: number; positive: number; negative: number }>()
  for (const o of opinions) {
    for (const t of o.topics) {
      if (!IFOLD_TOPIC_LABELS[t]) continue
      const slot = topics.get(t) || { count: 0, positive: 0, negative: 0 }
      slot.count++
      if (o.sentiment === "positive") slot.positive++
      if (o.sentiment === "negative") slot.negative++
      topics.set(t, slot)
    }
  }
  const topicRows = [...topics.entries()].sort((a, b) => b[1].count - a[1].count)
  const MIN_MENTIONS = 5

  const bestQuote = (topic: string, sentiment: IFoldSentiment): Opinion | null =>
    opinions
      .filter((o) => o.sentiment === sentiment && o.topics.includes(topic) && o.text.trim().length > 8)
      .sort((a, b) => b.likes - a.likes)[0] || null

  // Duo strengths = topics people praise; weaknesses = topics they attack.
  const duoStrengths = topicRows
    .filter(([, v]) => v.count >= MIN_MENTIONS && v.positive > v.negative)
    .sort((a, b) => b[1].positive / b[1].count - a[1].positive / a[1].count)
    .slice(0, 4)
  const duoWeaknesses = topicRows
    .filter(([, v]) => v.count >= MIN_MENTIONS && v.negative >= v.positive)
    .sort((a, b) => b[1].negative / b[1].count - a[1].negative / a[1].count)
    .slice(0, 4)

  // Fold8 strengths/weaknesses from OUR campaign corpus (baseline topics).
  const f8Rows = Object.entries(baseline.topics).filter(([k]) => IFOLD_TOPIC_LABELS[k])
  const f8Strengths = f8Rows
    .filter(([, v]) => v.positive + v.negative >= MIN_MENTIONS && v.positive > v.negative)
    .sort((a, b) => b[1].positive - a[1].positive)
    .slice(0, 4)
  const f8Weaknesses = f8Rows
    .filter(([, v]) => v.positive + v.negative >= MIN_MENTIONS && v.negative >= v.positive)
    .sort((a, b) => b[1].negative - a[1].negative)
    .slice(0, 4)

  // ---- Switching signals ("I'm going Apple" / "staying Samsung") ----------
  const leanTotal = totals.samsungLeans + totals.appleLeans
  const samsungQuotes = opinions
    .filter((o) => o.lean === "samsung" && o.text.trim().length > 8)
    .sort((a, b) => b.likes - a.likes)
    .slice(0, 3)
  const appleQuotes = opinions
    .filter((o) => o.lean === "apple" && o.text.trim().length > 8)
    .sort((a, b) => b.likes - a.likes)
    .slice(0, 3)

  // ---- Voice of the market ------------------------------------------------
  const topPositive = opinions
    .filter((o) => o.sentiment === "positive" && o.text.trim().length > 8)
    .sort((a, b) => b.likes - a.likes)
    .slice(0, 4)
  const topNegative = opinions
    .filter((o) => o.sentiment === "negative" && o.text.trim().length > 8)
    .sort((a, b) => b.likes - a.likes)
    .slice(0, 4)

  // ---- Executive summary sentences ---------------------------------------
  const hottest = topicRows[0]
  const topStrength = duoStrengths[0]
  const topWeakness = duoWeaknesses[0]
  const gccReactions = comments.filter((c) => c.gcc && c.analyzed).length
  const summary: string[] = []
  summary.push(
    `The tracker has scored ${formatCompactNum(sTotal)} public reactions to the iPhone Duo launch across social, X, YouTube and the press (${formatCompactNum(gccReactions)} from GCC audiences). Overall tone: ${posPct}% positive / ${negPct}% negative — against ${bPosPct}% positive in our own Galaxy Fold8 campaign corpus.`,
  )
  if (leanTotal >= MIN_MENTIONS)
    summary.push(
      `When people compare the two brands directly, ${pct(totals.samsungLeans, leanTotal)} side with Samsung (${formatCompactNum(totals.samsungLeans)} vs ${formatCompactNum(totals.appleLeans)} pro-Apple) — these are the closest signal we have to switching intent.`,
    )
  if (hottest)
    summary.push(
      `The conversation is dominated by ${IFOLD_TOPIC_LABELS[hottest[0]]} (${formatCompactNum(hottest[1].count)} mentions).`,
    )
  if (topStrength)
    summary.push(
      `Apple's clearest strength is ${IFOLD_TOPIC_LABELS[topStrength[0]]} (${pct(topStrength[1].positive, topStrength[1].count)} positive) — this is the threat to answer.`,
    )
  if (topWeakness)
    summary.push(
      `Its clearest weakness is ${IFOLD_TOPIC_LABELS[topWeakness[0]]} (${pct(topWeakness[1].negative, topWeakness[1].count)} negative) — the opening for Fold8 conquest messaging.`,
    )

  const generated = new Date().toLocaleString("en-GB", { dateStyle: "long", timeStyle: "short" })
  const day = ifoldCampaignDay()

  // ---- Section HTML -------------------------------------------------------
  const swCard = (
    rows: [string, { count?: number; positive: number; negative: number }][],
    tone: "pos" | "neg",
    withQuotes: boolean,
  ) =>
    rows.length === 0
      ? "<p class='muted'>Nothing above the noise floor yet.</p>"
      : rows
          .map(([k, v]) => {
            const total = v.count ?? v.positive + v.negative
            const share = tone === "pos" ? pct(v.positive, total) : pct(v.negative, total)
            const q = withQuotes ? bestQuote(k, tone === "pos" ? "positive" : "negative") : null
            return `<div class="sw-item">
              <p class="sw-title">${esc(IFOLD_TOPIC_LABELS[k])} <span class="${tone}">${share} ${tone === "pos" ? "positive" : "negative"}</span> <span class="muted">· ${formatCompactNum(total)} mentions</span></p>
              ${q ? quoteHtml(q) : ""}
            </div>`
          })
          .join("")

  const headToHeadRows = topicRows
    .slice(0, 10)
    .map(([k, v]) => {
      const f8 = baseline.topics[k]
      const f8Total = f8 ? f8.positive + f8.negative : 0
      const duoRead = v.negative > v.positive ? "neg" : v.positive > v.negative ? "pos" : ""
      const advantage =
        v.negative > v.positive && f8 && f8.positive > f8.negative
          ? "Fold8 advantage"
          : v.positive > v.negative && f8 && f8.negative >= f8.positive
            ? "Duo advantage"
            : v.negative > v.positive
              ? "Duo pain point"
              : v.positive > v.negative
                ? "Duo strength"
                : "Contested"
      return `<tr>
        <td>${esc(IFOLD_TOPIC_LABELS[k])}</td>
        <td class="num ${duoRead}">${pct(v.positive, v.count)} / ${pct(v.negative, v.count)}</td>
        <td class="num">${f8Total > 0 ? `${pct(f8.positive, f8Total)} / ${pct(f8.negative, f8Total)}` : "—"}</td>
        <td>${advantage}</td>
      </tr>`
    })
    .join("")

  const openings = duoWeaknesses.map(([k]) => k as IFoldTopicKey).filter((k) => IFOLD_PLAYBOOK[k])
  const openingsHtml = openings
    .map(
      (k) => `<div class="opening">
        <p class="opening-title">${esc(IFOLD_TOPIC_LABELS[k])}</p>
        <p>${esc(IFOLD_PLAYBOOK[k])}</p>
      </div>`,
    )
    .join("")

  const topSocial = posts
    .filter((p) => p.kind === "social")
    .sort(
      (a, b) =>
        Number(b.gcc) - Number(a.gcc) ||
        b.likes + b.commentsCount * 3 - (a.likes + a.commentsCount * 3),
    )
    .slice(0, 10)
  const socialRows = topSocial
    .map((p) => {
      const cs = p.commentSentiment
      const scored = cs.positive + cs.neutral + cs.negative
      return `<tr>
        <td dir="auto">@${esc(p.author)}</td>
        <td>${PLATFORM_NAMES[p.platform] || p.platform}${p.gcc ? " · GCC" : ""}</td>
        <td dir="auto" class="caption">${esc((p.title || "").slice(0, 100))}</td>
        <td class="num">${formatCompactNum(p.likes)}</td>
        <td class="num">${formatCompactNum(p.commentsCount)}</td>
        <td class="num ${scored > 0 && cs.positive / scored >= 0.5 ? "pos" : scored > 0 ? "neg" : ""}">${scored > 0 ? pct(cs.positive, scored) : "—"}</td>
      </tr>`
    })
    .join("")

  const topNews = posts
    .filter((p) => p.kind === "news")
    .sort((a, b) => new Date(b.publishedAt || 0).getTime() - new Date(a.publishedAt || 0).getTime())
    .slice(0, 10)
  const newsRows = topNews
    .map(
      (p) => `<tr>
        <td dir="auto">${esc(p.source || p.author)}</td>
        <td dir="auto" class="caption">${esc(p.title.slice(0, 130))}</td>
        <td class="${p.analysis?.sentiment === "positive" ? "pos" : p.analysis?.sentiment === "negative" ? "neg" : ""}">${p.analysis ? p.analysis.sentiment : "—"}</td>
        <td>${p.publishedAt ? new Date(p.publishedAt).toLocaleDateString("en-GB") : "—"}</td>
      </tr>`,
    )
    .join("")

  const bar = (pos: number, neu: number, neg: number, total: number) => `
    <div class="bar">
      <div style="background:#0e7a3c;width:${total > 0 ? (pos / total) * 100 : 0}%"></div>
      <div style="background:#c8cdd6;width:${total > 0 ? (neu / total) * 100 : 0}%"></div>
      <div style="background:#b3261e;width:${total > 0 ? (neg / total) * 100 : 0}%"></div>
    </div>`

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Co.A Watch — iPhone Duo · Market Brief</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: "Segoe UI", system-ui, -apple-system, sans-serif; color: #14181f; margin: 0; padding: 32px 40px; font-size: 12px; line-height: 1.55; }
  h1 { font-size: 22px; margin: 0; }
  h2 { font-size: 14px; margin: 26px 0 8px; padding-bottom: 4px; border-bottom: 2px solid #1428a0; }
  h3 { font-size: 12px; margin: 12px 0 6px; }
  .sub { color: #5a6270; margin: 2px 0 0; }
  .meta { color: #5a6270; font-size: 11px; margin-top: 6px; }
  .summary { border: 1px solid #dde1e8; border-left: 4px solid #1428a0; border-radius: 8px; padding: 12px 16px; margin-top: 16px; }
  .summary p { margin: 4px 0; }
  .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-top: 10px; }
  .kpi { border: 1px solid #dde1e8; border-radius: 8px; padding: 10px 12px; }
  .kpi .v { font-size: 18px; font-weight: 700; margin: 0; }
  .kpi .l { font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; color: #5a6270; margin: 2px 0 0; }
  table { width: 100%; border-collapse: collapse; margin-top: 6px; }
  th { text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; color: #5a6270; border-bottom: 1px solid #c8cdd6; padding: 4px 6px; }
  td { padding: 5px 6px; border-bottom: 1px solid #eceef2; vertical-align: top; }
  td.num { text-align: right; white-space: nowrap; }
  td.caption { max-width: 320px; }
  .pos { color: #0e7a3c; font-weight: 600; } .neg { color: #b3261e; font-weight: 600; }
  .muted { color: #8a90a0; }
  .bar { display: flex; height: 14px; border-radius: 7px; overflow: hidden; margin: 6px 0 2px; }
  .bar div { height: 100%; }
  .legend { font-size: 10px; color: #5a6270; margin: 0; }
  .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
  .panel { border: 1px solid #dde1e8; border-radius: 8px; padding: 10px 14px; }
  .panel.good { border-top: 3px solid #0e7a3c; }
  .panel.bad { border-top: 3px solid #b3261e; }
  .sw-item { margin: 8px 0; }
  .sw-title { margin: 0 0 3px; font-weight: 600; }
  .sw-title .muted { font-weight: 400; }
  .quote { border-left: 3px solid #c8cdd6; padding: 2px 10px; margin: 3px 0; color: #3a4150; font-size: 11px; }
  .q-likes { color: #8a90a0; margin-inline-start: 8px; font-size: 10px; }
  .opening { border-left: 3px solid #1428a0; padding: 4px 10px; margin: 8px 0; }
  .opening-title { font-weight: 700; margin: 0 0 2px; }
  .opening p { margin: 0; }
  .footer { margin-top: 30px; padding-top: 8px; border-top: 1px solid #c8cdd6; color: #8a90a0; font-size: 10px; }
  @page { size: A4; margin: 14mm; }
  @media print { body { padding: 0; } h2, h3 { break-after: avoid; } tr, .opening, .kpi, .sw-item, .panel, .quote { break-inside: avoid; } }
</style>
</head>
<body>
  <h1>Co.A Watch — iPhone Duo</h1>
  <p class="sub">Samsung Gulf · Competition Analysis — Apple iPhone Duo launch vs Galaxy Z Fold8 · Market Brief</p>
  <p class="meta">Generated ${esc(generated)} · Tracking day ${day} · Filters: ${esc(filterLabel)} · Source: samsungtrack.com/competition</p>

  <div class="summary">
    <h3 style="margin-top:0">Executive summary</h3>
    ${summary.map((s) => `<p>· ${esc(s)}</p>`).join("")}
  </div>

  <h2>Market pulse</h2>
  <div class="kpis">
    <div class="kpi"><p class="v">${formatCompactNum(totals.posts)}</p><p class="l">Tracked posts &amp; articles (${formatCompactNum(totals.socialPosts)} social · ${formatCompactNum(totals.newsArticles)} press)</p></div>
    <div class="kpi"><p class="v">${formatCompactNum(sTotal)}</p><p class="l">AI-scored public reactions</p></div>
    <div class="kpi"><p class="v">${posPct}% / ${negPct}%</p><p class="l">Positive / negative on the iPhone Duo</p></div>
    <div class="kpi"><p class="v">${leanTotal > 0 ? pct(totals.samsungLeans, leanTotal) : "—"}</p><p class="l">Direct comparisons siding with Samsung</p></div>
  </div>
  <div class="two-col" style="margin-top:12px">
    <div>
      <strong>iPhone Duo launch reactions (${formatCompactNum(sTotal)})</strong>
      ${bar(totals.sentiment.positive, totals.sentiment.neutral, totals.sentiment.negative, sTotal)}
      <p class="legend">${pct(totals.sentiment.positive, sTotal)} positive · ${pct(totals.sentiment.neutral, sTotal)} neutral · ${pct(totals.sentiment.negative, sTotal)} negative</p>
    </div>
    <div>
      <strong>Galaxy Fold8 campaign baseline (${formatCompactNum(bTotal)})</strong>
      ${bar(baseline.sentiment.positive, baseline.sentiment.neutral, baseline.sentiment.negative, bTotal)}
      <p class="legend">${pct(baseline.sentiment.positive, bTotal)} positive · ${pct(baseline.sentiment.neutral, bTotal)} neutral · ${pct(baseline.sentiment.negative, bTotal)} negative</p>
    </div>
  </div>

  <h2>Switching signals — who's winning the comparison</h2>
  <p>${leanTotal > 0 ? `${formatCompactNum(leanTotal)} scored reactions pick a side when comparing the two brands: <span class="pos">${formatCompactNum(totals.samsungLeans)} favor Samsung (${pct(totals.samsungLeans, leanTotal)})</span> vs <span class="neg">${formatCompactNum(totals.appleLeans)} favor Apple (${pct(totals.appleLeans, leanTotal)})</span>.` : "Not enough direct brand comparisons scored yet."}</p>
  <div class="two-col">
    <div class="panel good">
      <h3 style="margin-top:0">Staying with / switching to Samsung</h3>
      ${samsungQuotes.map((q) => quoteHtml(q)).join("") || "<p class='muted'>No quotes yet.</p>"}
    </div>
    <div class="panel bad">
      <h3 style="margin-top:0">Tempted by / switching to Apple</h3>
      ${appleQuotes.map((q) => quoteHtml(q)).join("") || "<p class='muted'>No quotes yet.</p>"}
    </div>
  </div>

  <h2>iPhone Duo — strengths &amp; weaknesses (what people say)</h2>
  <div class="two-col">
    <div class="panel bad">
      <h3 style="margin-top:0">Strengths — the threats to answer</h3>
      ${swCard(duoStrengths, "pos", true)}
    </div>
    <div class="panel good">
      <h3 style="margin-top:0">Weaknesses — our openings</h3>
      ${swCard(duoWeaknesses, "neg", true)}
    </div>
  </div>

  <h2>Galaxy Fold8 — strengths &amp; weaknesses (our campaign corpus)</h2>
  <div class="two-col">
    <div class="panel good">
      <h3 style="margin-top:0">Strengths to amplify</h3>
      ${swCard(f8Strengths, "pos", false)}
    </div>
    <div class="panel bad">
      <h3 style="margin-top:0">Weaknesses to defend</h3>
      ${swCard(f8Weaknesses, "neg", false)}
    </div>
  </div>

  <h2>Topic head-to-head</h2>
  <table>
    <thead><tr><th>Topic</th><th>iPhone Duo pos/neg</th><th>Fold8 pos/neg</th><th>Read</th></tr></thead>
    <tbody>${headToHeadRows || '<tr><td colspan="4">No scored topics yet.</td></tr>'}</tbody>
  </table>

  <h2>Recommended plays — where Fold8 can capitalize</h2>
  ${openingsHtml || "<p>No topics trending negative for Apple in this filter yet.</p>"}

  <h2>Voice of the market — loudest reactions</h2>
  <div class="two-col">
    <div class="panel bad">
      <h3 style="margin-top:0">Praise for the Duo</h3>
      ${topPositive.map((q) => quoteHtml(q)).join("") || "<p class='muted'>None yet.</p>"}
    </div>
    <div class="panel good">
      <h3 style="margin-top:0">Criticism of the Duo</h3>
      ${topNegative.map((q) => quoteHtml(q)).join("") || "<p class='muted'>None yet.</p>"}
    </div>
  </div>

  <h2>Top conversations (GCC-relevant first)</h2>
  <table>
    <thead><tr><th>Author</th><th>Channel</th><th>Caption</th><th>Likes</th><th>Comments</th><th>Positive</th></tr></thead>
    <tbody>${socialRows || '<tr><td colspan="6">No social posts in this filter.</td></tr>'}</tbody>
  </table>

  <h2>Latest press coverage</h2>
  <table>
    <thead><tr><th>Outlet</th><th>Headline</th><th>Tone</th><th>Date</th></tr></thead>
    <tbody>${newsRows || '<tr><td colspan="4">No press articles in this filter.</td></tr>'}</tbody>
  </table>

  <p class="footer">Co.A Watch — iPhone Duo · auto-generated from live tracker data (daily 9:00 AM Gulf sync) · sentiment, topics and brand leans scored by AI on every comment, tweet and headline · green = good for Samsung, red = risk.</p>
</body>
</html>`
}

export function IFoldExportButton({
  data,
  posts,
  comments,
  filterLabel,
}: {
  data: IFoldPayload
  posts: IFoldPost[]
  comments: IFoldComment[]
  filterLabel: string
}) {
  const handleExport = () => {
    const win = window.open("", "_blank")
    if (!win) return
    win.document.write(buildReportHtml(data, posts, comments, filterLabel))
    win.document.close()
    // Give the new document a beat to lay out before the print dialog opens.
    win.focus()
    setTimeout(() => win.print(), 400)
  }

  return (
    <button
      type="button"
      onClick={handleExport}
      className="flex shrink-0 items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-4 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-primary/20"
    >
      <FileDown className="h-3.5 w-3.5" />
      Export PDF Report
    </button>
  )
}
