// Merge new S.com reviews from a CSV export into data/samsung-reviews.json.
// Dedupes by Review ID; reports date coverage before/after.
// Run: node scripts/merge-scom-reviews.mjs "C:\Users\Hi\Downloads\S.csv"
import { readFileSync, writeFileSync } from "fs"

const csvPath = process.argv[2]
if (!csvPath) { console.error("usage: merge-scom-reviews.mjs <csv>"); process.exit(1) }

// Minimal RFC-4180 parser (quoted fields may contain commas and newlines).
function parseCsv(text) {
  const rows = []
  let row = []
  let field = ""
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++ }
        else inQuotes = false
      } else field += ch
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === ",") {
      row.push(field); field = ""
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++
      row.push(field); field = ""
      if (row.length > 1 || row[0] !== "") rows.push(row)
      row = []
    } else field += ch
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row) }
  return rows
}

const csv = readFileSync(csvPath, "utf8").replace(/^﻿/, "")
const rows = parseCsv(csv)
const header = rows[0]
const records = rows.slice(1).map((r) => {
  const obj = {}
  header.forEach((h, i) => { obj[h.trim()] = (r[i] ?? "").trim() })
  return obj
})
console.log(`CSV records: ${records.length}`)

const existing = JSON.parse(readFileSync("data/samsung-reviews.json", "utf8"))
console.log(`existing reviews: ${existing.length}`)

const parseDate = (s) => {
  const m = String(s || "").match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  return m ? new Date(+m[3], +m[1] - 1, +m[2]) : null
}
const range = (arr) => {
  const ds = arr.map((r) => parseDate(r["Review Submission Date"])).filter(Boolean).sort((a, b) => a - b)
  return ds.length ? `${ds[0].toISOString().slice(0, 10)} -> ${ds[ds.length - 1].toISOString().slice(0, 10)}` : "none"
}
console.log(`existing range: ${range(existing)}`)
console.log(`csv range:      ${range(records)}`)

// The JSON schema is the superset used by lib/reviews-data.ts — make new
// records carry every existing key (blank when the CSV lacks the column).
const allKeys = new Set()
for (const r of existing.slice(0, 50)) Object.keys(r).forEach((k) => allKeys.add(k))

const existingIds = new Set(existing.map((r) => String(r["Review ID"])))
const fresh = records.filter((r) => r["Review ID"] && !existingIds.has(String(r["Review ID"])))
console.log(`new reviews to add: ${fresh.length}`)

const normalized = fresh.map((r) => {
  const out = {}
  for (const k of allKeys) out[k] = r[k] ?? ""
  // Keep any extra CSV columns too (e.g. Model Number)
  for (const [k, v] of Object.entries(r)) if (!(k in out)) out[k] = v
  return out
})

const merged = [...existing, ...normalized]
writeFileSync("data/samsung-reviews.json", JSON.stringify(merged))
console.log(`merged total: ${merged.length}`)
console.log(`merged range: ${range(merged)}`)

// Distribution of the newly added reviews by month
const byMonth = {}
for (const r of normalized) {
  const d = parseDate(r["Review Submission Date"])
  if (d) byMonth[d.toISOString().slice(0, 7)] = (byMonth[d.toISOString().slice(0, 7)] || 0) + 1
}
console.log("new reviews by month:", JSON.stringify(Object.fromEntries(Object.entries(byMonth).sort())))
