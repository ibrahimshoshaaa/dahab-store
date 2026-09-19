export type SizeChart = {
  columns: string[]
  rows: string[][]
}

export type Product = {
  id: number
  slug: string
  name: string
  category: "عبايات" | "إكسسوارات"
  price: number
  oldPrice?: number
  image: string
  images?: string[]
  badge?: string
  colors: string[]
  sizes: string[]
  description: string
  featured?: boolean
  bestSeller?: boolean
  sizeChart?: SizeChart
  materialDetails?: string
  careInstructions?: string
  stock?: number
  lowStockThreshold?: number
  variantStock?: Record<string, number>
}
