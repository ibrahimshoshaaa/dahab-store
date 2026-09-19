import type { Metadata } from "next"
import { unstable_cache } from "next/cache"
import "./globals.css"
import { CartProvider } from "./context/CartContext"
import { FavoritesProvider } from "./context/FavoritesContext"
import PwaRegister from "./components/PwaRegister"
import { db, ensureDb } from "./lib/server/db"
import {
  resolveTheme,
  buildGoogleFontsUrl,
  findFont,
  BODY_FONT_OPTIONS,
  HEADING_FONT_OPTIONS,
  DEFAULT_THEME,
} from "./lib/theme"

// نجيب إعدادات الثيم بكاش قصير (ISR) بدل no-store، عشان الموقع يفضل
// صفحات ثابتة/سريعة، وفي نفس الوقت أي تغيير من لوحة الأدمن يظهر خلال دقيقة.
const fetchThemeSettings = unstable_cache(
  async (): Promise<Record<string, string>> => {
    try {
      await ensureDb()
      const result = await db.execute("SELECT key,value FROM settings")
      const rows = result.rows as unknown as Array<{ key: unknown; value: unknown }>
      return Object.fromEntries(rows.map((row) => [String(row.key), String(row.value)]))
    } catch {
      return {}
    }
  },
  ["dahab-theme-settings"],
  { revalidate: 60, tags: ["settings"] }
)

export const metadata: Metadata = {
  title: "DAHAB | دهب — عبايات وإكسسوارات",
  description: "دهب — عبايات مصرية وإكسسوارات مختارة بعناية.",
  applicationName: "DAHAB",
  keywords: ["دهب", "Dahab", "عبايات", "عبايات مصرية", "إكسسوارات"],
  alternates: { canonical: "/" },
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://dahab-store.vercel.app"),
  openGraph: {
    title: "DAHAB | دهب",
    description: "عبايات مصرية وإكسسوارات مختارة بعناية.",
    type: "website",
    locale: "ar_EG",
    url: "/",
    siteName: "DAHAB",
  },
  twitter: {
    card: "summary_large_image",
    title: "DAHAB | دهب",
    description: "عبايات مصرية وإكسسوارات مختارة بعناية.",
  },
  robots: { index: true, follow: true },
  appleWebApp: {
    capable: true,
    title: "DAHAB",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.svg", sizes: "192x192", type: "image/svg+xml" },
      { url: "/icons/icon-512.svg", sizes: "512x512", type: "image/svg+xml" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.svg", sizes: "512x512", type: "image/svg+xml" }],
  },
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const settings = await fetchThemeSettings()
  const theme = resolveTheme(settings)
  const bodyFont = findFont(BODY_FONT_OPTIONS, theme.bodyFont, DEFAULT_THEME.bodyFont)
  const headingFont = findFont(HEADING_FONT_OPTIONS, theme.headingFont, DEFAULT_THEME.headingFont)
  const fontsUrl = buildGoogleFontsUrl(theme)

  return (
    <html lang="ar" dir="rtl">
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <link rel="preconnect" href="https://images.unsplash.com" />
        <link rel="dns-prefetch" href="//images.unsplash.com" />
        {/* eslint-disable-next-line @next/next/no-css-tags */}
        <link rel="stylesheet" href={fontsUrl} />
        <style
          // متغيرات الثيم — بتتغيّر لحظيًا مع أي تعديل في لوحة الأدمن (الشكل العام)
          dangerouslySetInnerHTML={{
            __html: `:root{
              --brand:${theme.brand};
              --brand-dark:${theme.brandDark};
              --ink:${theme.ink};
              --bg:${theme.bg};
              --font-body:${bodyFont.family};
              --font-heading:${headingFont.family};
            }`,
          }}
        />
      </head>
      <body>
        <PwaRegister />
        <CartProvider>
          <FavoritesProvider>{children}</FavoritesProvider>
        </CartProvider>
      </body>
    </html>
  )
}
