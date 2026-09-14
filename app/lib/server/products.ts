import { db, ensureDb } from "./db"
import { parseProduct } from "./utils"
import type { Product } from "../../data/products"

export type PublicProduct = Product & {
  active?: boolean
}

export async function getPublicProductBySlug(
  slug: string
): Promise<PublicProduct | null> {
  await ensureDb()

  const result = await db.execute({
    sql: "SELECT * FROM products WHERE slug = ? AND active = 1 LIMIT 1",
    args: [slug],
  })

  const row = result.rows[0]
  if (!row) return null

  return parseProduct(row as Record<string, unknown>) as PublicProduct
}
