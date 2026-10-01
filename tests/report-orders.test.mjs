import { test } from "node:test"
import assert from "node:assert/strict"
import { collectReportOrders } from "../app/lib/report-orders.mjs"

test("reports extract orders from the paginated response and include later pages", async () => {
  const calls = []
  const orders = await collectReportOrders(async options => {
    calls.push(options)
    return { orders: [{ id: options.page, total: options.page * 100 }], pagination: { totalPages: 3 } }
  })
  assert.deepEqual(calls, [1, 2, 3].map(page => ({ page, limit: 50 })))
  assert.equal(orders.reduce((total, order) => total + order.total, 0), 600)
})
test("reports handle an empty store", async () => {
  assert.deepEqual(await collectReportOrders(async () => ({ orders: [], pagination: { totalPages: 1 } })), [])
})
test("reports reject a later-page failure rather than displaying incomplete totals", async () => {
  await assert.rejects(collectReportOrders(async ({ page }) => {
    if (page === 2) throw new Error("offline")
    return { orders: [{ id: 1 }], pagination: { totalPages: 2 } }
  }), /offline/)
})
