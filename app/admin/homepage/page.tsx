"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Check, Clock3, GripVertical, Plus, Trash2 } from "lucide-react"
import { getAdminToken, adminLogout, fetchSettings, updateSettings, type SiteSettings } from "../../lib/api"
import AdminHeader from "../components/AdminHeader"
import ImageField from "../components/ImageField"

const HERO_KEYS = Array.from({ length: 8 }, (_, i) => `hero_image_${i + 1}`)

const FIELD_LABELS: Record<string, string> = {
  announcement_bar: "شريط الإعلان أعلى الموقع",
  hero_label: "Hero — النص الصغير",
  hero_title_line1: "Hero — السطر الأول",
  hero_title_line2: "Hero — السطر الثاني الذهبي",
  hero_subtitle: "Hero — الوصف",
  hero_button_text: "Hero — نص الزر",
  story_title_line1: "قسم القصة — السطر الأول",
  story_title_line2: "قسم القصة — السطر الثاني",
  story_body: "قسم القصة — النص",
  collection_abaya_image: "المجموعات — صورة العبايات",
  collection_accessories_image: "المجموعات — صورة الإكسسوارات",
  accessories_item1_title: "الإكسسوارات — اسم العنصر الأول",
  accessories_item3_title: "الإكسسوارات — اسم العنصر الثاني",
  footer_description: "الفوتر — وصف المتجر",
}

const TEXTAREA_KEYS = new Set(["announcement_bar", "hero_subtitle", "story_body"])
const IMAGE_KEYS = new Set(["collection_abaya_image", "collection_accessories_image", "accessories_item1_image", "accessories_item3_image"])
const TEXT_KEYS = Object.keys(FIELD_LABELS)

const DEFAULTS: SiteSettings = {
  hero_label: "DAHAB COLLECTION",
  hero_title_line1: "أناقتك...",
  hero_title_line2: "بطابع دهب",
  hero_subtitle: "عبايات مصرية بتصميمات راقية تجمع بين الاحتشام والأناقة وتناسب كل لحظة.",
  hero_button_text: "اكتشفي المجموعة",
  hero_image_1: "https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=2000&q=90",
  hero_interval_seconds: "3",
  announcement_bar: "✦ شحن لجميع المحافظات | الدفع عند الاستلام متاح",
}

export default function AdminHomepage() {
  const router = useRouter()
  const [settings, setSettings] = useState<SiteSettings>({ ...DEFAULTS })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!getAdminToken()) { router.replace("/admin/login"); return }
    fetchSettings().then((data) => setSettings((current) => ({ ...current, ...data }))).catch(() => setError("تعذر تحميل إعدادات الصفحة")).finally(() => setLoading(false))
  }, [router])

  const heroImages = useMemo(() => HERO_KEYS.map((key) => settings[key] || ""), [settings])
  const activeHeroCount = heroImages.filter(Boolean).length

  function handleChange(key: string, value: string) {
    setSaved(false)
    setSettings((prev) => ({ ...prev, [key]: value }))
  }

  function addHero() {
    const empty = HERO_KEYS.find((key) => !settings[key])
    if (empty) handleChange(empty, "")
  }

  function removeHero(key: string) {
    setSaved(false)
    const index = HERO_KEYS.indexOf(key)
    const next = { ...settings }
    for (let i = index; i < HERO_KEYS.length - 1; i++) next[HERO_KEYS[i]] = next[HERO_KEYS[i + 1]] || ""
    next[HERO_KEYS[HERO_KEYS.length - 1]] = ""
    setSettings(next)
  }

  async function handleSave() {
    const interval = Math.min(60, Math.max(1, Number(settings.hero_interval_seconds || 3)))
    setSaving(true); setSaved(false); setError("")
    try {
      await updateSettings({ ...settings, hero_interval_seconds: String(interval) })
      setSettings((prev) => ({ ...prev, hero_interval_seconds: String(interval) }))
      setSaved(true)
    } catch { setError("حدث خطأ أثناء الحفظ — تأكد من اتصال الباك إند") }
    finally { setSaving(false) }
  }

  function handleLogout() { adminLogout(); router.replace("/admin/login") }

  const SaveButton = () => <button onClick={handleSave} disabled={saving || loading} className="inline-flex items-center gap-2 rounded-xl bg-[var(--ink)] px-5 py-3 text-sm text-white transition hover:bg-[var(--brand)] disabled:opacity-50">{saved ? <Check size={16} /> : null}{saving ? "جارِ الحفظ..." : saved ? "تم الحفظ" : "حفظ التغييرات"}</button>

  return (
    <main dir="rtl" className="min-h-screen bg-[var(--bg)]">
      <AdminHeader maxWidthClass="max-w-6xl" onLogout={handleLogout} />
      <section className="mx-auto max-w-6xl px-5 py-8 sm:py-10">
        <div className="mb-8 flex flex-col gap-4 rounded-3xl bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div><p className="mb-2 text-[10px] tracking-[0.35em] text-[var(--brand)]">DAHAB CONTENT STUDIO</p><h1 className="text-2xl font-light">التحكم الكامل في الصفحة الرئيسية</h1><p className="mt-2 text-sm text-gray-500">كل ما تغيّريه هنا ينعكس على واجهة المتجر بعد الحفظ.</p></div>
          <SaveButton />
        </div>

        {error && <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">{error}</div>}

        {loading ? <p className="text-sm text-gray-500">جارِ تحميل الإعدادات...</p> : <div className="space-y-7">
          <section className="rounded-3xl bg-white p-6 shadow-sm">
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div><h2 className="text-lg font-semibold">Hero Slider</h2><p className="mt-1 text-xs text-gray-500">اختاري عدد الصور من 1 إلى 8، ورتّبيها بالترتيب الذي تريدينه.</p></div>
              <div className="flex items-center gap-3 rounded-2xl bg-[var(--bg)] px-4 py-3"><Clock3 size={17} className="text-[var(--brand)]" /><label className="text-sm">المدة بين الصور</label><input type="number" min={1} max={60} value={settings.hero_interval_seconds || "3"} onChange={(e) => handleChange("hero_interval_seconds", e.target.value)} className="w-20 rounded-xl border border-black/10 bg-white px-3 py-2 text-center text-sm outline-none focus:border-[var(--brand)]" /><span className="text-xs text-gray-400">ثانية</span></div>
            </div>
            <div className="mb-5 flex items-center justify-between rounded-2xl border border-[var(--brand)]/20 bg-[var(--brand)]/5 px-4 py-3 text-sm"><span>الصور المفعّلة: <strong>{activeHeroCount}</strong> / 8</span><button type="button" onClick={addHero} disabled={activeHeroCount >= 8} className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--ink)] px-3 py-2 text-xs text-white disabled:opacity-40"><Plus size={15} /> إضافة صورة</button></div>
            <div className="space-y-4">
              {HERO_KEYS.map((key, index) => {
                const value = settings[key] || ""
                const visible = index === 0 || Boolean(value) || Boolean(settings[HERO_KEYS[index - 1]])
                if (!visible) return null
                return <div key={key} className="rounded-2xl border border-black/10 p-4">
                  <div className="mb-3 flex items-center justify-between"><div className="flex items-center gap-2 text-sm font-medium"><GripVertical size={16} className="text-gray-300" /> الصورة {index + 1}</div>{index > 0 && value && <button type="button" onClick={() => removeHero(key)} className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs text-red-500 hover:bg-red-50"><Trash2 size={14} /> حذف</button>}</div>
                  <ImageField fieldKey={key} value={value} onChange={handleChange} />
                </div>
              })}
            </div>
          </section>

          <section className="grid gap-5 lg:grid-cols-2">
            {TEXT_KEYS.map((key) => {
              const value = settings[key] ?? ""
              return <div key={key} className="rounded-2xl bg-white p-5 shadow-sm"><label className="mb-3 block text-sm font-medium text-gray-700">{FIELD_LABELS[key]}</label>{IMAGE_KEYS.has(key) ? <ImageField fieldKey={key} value={value} onChange={handleChange} /> : TEXTAREA_KEYS.has(key) ? <textarea value={value} onChange={(e) => handleChange(key, e.target.value)} rows={4} className="w-full rounded-xl border border-black/10 px-4 py-3 text-sm outline-none focus:border-[var(--brand)]" /> : <input value={value} onChange={(e) => handleChange(key, e.target.value)} className="w-full rounded-xl border border-black/10 px-4 py-3 text-sm outline-none focus:border-[var(--brand)]" />}</div>
            })}
          </section>

          <section className="rounded-3xl bg-white p-6 shadow-sm"><h2 className="text-lg font-semibold">صور عناصر الإكسسوارات</h2><div className="mt-5 grid gap-5 md:grid-cols-2">{["accessories_item1_image", "accessories_item3_image"].map((key) => <div key={key}><label className="mb-3 block text-sm font-medium">{key === "accessories_item1_image" ? "صورة العنصر الأول" : "صورة العنصر الثاني"}</label><ImageField fieldKey={key} value={settings[key] || ""} onChange={handleChange} /></div>)}</div></section>

          <div className="flex justify-end"><SaveButton /></div>
        </div>}
      </section>
    </main>
  )
}
