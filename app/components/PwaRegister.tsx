"use client"

import { useEffect, useState } from "react"
import { X, Smartphone, Share2 } from "lucide-react"

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>
}

function isStandalone() {
  const nav = navigator as Navigator & { standalone?: boolean }
  return window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true
}

function isIos() {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent)
}

export default function PwaRegister() {
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null)
  const [show, setShow] = useState(false)
  const [ios, setIos] = useState(false)

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {})
    }

    if (isStandalone()) return

    const iosDevice = isIos()
    setIos(iosDevice)

    const handler = (event: Event) => {
      const installEvent = event as InstallPromptEvent
      event.preventDefault()
      setPrompt(installEvent)
      setShow(true)
    }

    window.addEventListener("beforeinstallprompt", handler)

    const installedHandler = () => {
      setPrompt(null)
      setShow(false)
    }

    window.addEventListener("appinstalled", installedHandler)

    if (iosDevice) setShow(true)

    return () => {
      window.removeEventListener("beforeinstallprompt", handler)
      window.removeEventListener("appinstalled", installedHandler)
    }
  }, [])

  if (!show) return null

  if (ios) {
    return (
      <div className="fixed bottom-4 left-4 right-4 z-[100] mx-auto max-w-md rounded-2xl border border-black/10 bg-white p-4 shadow-2xl" dir="rtl">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--bg)]">
            <Share2 size={19} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold">ثبّتي Dahab على الآيفون</p>
              <button onClick={() => setShow(false)} aria-label="إغلاق"><X size={18} /></button>
            </div>
            <p className="mt-1 text-xs leading-5 text-gray-500">
              من Safari اضغطي مشاركة ثم «إضافة إلى الشاشة الرئيسية» لفتح المتجر كتطبيق.
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (!prompt) return null

  return (
    <div className="fixed bottom-4 left-4 right-4 z-[100] mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-black/10 bg-white p-4 shadow-2xl" dir="rtl">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--bg)]"><Smartphone size={19} /></div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">ثبّتي Dahab على موبايلك</p>
        <p className="mt-1 text-xs text-gray-500">وصّلي للموقع أسرع من الشاشة الرئيسية.</p>
      </div>
      <button onClick={async () => { await prompt.prompt(); setPrompt(null); setShow(false) }} className="rounded-full bg-black px-4 py-2 text-xs text-white">تثبيت</button>
      <button onClick={() => setShow(false)} aria-label="إغلاق"><X size={18} /></button>
    </div>
  )
}
