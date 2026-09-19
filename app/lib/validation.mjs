export function normalizeEgyptianPhone(value) {
  const raw = String(value ?? "")
    .trim()
    .replace(/[\s().-]/g, "")
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))

  let local = raw
  if (local.startsWith("+20")) local = "0" + local.slice(3)
  else if (local.startsWith("0020")) local = "0" + local.slice(4)
  else if (local.startsWith("20") && local.length === 13) local = "0" + local.slice(2)

  if (!/^01[0125]\d{8}$/.test(local)) return null
  return local
}

export function isValidEgyptianPhone(value) {
  return normalizeEgyptianPhone(value) !== null
}

export function sanitizeCartItems(value) {
  if (!Array.isArray(value)) return []
  return value.flatMap((raw) => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return []
    const item = raw
    const id = Number(item.id)
    const quantity = Number(item.quantity)
    const price = Number(item.price)
    if (!Number.isInteger(id) || id <= 0 || !Number.isInteger(quantity) || quantity < 1 || quantity > 100) return []
    if (!String(item.slug || "").trim() || !String(item.name || "").trim()) return []
    if (!Number.isFinite(price) || price < 0) return []
    if (!String(item.image || "").trim()) return []
    const colors = Array.isArray(item.colors) ? item.colors.filter((x) => typeof x === "string") : []
    const sizes = Array.isArray(item.sizes) ? item.sizes.filter((x) => typeof x === "string") : []
    return [{
      ...item,
      id,
      quantity,
      price,
      slug: String(item.slug),
      name: String(item.name),
      image: String(item.image),
      colors,
      sizes,
      selectedColor: typeof item.selectedColor === "string" ? item.selectedColor : undefined,
      selectedSize: typeof item.selectedSize === "string" ? item.selectedSize : undefined,
    }]
  })
}
