// Screenshot pages for visual verification. Usage:
//   npx -y playwright@latest screenshot ... (we drive the API directly)
import { chromium } from "playwright"

const base = process.argv[2] || "http://localhost:3000"
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } })

for (const [name, path, waitMs] of [
  ["home", "/", 2500],
  ["dashboard-top", "/dashboard", 9000],
]) {
  await page.goto(`${base}${path}`, { waitUntil: "networkidle", timeout: 90000 }).catch(() => {})
  await page.waitForTimeout(waitMs)
  await page.screenshot({ path: `screenshots/${name}.png` })
  console.log(`saved screenshots/${name}.png`)
}

// scroll mid-dashboard for a second shot
await page.evaluate(() => window.scrollBy(0, 1800))
await page.waitForTimeout(1500)
await page.screenshot({ path: "screenshots/dashboard-mid.png" })
console.log("saved screenshots/dashboard-mid.png")

await browser.close()
