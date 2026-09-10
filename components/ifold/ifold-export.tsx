"use client"

// One-click PDF export for the Competition Watch page. Builds an organized,
// print-styled HTML report from the data already loaded client-side and opens
// it in a new window with the print dialog up — "Save as PDF" produces the
// report. (Rendered by the browser, so Arabic text and RTL shape correctly —
// canvas/jsPDF approaches garble them.)

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
  type IFoldTopicKey,
} from "@/lib/ifold-data"

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
}

function pct(part: number, total: number): string {
  return total > 0 ? `${Math.round((part / total) * 100)}%` : "—"
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
  const opinions = ifoldOpinions(posts, comments)
  const sTotal = totals.sentiment.positive + totals.sentiment.neutral + totals.sentiment.negative

  // Topic aggregation — mentions with positive/negative splits.
  const topics = new Map<string, { count: number; positive: number; negative: number }>()
  for (const o of opinions) {
    for (const t of o.topics) {
      const slot = topics.get(t) || { count: 0, positive: 0, negative: 0 }
      slot.count++
      if (o.sentiment === "positive") slot.positive++
      if (o.sentiment === "negative") slot.negative++
      topics.set(t, slot)
    }
  }
  const topicRows = [...topics.entries()]
    .filter(([k]) => IFOLD_TOPIC_LABELS[k])
    .sort((a, b) => b[1].count - a[1].count)

  // Fold8 openings: topics trending negative for Apple, with the playbook line.
  const openings = topicRows
    .filter(([, v]) => v.count >= 5 && v.negative > v.positive)
    .slice(0, 5)
    .map(([k]) => k as IFoldTopicKey)

  const baseline = data.samsungBaseline
  const bTotal = baseline.sentiment.positive + baseline.sentiment.neutral + baseline.sentiment.negative

  // Top GCC-relevant social conversations and press headlines.
  const topSocial = posts
    .filter((p) => p.kind === "social")
    .sort((a, b) => Number(b.gcc) - Number(a.gcc) || b.views - a.views)
    .slice(0, 12)
  const topNews = posts
    .filter((p) => p.kind === "news")
    .sort((a, b) => new Date(b.publishedAt || 0).getTime() - new Date(a.publishedAt || 0).getTime())
    .slice(0, 12)

  const generated = new Date().toLocaleString("en-GB", { dateStyle: "long", timeStyle: "short" })
  const day = ifoldCampaignDay()

  const topicTable = topicRows
    .slice(0, 12)
    .map(
      ([k, v]) => `<tr>
        <td>${esc(IFOLD_TOPIC_LABELS[k])}</td>
        <td class="num">${v.count}</td>
        <td class="num pos">${pct(v.positive, v.count)}</td>
        <td class="num neg">${pct(v.negative, v.count)}</td>
        <td>${v.negative > v.positive ? "Opening for Fold8" : v.positive > v.negative ? "Apple strength" : "Contested"}</td>
      </tr>`,
    )
    .join("")

  const openingsHtml = openings
    .map(
      (k) => `<div class="opening">
        <p class="opening-title">${esc(IFOLD_TOPIC_LABELS[k])}</p>
        <p>${esc(IFOLD_PLAYBOOK[k])}</p>
      </div>`,
    )
    .join("")

  const socialRows = topSocial
    .map(
      (p) => `<tr>
        <td dir="auto">@${esc(p.author)}</td>
        <td>${PLATFORM_NAMES[p.platform] || p.platform}${p.gcc ? " · GCC" : ""}</td>
        <td dir="auto" class="caption">${esc((p.title || "").slice(0, 110))}</td>
        <td class="num">${formatCompactNum(p.views)}</td>
        <td class="num">${formatCompactNum(p.likes)}</td>
        <td class="num pos">${pct(p.commentSentiment.positive, p.commentSentiment.positive + p.commentSentiment.neutral + p.commentSentiment.negative)}</td>
      </tr>`,
    )
    .join("")

  const newsRows = topNews
    .map(
      (p) => `<tr>
        <td dir="auto">${esc(p.source || p.author)}</td>
        <td dir="auto" class="caption">${esc(p.title.slice(0, 130))}</td>
        <td>${p.analysis ? p.analysis.sentiment : "—"}</td>
        <td>${p.publishedAt ? new Date(p.publishedAt).toLocaleDateString("en-GB") : "—"}</td>
      </tr>`,
    )
    .join("")

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Co.A Watch — iPhone Duo · Report</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: "Segoe UI", system-ui, -apple-system, sans-serif; color: #14181f; margin: 0; padding: 32px 40px; font-size: 12px; line-height: 1.5; }
  h1 { font-size: 22px; margin: 0; }
  h2 { font-size: 14px; margin: 28px 0 8px; padding-bottom: 4px; border-bottom: 2px solid #1428a0; }
  .sub { color: #5a6270; margin: 2px 0 0; }
  .meta { color: #5a6270; font-size: 11px; margin-top: 6px; }
  .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-top: 16px; }
  .kpi { border: 1px solid #dde1e8; border-radius: 8px; padding: 10px 12px; }
  .kpi .v { font-size: 18px; font-weight: 700; }
  .kpi .l { font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; color: #5a6270; }
  table { width: 100%; border-collapse: collapse; margin-top: 6px; }
  th { text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; color: #5a6270; border-bottom: 1px solid #c8cdd6; padding: 4px 6px; }
  td { padding: 5px 6px; border-bottom: 1px solid #eceef2; vertical-align: top; }
  td.num { text-align: right; white-space: nowrap; }
  td.caption { max-width: 340px; }
  .pos { color: #0e7a3c; } .neg { color: #b3261e; }
  .bar { display: flex; height: 14px; border-radius: 7px; overflow: hidden; margin: 6px 0 2px; }
  .bar div { height: 100%; }
  .legend { font-size: 10px; color: #5a6270; }
  .opening { border-left: 3px solid #1428a0; padding: 4px 10px; margin: 8px 0; }
  .opening-title { font-weight: 700; margin: 0 0 2px; }
  .opening p { margin: 0; }
  .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
  .footer { margin-top: 32px; padding-top: 8px; border-top: 1px solid #c8cdd6; color: #8a90a0; font-size: 10px; }
  @page { size: A4; margin: 14mm; }
  @media print { body { padding: 0; } h2 { break-after: avoid; } tr, .opening, .kpi { break-inside: avoid; } }
</style>
</head>
<body>
  <h1>Co.A Watch — iPhone Duo</h1>
  <p class="sub">Samsung Gulf · Competition Analysis — Apple iPhone Duo launch vs Galaxy Z Fold8</p>
  <p class="meta">Generated ${esc(generated)} · Tracking day ${day} · Filters: ${esc(filterLabel)} · Source: samsungtrack.com/competition</p>

  <h2>Headline numbers</h2>
  <div class="kpis">
    <div class="kpi"><p class="v">${formatCompactNum(totals.posts)}</p><p class="l">Tracked posts (${formatCompactNum(totals.socialPosts)} social · ${formatCompactNum(totals.newsArticles)} press)</p></div>
    <div class="kpi"><p class="v">${formatCompactNum(totals.views)}</p><p class="l">Video &amp; post views</p></div>
    <div class="kpi"><p class="v">${formatCompactNum(sTotal)}</p><p class="l">AI-scored reactions</p></div>
    <div class="kpi"><p class="v">${totals.samsungLeans + totals.appleLeans > 0 ? pct(totals.samsungLeans, totals.samsungLeans + totals.appleLeans) : "—"}</p><p class="l">Head-to-head comparisons favoring Samsung</p></div>
  </div>

  <h2>Sentiment — iPhone Duo launch vs our Fold8 campaign</h2>
  <div class="two-col">
    <div>
      <strong>iPhone Duo reactions (${formatCompactNum(sTotal)})</strong>
      <div class="bar">
        <div style="background:#0e7a3c;width:${sTotal > 0 ? (totals.sentiment.positive / sTotal) * 100 : 0}%"></div>
        <div style="background:#c8cdd6;width:${sTotal > 0 ? (totals.sentiment.neutral / sTotal) * 100 : 0}%"></div>
        <div style="background:#b3261e;width:${sTotal > 0 ? (totals.sentiment.negative / sTotal) * 100 : 0}%"></div>
      </div>
      <p class="legend">${pct(totals.sentiment.positive, sTotal)} positive · ${pct(totals.sentiment.neutral, sTotal)} neutral · ${pct(totals.sentiment.negative, sTotal)} negative</p>
    </div>
    <div>
      <strong>Galaxy Fold8 campaign baseline (${formatCompactNum(bTotal)})</strong>
      <div class="bar">
        <div style="background:#0e7a3c;width:${bTotal > 0 ? (baseline.sentiment.positive / bTotal) * 100 : 0}%"></div>
        <div style="background:#c8cdd6;width:${bTotal > 0 ? (baseline.sentiment.neutral / bTotal) * 100 : 0}%"></div>
        <div style="background:#b3261e;width:${bTotal > 0 ? (baseline.sentiment.negative / bTotal) * 100 : 0}%"></div>
      </div>
      <p class="legend">${pct(baseline.sentiment.positive, bTotal)} positive · ${pct(baseline.sentiment.neutral, bTotal)} neutral · ${pct(baseline.sentiment.negative, bTotal)} negative</p>
    </div>
  </div>

  <h2>What the conversation is about</h2>
  <table>
    <thead><tr><th>Topic</th><th>Mentions</th><th>Positive</th><th>Negative</th><th>Read</th></tr></thead>
    <tbody>${topicTable || '<tr><td colspan="5">No scored topics yet.</td></tr>'}</tbody>
  </table>

  <h2>Where Fold8 can capitalize</h2>
  ${openingsHtml || "<p>No topics trending negative for Apple in this filter yet.</p>"}

  <h2>Top social conversations (GCC-relevant first)</h2>
  <table>
    <thead><tr><th>Author</th><th>Channel</th><th>Caption</th><th>Views</th><th>Likes</th><th>Positive</th></tr></thead>
    <tbody>${socialRows || '<tr><td colspan="6">No social posts in this filter.</td></tr>'}</tbody>
  </table>

  <h2>Latest press coverage</h2>
  <table>
    <thead><tr><th>Outlet</th><th>Headline</th><th>Tone</th><th>Date</th></tr></thead>
    <tbody>${newsRows || '<tr><td colspan="4">No press articles in this filter.</td></tr>'}</tbody>
  </table>

  <p class="footer">Co.A Watch — iPhone Duo · auto-generated from live tracker data (daily 9:00 AM Gulf sync) · sentiment scored by AI on every comment, tweet and headline.</p>
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
