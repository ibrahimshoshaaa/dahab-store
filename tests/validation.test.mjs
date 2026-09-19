import test from "node:test"
import assert from "node:assert/strict"
import { normalizeEgyptianPhone, sanitizeCartItems } from "../app/lib/validation.mjs"

test("accepts valid Egyptian local and international mobile numbers", () => {
  assert.equal(normalizeEgyptianPhone("01012345678"), "01012345678")
  assert.equal(normalizeEgyptianPhone("+201012345678"), "01012345678")
  assert.equal(normalizeEgyptianPhone("00201012345678"), "01012345678")
  assert.equal(normalizeEgyptianPhone("٠١٠١٢٣٤٥٦٧٨"), "01012345678")
})

test("rejects invalid Egyptian mobile numbers", () => {
  assert.equal(normalizeEgyptianPhone("201012345678"), null)
  assert.equal(normalizeEgyptianPhone("+201112345678"), null)
  assert.equal(normalizeEgyptianPhone("0101234567"), null)
})

test("sanitizes malformed persisted cart entries", () => {
  const result = sanitizeCartItems([
    { id: 1, slug: "ok", name: "منتج", price: 100, image: "/x.png", quantity: 2 },
    {},
    { id: "bad", slug: "bad", name: "bad", price: 1, image: "/x.png", quantity: 1 },
    { id: 2, slug: "too-many", name: "bad", price: 1, image: "/x.png", quantity: 101 },
  ])
  assert.equal(result.length, 1)
  assert.equal(result[0].id, 1)
  assert.equal(result[0].quantity, 2)
})
