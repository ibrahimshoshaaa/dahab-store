import { db, ensureDb } from "./db"
import { parseProduct } from "./utils"
import type { Product } from "../../data/products"

export type PublicProduct = Product & {
  active?: boolean
}

const PUBLIC_PRODUCT_COLUMNS = [
  "id","slug","name","category","price","old_price","image","images","badge",
  "colors","sizes","description","featured","best_seller","active","size_chart",
  "material_details","care_instructions","stock","low_stock_threshold","variant_stock",
].join(",")

export async function getPublicProductBySlug(
  slug: string
): Promise<PublicProduct | null> {
  await ensureDb()

  const result = await db.execute({
    sql: `SELECT ${PUBLIC_PRODUCT_COLUMNS} FROM products WHERE slug = ? AND active = 1 LIMIT 1`,
    args: [slug],
  })

  const row = result.rows[0]
  if (!row) return null

  return parseProduct(row as Record<string, unknown>) as PublicProduct
}
