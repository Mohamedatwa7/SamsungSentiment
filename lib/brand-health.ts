/**
 * Comment Health Index (CHI)
 *
 * Two layers, blended by attribution coverage:
 *
 *   CHI = α · ProductCHI + (1 − α) · BrandSentiment
 *
 *   α              = share of comments attributed to a specific product
 *   BrandSentiment = 100 · (pos + 0.5·neu) / n over UNATTRIBUTED comments
 *
 * ProductCHI = ( Σ(βᵢ · cᵢ · Sᵢ) / Σ(βᵢ · cᵢ) ) · 100, per product i:
 *   Sᵢ  = (pos + 0.5·neu) / n              — sentiment score, 0–1 (neutral counts half)
 *   cᵢ  = nᵢ / (nᵢ + 20)                   — sample-size confidence: a product needs
 *         ~20 comments to earn full weight. Deliberately independent of the
 *         sentiment split — the earlier 1−1.96·SE weight shrank for products
 *         with MIXED sentiment, silently down-weighting contested products and
 *         biasing the index upward.
 *   βᵢ  = DEPT_WEIGHTS[dept] · (n / deptVolume) — strategic weight, split by volume
 *
 * Rationale for the blend: the majority of social comments cannot be tied to a
 * specific product. An "overall comment health" number that ignores them would
 * describe only a small attributed minority, so unattributed comments enter as
 * a brand-level sentiment component weighted by their actual share of volume.
 *
 * Margin of error: per-layer binomial SEs combined as
 *   ± 1.96 · sqrt( α²·SE_product² + (1−α)²·SE_brand² ) · 100
 */

import type { Comment } from "./comments-data"

// Department strategic weights. These sum to 1 and are split across each
// department's products by comment volume so all βᵢ sum to 1 automatically.
export const DEPT_WEIGHTS = { MX: 0.70, VD: 0.20, HA: 0.10 } as const

export type Department = keyof typeof DEPT_WEIGHTS

// Maps each product to its Samsung division.
//   MX = Mobile eXperience (phones, tablets, wearables, audio, mobile software)
//   VD = Visual Display (TVs)
//   HA = Home Appliances
const PRODUCT_DEPARTMENTS: Record<string, Department> = {
  // VD — Visual Display
  "Neo QLED TV": "VD",
  "The Frame": "VD",
  "Samsung Art TV": "VD",
  "Micro LED TV": "VD",
  // HA — Home Appliances
  "Bespoke AI": "HA",
}

// Any product not explicitly mapped belongs to Mobile eXperience.
const DEFAULT_DEPARTMENT: Department = "MX"

export function getProductDepartment(product: string): Department {
  return PRODUCT_DEPARTMENTS[product] ?? DEFAULT_DEPARTMENT
}

/**
 * Normalise a stored department code to a CHI department.
 * The data uses MX / VD / DA (Digital Appliances) / Brand; CHI uses MX / VD / HA.
 * Returns null when the value can't be mapped (e.g. "Brand"), so the caller can
 * fall back to product-name based classification.
 */
export function normalizeDepartment(dept?: string | null): Department | null {
  if (!dept) return null
  const d = dept.trim().toUpperCase()
  if (d === "MX") return "MX"
  if (d === "VD") return "VD"
  if (d === "HA" || d === "DA") return "HA"
  return null
}

// Default fallback score when there is no data at all
const DEFAULT_SCORE = 50

// ---------------------------------------------------------------------------
// Pure CHI computation
// ---------------------------------------------------------------------------

export interface CHIProduct {
  product: string
  department: Department
  pos: number
  neg: number
  neu: number
}

export interface CHIDriver {
  product: string
  department: Department
  sentiment: number // Sᵢ scaled to 0–100
  contributionWeight: number // βᵢ · cᵢ
  share: number // (βᵢ · cᵢ) / Σ(βᵢ · cᵢ), as a 0–100 percentage
  totalComments: number
}

export interface CHIResult {
  chi: number // final index, 0–100 (rounded)
  margin: number // ± round(1.96 · SE_CHI)
  drivers: CHIDriver[] // sorted by contribution weight (βᵢ · cᵢ) desc
}

/**
 * Pure function implementing the Comment Health Index.
 * All of the math lives here; callers only assemble the product inputs.
 */
export function computeCHI(products: CHIProduct[]): CHIResult {
  // n = pos + neg + neu, drop empty products.
  const valid = products
    .map((p) => ({ ...p, n: p.pos + p.neg + p.neu }))
    .filter((p) => p.n > 0)

  if (valid.length === 0) {
    return { chi: DEFAULT_SCORE, margin: 0, drivers: [] }
  }

  // Department volumes — Σ n over the products in each department.
  const deptVolume: Record<string, number> = {}
  for (const p of valid) {
    deptVolume[p.department] = (deptVolume[p.department] ?? 0) + p.n
  }

  const rows = valid.map((p) => {
    const n = p.n
    const S = (p.pos + 0.5 * p.neu) / n // 0–1
    const pSmooth = (p.pos + 1) / (n + 2)
    const SE = Math.sqrt((pSmooth * (1 - pSmooth)) / n)
    // Sample-size confidence only — must not depend on the sentiment split,
    // or contested products get silently down-weighted (upward bias).
    const c = n / (n + 20)
    const dv = deptVolume[p.department] ?? 0
    // Guard against deptVolume = 0 (cannot happen for a valid product, but be safe).
    const beta = dv > 0 ? DEPT_WEIGHTS[p.department] * (n / dv) : 0
    const bc = beta * c
    return { p, n, S, SE, beta, c, bc }
  })

  const sumBC = rows.reduce((s, r) => s + r.bc, 0)
  const sumBCS = rows.reduce((s, r) => s + r.bc * r.S, 0)
  const sumVar = rows.reduce((s, r) => s + r.bc * r.bc * r.SE * r.SE, 0)

  const chi = sumBC > 0 ? (sumBCS / sumBC) * 100 : DEFAULT_SCORE
  const seChi = sumBC > 0 ? (Math.sqrt(sumVar) / sumBC) * 100 : 0

  const drivers: CHIDriver[] = rows
    .map((r) => ({
      product: r.p.product,
      department: r.p.department,
      sentiment: r.S * 100,
      contributionWeight: r.bc,
      share: sumBC > 0 ? (r.bc / sumBC) * 100 : 0,
      totalComments: r.n,
    }))
    .sort((a, b) => b.contributionWeight - a.contributionWeight)

  return {
    chi: Math.max(0, Math.min(100, Math.round(chi))),
    margin: Math.round(1.96 * seChi),
    drivers,
  }
}

// ---------------------------------------------------------------------------
// Result shape consumed by the dashboard UI (kept backward compatible)
// ---------------------------------------------------------------------------

export interface ProductContribution {
  product: string
  department: Department
  sentimentScore: number // Sᵢ scaled to 0–100
  contributionWeight: number // βᵢ · cᵢ
  contributionShare: number // % of Σ(βᵢ · cᵢ)
  totalComments: number
}

export interface BrandHealthResult {
  score: number // Final 0-100 health index (CHI)
  margin: number // ± margin of error
  topContributors: ProductContribution[] // sorted by contribution weight desc
  productCount: number // products with data
  attributedShare: number // % of comments tied to a specific product (α · 100)
  brandSentiment: number // 0-100 sentiment of unattributed comments
}

/**
 * Get the ISO week number and year for a date
 */
function getWeekNumber(date: Date): { year: number; week: number } {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const week = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
  return { year: d.getUTCFullYear(), week }
}

/**
 * Get the start date of a given ISO week
 */
function getWeekStartDate(year: number, week: number): Date {
  const simple = new Date(Date.UTC(year, 0, 1 + (week - 1) * 7))
  const dow = simple.getUTCDay()
  const ISOweekStart = simple
  if (dow <= 4) ISOweekStart.setUTCDate(simple.getUTCDate() - simple.getUTCDay() + 1)
  else ISOweekStart.setUTCDate(simple.getUTCDate() + 8 - simple.getUTCDay())
  return ISOweekStart
}

export interface WeeklyBrandHealth {
  weekKey: string // "2025-W03"
  weekLabel: string // "W3 25" or "W3 26"
  weekStart: string // ISO date
  score: number
  commentCount: number
}

/**
 * Calculate brand health score for each week based on comment timestamps
 */
export function calculateWeeklyBrandHealth(comments: Comment[]): WeeklyBrandHealth[] {
  if (comments.length === 0) return []

  // Group comments by week
  const byWeek = new Map<string, Comment[]>()
  
  for (const c of comments) {
    const date = new Date(c.createdAt)
    if (isNaN(date.getTime())) continue
    const { year, week } = getWeekNumber(date)
    const weekKey = `${year}-W${String(week).padStart(2, "0")}`
    if (!byWeek.has(weekKey)) byWeek.set(weekKey, [])
    byWeek.get(weekKey)!.push(c)
  }

  // Calculate score for each week
  const results: WeeklyBrandHealth[] = []
  
  for (const [weekKey, weekComments] of byWeek) {
    const [yearStr, weekStr] = weekKey.split("-W")
    const year = parseInt(yearStr)
    const week = parseInt(weekStr)
    const weekStart = getWeekStartDate(year, week)
    
    // Format as "W1 25" or "W12 26" (week number + 2-digit year)
    const yearShort = String(year).slice(-2)
    const weekLabel = `W${week} ${yearShort}`
    
    const result = calculateBrandHealthScore(weekComments)
    
    results.push({
      weekKey,
      weekLabel,
      weekStart: weekStart.toISOString().slice(0, 10),
      score: result.score,
      commentCount: weekComments.length,
    })
  }

  // Sort by week
  results.sort((a, b) => a.weekKey.localeCompare(b.weekKey))
  
  return results
}

/**
 * Compute the Comment Health Index from raw comments. Groups comments into
 * per-product tallies (tagged with their department) and delegates all of the
 * math to the pure computeCHI function.
 */
export function calculateBrandHealthScore(comments: Comment[]): BrandHealthResult {
  if (comments.length === 0) {
    return { score: DEFAULT_SCORE, margin: 0, topContributors: [], productCount: 0, attributedShare: 0, brandSentiment: DEFAULT_SCORE }
  }

  // Split into product-attributed comments (feed the dept-weighted ProductCHI)
  // and unattributed ones (feed the brand-level sentiment component).
  const grouped: Record<string, CHIProduct> = {}
  let brandPos = 0
  let brandNeg = 0
  let brandNeu = 0
  let attributed = 0

  for (const c of comments) {
    if (!c.product || c.product === "General") {
      if (c.sentiment === "positive") brandPos++
      else if (c.sentiment === "negative") brandNeg++
      else brandNeu++
      continue
    }
    attributed++
    if (!grouped[c.product]) {
      // Prefer the comment's stored department (MX/VD/DA), normalising DA → HA
      // to match DEPT_WEIGHTS; fall back to deriving it from the product name.
      const department = normalizeDepartment(c.department) ?? getProductDepartment(c.product)
      grouped[c.product] = {
        product: c.product,
        department,
        pos: 0,
        neg: 0,
        neu: 0,
      }
    }
    const bucket = grouped[c.product]
    if (c.sentiment === "positive") bucket.pos++
    else if (c.sentiment === "negative") bucket.neg++
    else bucket.neu++
  }

  const { chi, margin: productMargin, drivers } = computeCHI(Object.values(grouped))

  // Brand-level sentiment over unattributed comments (same S definition).
  const brandN = brandPos + brandNeg + brandNeu
  const brandSentiment = brandN > 0 ? ((brandPos + 0.5 * brandNeu) / brandN) * 100 : DEFAULT_SCORE
  const brandPSmooth = (brandPos + 1) / (brandN + 2)
  const brandSE = brandN > 0 ? Math.sqrt((brandPSmooth * (1 - brandPSmooth)) / brandN) : 0

  // Blend by attribution coverage: with no attributed comments the index is
  // pure brand sentiment; as attribution improves, product health takes over.
  const alpha = comments.length > 0 ? attributed / comments.length : 0
  const score = alpha * chi + (1 - alpha) * brandSentiment
  const margin = Math.round(
    Math.sqrt((alpha * productMargin) ** 2 + ((1 - alpha) * 1.96 * brandSE * 100) ** 2),
  )

  const topContributors: ProductContribution[] = drivers.map((d) => ({
    product: d.product,
    department: d.department,
    sentimentScore: d.sentiment,
    contributionWeight: d.contributionWeight,
    contributionShare: d.share,
    totalComments: d.totalComments,
  }))

  return {
    score: Math.max(0, Math.min(100, Math.round(score))),
    margin,
    topContributors,
    productCount: topContributors.length,
    attributedShare: Math.round(alpha * 100),
    brandSentiment: Math.round(brandSentiment),
  }
}
