export function safeJsonParse<T>(value: unknown, fallback: T): T {
  try {
    const parsed = JSON.parse(String(value ?? ""))
    return (parsed ?? fallback) as T
  } catch {
    return fallback
  }
}

export function parseProduct(row: Record<string, any>) {
  const sizeChart = safeJsonParse<any>(row.size_chart, null)
  const normalizedSizeChart =
    sizeChart && Array.isArray(sizeChart.columns) && Array.isArray(sizeChart.rows)
      ? sizeChart
      : null

  return {
    ...row,
    oldPrice: row.old_price,
    colors: safeJsonParse(row.colors, []),
    sizes: safeJsonParse(row.sizes, []),
    images: safeJsonParse(row.images, []),
    sizeChart: normalizedSizeChart,
    materialDetails: row.material_details || "",
    careInstructions: row.care_instructions || "",
    featured: !!row.featured,
    bestSeller: !!row.best_seller,
    active: !!row.active,
    stock: Number(row.stock ?? 0),
    lowStockThreshold: Number(row.low_stock_threshold ?? 5),
    variantStock: safeJsonParse(row.variant_stock, {}),
  }
}

export function slugify(name: unknown) {
  const english = String(name).trim().toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
  return english || `product-${Date.now()}`
}

export function couponDiscount(coupon: any, subtotal: number, items: any[] = []) {
  if (!coupon || !coupon.active) return 0
  const now = Date.now()
  if (coupon.starts_at && new Date(coupon.starts_at).getTime() > now) return 0
  if (Number(coupon.min_order || 0) > subtotal) return 0
  if (coupon.max_uses && Number(coupon.used_count || 0) >= Number(coupon.max_uses)) return 0
  if (coupon.expires_at && new Date(coupon.expires_at).getTime() <= now) return 0
  if (Number(coupon.min_items || 0) > items.reduce((n, i) => n + Number(i.quantity || 0), 0)) return 0
  if (coupon.product_id && !items.some(i => Number(i.product_id) === Number(coupon.product_id))) return 0
  if (coupon.category && !items.some(i => String(i.category || "") === String(coupon.category))) return 0
  const raw = coupon.type === "fixed" ? Number(coupon.value) : subtotal * Number(coupon.value) / 100
  const capped = coupon.max_discount ? Math.min(raw, Number(coupon.max_discount)) : raw
  return Math.max(0, Math.min(subtotal, capped))
}

export function json(data: unknown, status = 200) {
  return Response.json(data, { status })
}

export async function readJson(request: Request) {
  try { return await request.json() } catch { return {} }
}
