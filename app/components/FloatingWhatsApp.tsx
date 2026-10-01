"use client"

import { usePathname } from "next/navigation"
import { useContactSettings } from "../context/ContactSettingsContext"
import { contactWhatsappUrl } from "../lib/contact-links"

export default function FloatingWhatsApp() {
  const pathname = usePathname()
  const href = contactWhatsappUrl(useContactSettings())
  if (pathname.startsWith("/admin") || !href) return null
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" aria-label="تواصل معنا على واتساب" title="تواصل معنا على واتساب"
      className="fixed right-5 bottom-[calc(1.25rem+env(safe-area-inset-bottom))] z-[90] flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg transition hover:scale-105 hover:bg-[#128C7E] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#128C7E]">
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-8 w-8" aria-hidden="true"><path d="M20.52 3.48A11.9 11.9 0 0 0 12.04 0C5.42 0 .04 5.38.04 12c0 2.12.55 4.19 1.6 6.02L0 24l6.14-1.61A11.94 11.94 0 0 0 12.03 24H12c6.62 0 12-5.38 12-12a11.92 11.92 0 0 0-3.48-8.52ZM12.03 21.97a9.94 9.94 0 0 1-5.07-1.39l-.36-.21-3.65.96.97-3.56-.23-.37A9.93 9.93 0 0 1 2.07 12c0-5.49 4.47-9.96 9.97-9.96 2.66 0 5.16 1.04 7.04 2.92A9.9 9.9 0 0 1 22 12c0 5.5-4.47 9.97-9.97 9.97Zm5.47-7.47c-.3-.15-1.77-.87-2.04-.97-.28-.1-.48-.15-.68.15-.2.3-.77.97-.95 1.17-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.48-1.77-1.65-2.07-.18-.3-.02-.46.13-.61l.45-.52c.15-.18.2-.3.3-.5.1-.2.05-.38-.03-.53-.07-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51h-.58c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.49 0 1.47 1.07 2.89 1.22 3.09.15.2 2.1 3.2 5.09 4.49.71.3 1.27.48 1.7.62.71.22 1.36.19 1.87.12.57-.09 1.77-.72 2.02-1.42.25-.7.25-1.3.18-1.42-.08-.13-.28-.2-.58-.35Z"/></svg>
    </a>
  )
}
