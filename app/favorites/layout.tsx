import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Favorites | DAHAB",
  robots: { index: false, follow: false },
}

export default function PageLayout({ children }: { children: React.ReactNode }) {
  return children
}
