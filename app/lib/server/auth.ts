import crypto from "node:crypto"
import { db } from "./db"

// Production credentials must come from environment variables. No hard-coded
// fallback credentials are allowed.
const ADMIN_USER = process.env.ADMIN_USER || ""
const ADMIN_PASS = process.env.ADMIN_PASS || ""
const ADMIN_USER_2 = process.env.ADMIN_USER_2 || ""
const ADMIN_PASS_2 = process.env.ADMIN_PASS_2 || ""
const ADMINS = [{ username: ADMIN_USER, password: ADMIN_PASS }, { username: ADMIN_USER_2, password: ADMIN_PASS_2 }]
  .filter((account, index) => account.username && account.password && (index === 0 || account.username !== ADMIN_USER))
const SECRET = process.env.ADMIN_TOKEN_SECRET || ""
const TTL_SECONDS = Math.max(300, Number(process.env.ADMIN_TOKEN_TTL_SECONDS || 60 * 60 * 8))

type Payload = { sub: string; jti: string; iat: number; exp: number }
function b64(data: string) { return Buffer.from(data).toString("base64url") }
function unb64(data: string) { return Buffer.from(data, "base64url").toString("utf8") }
function configured() { return Boolean(ADMINS.length && SECRET && SECRET.length >= 32) }
function sign(value: string) {
  if (!configured()) throw new Error("Admin authentication is not configured")
  return crypto.createHmac("sha256", SECRET).update(value).digest("base64url")
}
function safeEqual(a: string, b: string) {
  const aa = Buffer.from(a), bb = Buffer.from(b)
  if (aa.length !== bb.length) return false
  return crypto.timingSafeEqual(aa, bb)
}

export function verifyAdminCredentials(username: unknown, password: unknown) {
  if (!configured()) return false
  if (typeof username !== "string" || typeof password !== "string") return false
  return ADMINS.some(account => safeEqual(username, account.username) && safeEqual(password, account.password))
}

export async function createAdminToken(username: string) {
  if (!configured()) throw new Error("Admin authentication is not configured")
  if (!ADMINS.some(account => account.username === username)) throw new Error("Unknown admin account")
  await db.execute("DELETE FROM admin_sessions WHERE expires_at <= CURRENT_TIMESTAMP")
  await db.execute("DELETE FROM rate_limits WHERE window_start < strftime('%s','now') - 86400")
  const now = Math.floor(Date.now() / 1000)
  const payload: Payload = { sub: username, jti: crypto.randomUUID(), iat: now, exp: now + TTL_SECONDS }
  await db.execute({ sql: "INSERT INTO admin_sessions(jti, expires_at) VALUES (?, datetime(?, 'unixepoch'))", args: [payload.jti, payload.exp] })
  const encoded = b64(JSON.stringify(payload))
  return `${encoded}.${sign(encoded)}`
}

export function parseAdminToken(token: string | null | undefined): Payload | null {
  if (!token || !configured()) return null
  const dot = token.lastIndexOf(".")
  if (dot <= 0) return null
  const encoded = token.slice(0, dot), signature = token.slice(dot + 1)
  let expected: string
  try { expected = sign(encoded) } catch { return null }
  if (!safeEqual(signature, expected)) return null
  try {
    const p = JSON.parse(unb64(encoded)) as Payload
    const now = Math.floor(Date.now() / 1000)
    if (!p?.jti || !ADMINS.some(account => account.username === p.sub) || !Number.isInteger(p.exp) || !Number.isInteger(p.iat) || p.exp <= now || p.iat > now + 60 || p.exp <= p.iat) return null
    return p
  } catch { return null }
}

export async function isValidAdminToken(token: string | null | undefined) {
  const payload = parseAdminToken(token)
  if (!payload) return false
  const r = await db.execute({ sql: "SELECT 1 FROM admin_sessions WHERE jti=? AND revoked_at IS NULL AND expires_at > CURRENT_TIMESTAMP", args: [payload.jti] })
  return !!r.rows[0]
}
export function getBearerToken(request: Request) {
  const h = request.headers.get("authorization") || ""
  return h.startsWith("Bearer ") ? h.slice(7) : null
}

export function getAdminTokenFromRequest(request: Request) {
  const bearer = getBearerToken(request)
  if (bearer) return bearer
  const cookie = request.headers.get("cookie") || ""
  const match = cookie.match(/(?:^|;\s*)dahab_admin_token=([^;]+)/)
  return match ? decodeURIComponent(match[1]) : null
}

export async function requireAdmin(request: Request) {
  return isValidAdminToken(getAdminTokenFromRequest(request))
}
export async function revokeAdminToken(token: string | null | undefined) {
  const p = parseAdminToken(token)
  if (!p) return false
  const r = await db.execute({ sql: "UPDATE admin_sessions SET revoked_at=CURRENT_TIMESTAMP WHERE jti=? AND revoked_at IS NULL", args: [p.jti] })
  return r.rowsAffected > 0
}
