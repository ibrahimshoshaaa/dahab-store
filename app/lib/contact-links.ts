export function normalizeSocialUrl(value: string | undefined) {
  const input = (value || "").trim()
  if (!input || input === "#") return ""
  if (/^[a-z][a-z\d+.-]*:/i.test(input) && !/^https?:\/\//i.test(input)) return ""
  try {
    const url = new URL(/^https?:\/\//i.test(input) ? input : `https://${input}`)
    return ["http:", "https:"].includes(url.protocol) && url.hostname.includes(".") ? url.href : ""
  } catch { return "" }
}

export function contactWhatsappUrl(settings: Record<string, string>) {
  const raw = settings.contact_whatsapp_phone === undefined ? settings.contact_phone : settings.contact_whatsapp_phone
  let digits = (raw || "").replace(/\D/g, "")
  if (digits.startsWith("00")) digits = digits.slice(2)
  if (digits.startsWith("0")) digits = `20${digits.slice(1)}`
  if (!/^[1-9]\d{7,14}$/.test(digits)) return ""
  const message = settings.contact_whatsapp_message?.trim()
  return `https://wa.me/${digits}${message ? `?text=${encodeURIComponent(message)}` : ""}`
}
