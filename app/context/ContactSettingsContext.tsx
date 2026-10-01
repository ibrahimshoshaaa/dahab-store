"use client"

import { createContext, useContext, useEffect, useState } from "react"
import { fetchSettings, type SiteSettings } from "../lib/api"

const ContactSettingsContext = createContext<SiteSettings>({})
export function ContactSettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<SiteSettings>({})
  useEffect(() => {
    let active = true
    function refresh() { fetchSettings().then(data => { if (active) setSettings(data) }) }
    refresh()
    window.addEventListener("focus", refresh)
    return () => { active = false; window.removeEventListener("focus", refresh) }
  }, [])
  return <ContactSettingsContext.Provider value={settings}>{children}</ContactSettingsContext.Provider>
}
export function useContactSettings() { return useContext(ContactSettingsContext) }
