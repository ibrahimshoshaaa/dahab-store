import type { Metadata } from "next"
import { notFound } from "next/navigation"
import ProductDetailsClient from "./ProductDetailsClient"
import { getPublicProductBySlug } from "../../lib/server/products"

type PageProps = {
  params: Promise<{ slug: string }>
}

function productDescription(description: string, name: string) {
  const text = (description || `${name} من DAHAB`).trim()
  return text.length > 160 ? `${text.slice(0, 157).trim()}...` : text
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params
  const product = await getPublicProductBySlug(slug)

  if (!product) {
    return {
      title: "المنتج غير موجود | DAHAB",
      robots: { index: false, follow: false },
    }
  }

  const description = productDescription(product.description, product.name)
  const productUrl = `/products/${encodeURIComponent(product.slug)}`
  const images = product.images?.length
    ? product.images
    : product.image
      ? [product.image]
      : []

  return {
    title: `${product.name} | DAHAB`,
    description,
    alternates: {
      canonical: productUrl,
    },
    openGraph: {
      title: `${product.name} | DAHAB`,
      description,
      url: productUrl,
      type: "website",
      locale: "ar_EG",
      siteName: "DAHAB",
      images: images.map((url) => ({
        url,
        alt: product.name,
      })),
    },
    twitter: {
      card: images.length ? "summary_large_image" : "summary",
      title: `${product.name} | DAHAB`,
      description,
      images,
    },
  }
}

export default async function ProductPage({ params }: PageProps) {
  const { slug } = await params
  const product = await getPublicProductBySlug(slug)

  if (!product) {
    notFound()
  }

  return <ProductDetailsClient slug={slug} initialProduct={product} />
}
