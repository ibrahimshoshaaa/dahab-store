import type { MetadataRoute } from "next"
import { db, ensureDb } from "./lib/server/db"

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "https://www.ninetypay.com"
  let products: any[] = []

  try {
    await ensureDb()
    const result = await db.execute("SELECT * FROM products WHERE active = 1 ORDER BY id DESC")
    products = result.rows as any[]
  } catch {
    // Keep sitemap generation resilient if Turso is unavailable during a build.
  }

  return [
    { url: base, changeFrequency: "daily", priority: 1 },
    { url: `${base}/products`, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/contact`, changeFrequency: "monthly", priority: 0.4 },
    { url: `${base}/shipping`, changeFrequency: "monthly", priority: 0.4 },
    { url: `${base}/returns`, changeFrequency: "monthly", priority: 0.4 },
    ...products.map((p) => ({
      url: `${base}/products/${p.slug}`,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
  ]
}
