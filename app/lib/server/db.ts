import crypto from "node:crypto"
import { createClient } from "@libsql/client"

export const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
})

export function generateTrackingCode() {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
  const bytes = crypto.randomBytes(8)
  let code = ""
  for (let i = 0; i < 8; i++) code += alphabet[bytes[i] % alphabet.length]
  return code
}

export async function initDb() {
  throw new Error("Database migrations must be run separately with: npm run db:migrate")
}

let dbInitPromise: Promise<void> | null = null

export function ensureDb() {
  if (!dbInitPromise) {
    dbInitPromise = initDb().catch((error) => {
      dbInitPromise = null
      throw error
    })
  }
  return dbInitPromise
}
