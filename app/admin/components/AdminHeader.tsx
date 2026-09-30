"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Menu, X, ChevronDown, LayoutDashboard, LogOut, House, ShoppingBag, Package, Boxes } from "lucide-react"
import SiteLogo from "../../components/SiteLogo"

const groups = [
  {
    label: "المبيعات",
    items: [
      { href: "/admin/orders", label: "الطلبات" },
      { href: "/admin/customers", label: "العملاء" },
      { href: "/admin/reports", label: "التقارير" },
      { href: "/admin/analytics", label: "تحليلات العملاء" },
    ],
  },
  {
    label: "المنتجات والمخزون",
    items: [
      { href: "/admin/products", label: "المنتجات" },
      { href: "/admin/inventory", label: "المخزون" },
      { href: "/admin/coupons", label: "العروض" },
      { href: "/admin/reviews", label: "التقييمات" },
    ],
  },
  {
    label: "إدارة الموقع",
    items: [
      { href: "/admin/homepage", label: "الصفحة الرئيسية" },
      { href: "/admin/pages", label: "الصفحات الثابتة" },
      { href: "/admin/theme", label: "الشكل العام" },
    ],
  },
  {
    label: "التواصل",
    items: [
      { href: "/admin/messages", label: "الرسائل" },
      { href: "/admin/notifications", label: "الإشعارات" },
    ],
  },
]

const mobileLinks = [
  { href: "/admin", label: "الرئيسية", icon: House },
  { href: "/admin/orders", label: "الطلبات", icon: ShoppingBag },
  { href: "/admin/products", label: "المنتجات", icon: Package },
  { href: "/admin/inventory", label: "المخزون", icon: Boxes },
]

export default function AdminHeader({
  maxWidthClass = "max-w-7xl",
  unreadCount = 0,
  onLogout,
}: {
  maxWidthClass?: string
  unreadCount?: number
  onLogout: () => void
}) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [openGroup, setOpenGroup] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false)
    }
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [open])

  function isActive(href: string) {
    return href === "/admin" ? pathname === "/admin" : (pathname === href || pathname.startsWith(`${href}/`))
  }

  function groupIsActive(items: { href: string }[]) {
    return items.some((item) => isActive(item.href))
  }

  return (
    <>
    <header className="sticky top-0 z-40 border-b border-black/10 bg-white/95 backdrop-blur">
      <div className={`mx-auto flex ${maxWidthClass} items-center justify-between px-4 py-4 sm:px-5`}>
        <Link href="/admin" className="flex items-center gap-3" onClick={() => setOpen(false)}>
          <SiteLogo className="h-9 w-auto object-contain sm:h-10" alt="DAHAB" />
          <span className="h-6 w-px bg-black/10" />
          <span className="flex items-center gap-1.5 text-sm font-medium text-gray-600">
            <LayoutDashboard size={16} />
            لوحة التحكم
            <span className="text-xs font-normal text-gray-400">ADMIN</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-2 text-sm md:flex">
          <Link
            href="/admin"
            className={`rounded-xl px-3 py-2 transition ${isActive("/admin") ? "bg-black text-white" : "text-gray-500 hover:bg-gray-100"}`}
          >
            الرئيسية
          </Link>

          {groups.map((group) => {
            const active = groupIsActive(group.items)
            return (
              <div key={group.label} className="relative">
                <button
                  type="button"
                  onClick={() => setOpenGroup((v) => (v === group.label ? null : group.label))}
                  className={`flex items-center gap-1 rounded-xl px-3 py-2 transition ${active ? "bg-black text-white" : "text-gray-500 hover:bg-gray-100"}`}
                >
                  {group.label}
                  <ChevronDown size={14} className={openGroup === group.label ? "rotate-180 transition" : "transition"} />
                </button>
                {openGroup === group.label && (
                  <div className="absolute right-0 top-full mt-2 min-w-48 overflow-hidden rounded-2xl border border-black/10 bg-white p-1.5 shadow-xl">
                    {group.items.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setOpenGroup(null)}
                        className={`flex items-center justify-between rounded-xl px-3 py-2.5 text-sm ${isActive(item.href) ? "bg-gray-100 font-medium text-black" : "text-gray-600 hover:bg-gray-50"}`}
                      >
                        {item.label}
                        {item.href === "/admin/messages" && unreadCount > 0 && (
                          <span className="rounded-full bg-[var(--brand)] px-1.5 py-0.5 text-[10px] text-white">{unreadCount}</span>
                        )}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )
          })}

          <button
            onClick={onLogout}
            className="ml-1 flex items-center gap-1.5 rounded-xl px-3 py-2 text-gray-500 hover:bg-gray-100"
          >
            <LogOut size={15} />
            خروج
          </button>
        </nav>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "إغلاق القائمة" : "فتح القائمة"}
          aria-expanded={open}
          aria-controls="admin-mobile-menu"
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-black/10 text-gray-600 md:hidden"
        >
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

    </header>

      {open && (
        <>
        <button type="button" aria-label="إغلاق القائمة" onClick={() => setOpen(false)} className="menu-backdrop fixed inset-0 z-30 bg-black/30 md:hidden" />
        <nav id="admin-mobile-menu" aria-label="كل أقسام الإدارة" className="menu-backdrop fixed inset-x-3 top-20 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-40 overflow-y-auto overscroll-contain rounded-2xl border border-black/10 bg-white px-4 py-3 shadow-xl md:hidden">
          <Link
            href="/admin"
            onClick={() => setOpen(false)}
            className={`mb-1 flex items-center gap-2 rounded-xl px-3 py-3 text-sm ${isActive("/admin") ? "bg-black text-white" : "text-gray-600 hover:bg-gray-50"}`}
          >
            <LayoutDashboard size={17} /> الرئيسية
          </Link>

          <div className="space-y-1">
            {groups.map((group) => {
              const active = groupIsActive(group.items)
              const expanded = openGroup === group.label
              return (
                <div key={group.label} className="overflow-hidden rounded-xl border border-black/5">
                  <button
                    type="button"
                    onClick={() => setOpenGroup((v) => (v === group.label ? null : group.label))}
                    className={`flex w-full items-center justify-between px-3 py-3 text-right text-sm ${active ? "font-medium text-black" : "text-gray-600"}`}
                  >
                    <span>{group.label}</span>
                    <ChevronDown size={17} className={expanded ? "rotate-180 transition" : "transition"} />
                  </button>
                  {expanded && (
                    <div className="border-t border-black/5 bg-gray-50/70 px-2 py-1.5">
                      {group.items.map((item) => (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => { setOpen(false); setOpenGroup(null) }}
                          className={`flex items-center justify-between rounded-lg px-3 py-2.5 text-sm ${isActive(item.href) ? "bg-white font-medium text-black shadow-sm" : "text-gray-500"}`}
                        >
                          {item.label}
                          {item.href === "/admin/messages" && unreadCount > 0 && (
                            <span className="rounded-full bg-[var(--brand)] px-1.5 py-0.5 text-[10px] text-white">{unreadCount}</span>
                          )}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          <button
            onClick={() => { setOpen(false); onLogout() }}
            className="mt-2 flex w-full items-center gap-2 rounded-xl px-3 py-3 text-right text-sm text-gray-500 hover:bg-gray-50"
          >
            <LogOut size={17} /> تسجيل الخروج
          </button>
        </nav>
        </>
      )}

      <nav aria-label="التنقل السريع للإدارة" dir="rtl" className="admin-bottom-nav fixed inset-x-0 bottom-0 z-40 border-t border-black/10 bg-white/95 px-2 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] shadow-[0_-4px_24px_rgba(0,0,0,0.04)] backdrop-blur md:hidden">
        <div className="mx-auto grid max-w-lg grid-cols-5 gap-1">
          {mobileLinks.map(({ href, label, icon: Icon }) => {
            const active = !open && isActive(href)
            const featured = href === "/admin/products"
            return (
              <Link key={href} href={href} aria-current={active ? "page" : undefined} onClick={() => { setOpen(false); setOpenGroup(null) }} className={`flex min-h-16 min-w-0 flex-col items-center justify-center gap-1 rounded-2xl px-1 py-1.5 text-[11px] font-medium transition-colors ${active ? "bg-[var(--brand-tint)] text-[var(--brand-dark)]" : "text-gray-500 hover:bg-[var(--brand-tint)]"}`}>
                <span className={featured ? "flex h-9 w-9 items-center justify-center rounded-full bg-[var(--brand)] text-white shadow-sm" : "flex h-9 w-9 items-center justify-center"}>
                  <Icon size={featured ? 21 : 23} aria-hidden="true" />
                </span>
                <span>{label}</span>
              </Link>
            )
          })}
          <button type="button" aria-expanded={open} aria-controls="admin-mobile-menu" onClick={() => { setOpen((v) => !v); setOpenGroup(null) }} className={`relative flex min-h-16 min-w-0 flex-col items-center justify-center gap-1 rounded-2xl px-1 py-1.5 text-[11px] font-medium transition-colors ${open || !mobileLinks.some((item) => isActive(item.href)) ? "bg-[var(--brand-tint)] text-[var(--brand-dark)]" : "text-gray-500 hover:bg-[var(--brand-tint)]"}`}>
            <span className="relative flex h-9 w-9 items-center justify-center">
              {open ? <X size={23} aria-hidden="true" /> : <Menu size={23} aria-hidden="true" />}
              {unreadCount > 0 && <span aria-label={`${unreadCount} رسائل غير مقروءة`} className="absolute -top-1 -right-1 rounded-full bg-[var(--brand)] px-1.5 text-[9px] text-white">{unreadCount > 99 ? "99+" : unreadCount}</span>}
            </span>
            <span>المزيد</span>
          </button>
        </div>
      </nav>
    </>
  )
}
