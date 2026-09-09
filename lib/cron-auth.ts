// Central gate for the admin/cron endpoints that start paid work (Apify
// actor runs, LLM analysis) or write to the database.
//
// The repo's code is not a secret, so anything a request body can say
// ("manual": true) is not authentication — every trigger requires the
// CRON_SECRET bearer. Vercel's cron sends the bearer automatically once the
// CRON_SECRET env var exists on the project, and the GitHub Actions
// workflows send it from the repo secret of the same name. The
// x-vercel-cron-schedule header is spoofable by any caller and must not be
// trusted on its own.
export function isAuthorizedCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET
  // Fail closed: without the env var no trigger works at all.
  if (!secret) return false
  return request.headers.get("authorization") === `Bearer ${secret}`
}
