import { db } from "./db"

export async function rateLimit(key: string, limit: number, windowSeconds: number) {
  const now = Math.floor(Date.now()/1000), start = Math.floor(now/windowSeconds)*windowSeconds
  // Atomic upsert: concurrent requests cannot both increment beyond the configured limit.
  await db.execute({ sql: `INSERT INTO rate_limits(key,window_start,count,updated_at) VALUES(?,?,1,CURRENT_TIMESTAMP)
    ON CONFLICT(key) DO UPDATE SET count=CASE WHEN rate_limits.window_start=? THEN rate_limits.count+1 ELSE 1 END, window_start=CASE WHEN rate_limits.window_start=? THEN rate_limits.window_start ELSE ? END, updated_at=CURRENT_TIMESTAMP`, args:[key,start,start,start,start] })
  const r=await db.execute({sql:"SELECT count,window_start FROM rate_limits WHERE key=?",args:[key]})
  const count=Number(r.rows[0]?.count||0), ok=count<=limit
  return { ok, remaining: Math.max(0,limit-count), reset: start+windowSeconds }
}
export function clientIp(request: Request) { return (request.headers.get("x-forwarded-for")||request.headers.get("x-real-ip")||"unknown").split(",")[0].trim().slice(0,100) }
