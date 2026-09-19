import type { Metadata } from "next"

export const metadata: Metadata = {
  alternates: { canonical: "/products" },
  robots: { index: true, follow: true },
}

export default function ProductsLayout({ children }: { children: React.ReactNode }) {
  return children
}
