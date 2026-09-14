"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Eye, EyeOff, LockKeyhole, ShieldCheck, UserRound } from "lucide-react"
import { adminLogin } from "../../lib/api"
import SiteLogo from "../../components/SiteLogo"

export default function AdminLoginPage() {
  const router = useRouter()
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    if (!username.trim() || !password) {
      setError("اكتب اسم المستخدم وكلمة المرور")
      return
    }
    setLoading(true)
    try {
      await adminLogin(username.trim(), password)
      router.replace("/admin")
    } catch (err) {
      setError(err instanceof Error ? err.message : "بيانات الدخول غير صحيحة")
    } finally {
      setLoading(false)
    }
  }

  return (
    <main dir="rtl" className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[var(--ink)] px-5 py-10">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(164,131,67,.24),transparent_35%),radial-gradient(circle_at_85%_80%,rgba(164,131,67,.16),transparent_35%)]" />
      <div className="relative w-full max-w-md">
        <div className="mb-6 text-center text-white">
          <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-3xl border border-[var(--brand)]/50 bg-white p-4 shadow-2xl">
            <SiteLogo className="h-full w-full object-contain" alt="DAHAB" />
          </div>
          <p className="text-[10px] tracking-[0.45em] text-[var(--brand-soft)]">DAHAB</p>
          <h1 className="mt-2 text-2xl font-light">لوحة تحكم دهب</h1>
          <p className="mt-2 text-sm text-white/55">إدارة المتجر والمحتوى والطلبات من مكان واحد</p>
        </div>

        <form onSubmit={handleSubmit} className="rounded-[2rem] border border-white/10 bg-white p-7 shadow-2xl sm:p-9">
          <div className="mb-7 flex items-center gap-3 rounded-2xl bg-[var(--bg)] p-4">
            <ShieldCheck className="text-[var(--brand)]" size={21} />
            <div>
              <p className="text-sm font-semibold">دخول آمن للأدمن</p>
              <p className="mt-0.5 text-xs text-gray-500">الوصول مخصص للمستخدم الإداري فقط</p>
            </div>
          </div>

          <label className="mb-5 block">
            <span className="mb-2 block text-sm font-medium">اسم المستخدم</span>
            <div className="relative">
              <UserRound className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" className="w-full rounded-2xl border border-black/10 bg-white py-3.5 pr-11 pl-4 text-sm outline-none transition focus:border-[var(--brand)] focus:ring-4 focus:ring-[var(--brand)]/10" placeholder="اسم المستخدم" />
            </div>
          </label>

          <label className="mb-6 block">
            <span className="mb-2 block text-sm font-medium">كلمة المرور</span>
            <div className="relative">
              <LockKeyhole className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" className="w-full rounded-2xl border border-black/10 bg-white py-3.5 pr-11 pl-12 text-sm outline-none transition focus:border-[var(--brand)] focus:ring-4 focus:ring-[var(--brand)]/10" placeholder="كلمة المرور" />
              <button type="button" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"} className="absolute left-3 top-1/2 -translate-y-1/2 rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700">
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </label>

          {error && <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-center text-sm text-red-700">{error}</div>}

          <button type="submit" disabled={loading} className="w-full rounded-2xl bg-[var(--ink)] py-4 text-sm font-medium text-white shadow-lg transition hover:bg-[var(--brand)] disabled:cursor-not-allowed disabled:opacity-60">
            {loading ? "جارِ تأمين الدخول..." : "دخول إلى لوحة التحكم"}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-white/35">DAHAB ADMIN • متجر دهب</p>
      </div>
    </main>
  )
}
