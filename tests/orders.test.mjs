import { test } from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { createClient } from "@libsql/client"
import { createSchema } from "../app/lib/server/schema.mjs"

// This test spins up a real (local, throwaway) SQLite database via @libsql/client
// and drives the actual POST /api/orders route handler end-to-end — same code
// path used in production, including the write transaction. It exists because
// a wrong tx.execute() call once slipped past `tsc --noEmit` (the transaction
// was typed `any`) and only failed silently in production as a false
// "product unavailable" error. This test would have caught it before deploy.

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dbFile = path.join(__dirname, "tmp", `orders-test-${process.pid}.db`)

fs.mkdirSync(path.dirname(dbFile), { recursive: true })
for (const suffix of ["", "-wal", "-shm"]) {
  if (fs.existsSync(dbFile + suffix)) fs.rmSync(dbFile + suffix)
}

process.env.TURSO_DATABASE_URL = `file:${dbFile}`
process.env.ADMIN_USER ||= "test-admin"
process.env.ADMIN_PASS ||= "test-password"
process.env.ADMIN_TOKEN_SECRET ||= "0".repeat(32)

const setupDb = createClient({ url: process.env.TURSO_DATABASE_URL })
await createSchema(setupDb)

const seeded = await setupDb.execute({
  sql: `INSERT INTO products (slug, name, category, price, image, stock, active)
        VALUES ('test-abaya', 'عبايه تجريبية', 'abayas', 500, 'https://example.com/x.jpg', 5, 1)`,
  args: [],
})
const productId = Number(seeded.lastInsertRowid)

// Import the route AFTER the env var + schema are ready, since db.ts reads
// TURSO_DATABASE_URL and opens the connection at module-load time.
const { POST } = await import("../app/api/[[...path]]/route.ts")

function orderRequest(body) {
  return new Request("http://localhost/api/orders", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
}

function ctx() {
  return { params: Promise.resolve({ path: ["orders"] }) }
}

function validOrderBody(overrides = {}) {
  return {
    customer_name: "عميل تجريبي",
    phone: "01022336699",
    governorate: "الغربية",
    area: "طنطا",
    address: "شارع تجريبي",
    notes: "",
    total: 500,
    items: [{ product_id: productId, quantity: 1 }],
    idempotency_key: crypto.randomUUID(),
    ...overrides,
  }
}

test("creates an order for an available product and decrements stock", async () => {
  const res = await POST(orderRequest(validOrderBody()), ctx())
  const data = await res.json()

  assert.equal(res.status, 201, `expected 201, got ${res.status}: ${JSON.stringify(data)}`)
  assert.equal(data.success, true)
  assert.ok(data.order_id)
  assert.ok(data.tracking_code)

  const remaining = await setupDb.execute({ sql: "SELECT stock FROM products WHERE id=?", args: [productId] })
  assert.equal(Number(remaining.rows[0].stock), 4, "stock should be decremented by the ordered quantity")
})

test("rejects an order for a product that no longer exists", async () => {
  const res = await POST(orderRequest(validOrderBody({
    items: [{ product_id: productId + 999, quantity: 1 }],
    idempotency_key: crypto.randomUUID(),
  })), ctx())
  const data = await res.json()

  assert.equal(res.status, 400)
  assert.equal(data.success, false)
})

test("rejects an order that exceeds available stock", async () => {
  const res = await POST(orderRequest(validOrderBody({
    items: [{ product_id: productId, quantity: 999 }],
    total: 500 * 999,
    idempotency_key: crypto.randomUUID(),
  })), ctx())
  const data = await res.json()

  assert.equal(res.status, 409)
  assert.equal(data.success, false)
})

test("replaying the same idempotency key returns the original order instead of creating a duplicate", async () => {
  const key = crypto.randomUUID()
  const first = await POST(orderRequest(validOrderBody({ idempotency_key: key })), ctx())
  const firstData = await first.json()
  assert.equal(first.status, 201)

  const second = await POST(orderRequest(validOrderBody({ idempotency_key: key })), ctx())
  const secondData = await second.json()

  assert.equal(secondData.order_id, firstData.order_id, "replay should return the same order_id, not create a new one")

  const count = await setupDb.execute({
    sql: "SELECT COUNT(*) AS n FROM orders WHERE idempotency_key=?",
    args: [key],
  })
  assert.equal(Number(count.rows[0].n), 1, "only one order row should exist for this idempotency key")
})

test.after(() => {
  setupDb.close()
  for (const suffix of ["", "-wal", "-shm"]) {
    if (fs.existsSync(dbFile + suffix)) fs.rmSync(dbFile + suffix)
  }
})
