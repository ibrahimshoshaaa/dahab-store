/** Read every page before publishing a complete report snapshot. */
export async function collectReportOrders(fetchPage) {
  const orders = []
  let page = 1
  let totalPages = 1
  do {
    const result = await fetchPage({ page, limit: 50 })
    if (!Array.isArray(result.orders) || !Number.isInteger(result.pagination?.totalPages) || result.pagination.totalPages < 1) {
      throw new Error("Invalid orders response")
    }
    orders.push(...result.orders)
    totalPages = result.pagination.totalPages
    page += 1
  } while (page <= totalPages)
  return [...new Map(orders.map(order => [order.id, order])).values()]
}
