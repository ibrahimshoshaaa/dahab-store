"use client"

import { createContext, useContext, useEffect, useState } from "react"
import type { Product } from "../data/products"
import { checkCartStock } from "../lib/api"
import { sanitizeCartItems } from "../lib/validation.mjs"

export type CartItem = Product & {
  quantity: number
  selectedColor?: string
  selectedSize?: string
}

type CartContextType = {
  cart: CartItem[]
  addToCart: (product: Product, quantity?: number, selectedColor?: string, selectedSize?: string) => void
  removeFromCart: (id: number, color?: string, size?: string) => void
  clearCart: () => void
  updateQuantity: (id: number, quantity: number, color?: string, size?: string) => void
  cartCount: number
  cartTotal: number
  mounted: boolean
  stockChecking: boolean
  stockMessages: Record<string, string>
  unavailableItems: Set<string>
  refreshCartStock: () => Promise<boolean>
}

const CartContext = createContext<CartContextType | null>(null)

const keyOf = (item: Pick<CartItem, "id" | "selectedColor" | "selectedSize">) =>
  `${item.id}-${item.selectedColor || ""}-${item.selectedSize || ""}`

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<CartItem[]>([])
  const [mounted, setMounted] = useState(false)
  const [stockChecking, setStockChecking] = useState(false)
  const [stockMessages, setStockMessages] = useState<Record<string, string>>({})
  const [unavailableItems, setUnavailableItems] = useState<Set<string>>(new Set())
  const [stockAvailability, setStockAvailability] = useState<Record<string, number>>({})

  useEffect(() => {
    const saved = localStorage.getItem("dahab-cart")
    if (saved) {
      try {
        const sanitized = sanitizeCartItems(JSON.parse(saved))
        setCart(sanitized)
        if (sanitized.length === 0) localStorage.removeItem("dahab-cart")
        else localStorage.setItem("dahab-cart", JSON.stringify(sanitized))
      } catch { localStorage.removeItem("dahab-cart") }
    }
    setMounted(true)
  }, [])

  useEffect(() => {
    if (mounted) localStorage.setItem("dahab-cart", JSON.stringify(cart))
  }, [cart, mounted])

  async function refreshCartStock() {
    if (!cart.length) {
      setStockMessages({})
      setUnavailableItems(new Set())
      setStockAvailability({})
      return true
    }

    setStockChecking(true)
    setStockMessages({})
    setUnavailableItems(new Set())
    setStockAvailability({})

    try {
      const results = await checkCartStock(cart.map((item) => ({
        product_id: item.id,
        quantity: item.quantity,
        selected_color: item.selectedColor,
        selected_size: item.selectedSize,
      })))

      const messages: Record<string, string> = {}
      const unavailable = new Set<string>()
      const availability: Record<string, number> = {}

      setCart((current) => current.flatMap((item) => {
        const result = results.find((r) =>
          r.product_id === item.id &&
          (r.selected_color || "") === (item.selectedColor || "") &&
          (r.selected_size || "") === (item.selectedSize || "")
        )
        if (!result) return [item]

        const key = keyOf(item)
        availability[key] = Math.max(0, Number(result.available) || 0)
        if (!result.active || result.available <= 0) {
          messages[key] = !result.active ? "المنتج لم يعد متاحًا" : "هذا المنتج نفد من المخزون"
          unavailable.add(key)
          return [{ ...item, quantity: 0 }]
        }

        if (item.quantity > result.available) {
          messages[key] = `الكمية المطلوبة أكبر من المتاح. تم تعديلها إلى ${result.available}`
          return [{ ...item, quantity: result.available }]
        }

        messages[key] = "المخزون متاح ✓"
        return [item]
      }).filter((item) => item.quantity > 0))

      setStockMessages(messages)
      setUnavailableItems(unavailable)
      setStockAvailability(availability)
      const changed = cart.some((item) => {
        const result = results.find((x) =>
          x.product_id === item.id &&
          (x.selected_color || "") === (item.selectedColor || "") &&
          (x.selected_size || "") === (item.selectedSize || "")
        )
        return !result || !result.active || Number(result.available) < item.quantity
      })
      return !changed
    } catch {
      setStockMessages({ _error: "تعذر التحقق من المخزون حاليًا. اضغطي إعادة التحقق." })
      return false
    } finally {
      setStockChecking(false)
    }
  }

  function addToCart(product: Product, quantity = 1, selectedColor?: string, selectedSize?: string) {
    setStockMessages({})
    setUnavailableItems(new Set())
    setStockAvailability({})
    setCart((current) => {
      const variantKey = `${selectedColor || "-"}|${selectedSize || "-"}`
      const hasVariants = !!product.variantStock && Object.keys(product.variantStock).length > 0
      const variantAvailable = hasVariants ? Number(product.variantStock?.[variantKey] ?? 0) : Number(product.stock ?? 99)
      if (variantAvailable <= 0) return current

      const existing = current.find((item) => item.id === product.id && item.selectedColor === selectedColor && item.selectedSize === selectedSize)
      if (existing) {
        return current.map((item) =>
          item === existing
            ? { ...item, quantity: Math.min(variantAvailable, item.quantity + quantity) }
            : item
        )
      }

      return [...current, { ...product, quantity: Math.min(variantAvailable, quantity), selectedColor, selectedSize }]
    })
  }

  function removeFromCart(id: number, color?: string, size?: string) {
    setCart((current) => current.filter((item) => !(item.id === id && item.selectedColor === color && item.selectedSize === size)))
  }

  function updateQuantity(id: number, quantity: number, color?: string, size?: string) {
    if (quantity <= 0) { removeFromCart(id, color, size); return }

    const key = keyOf({ id, selectedColor: color, selectedSize: size })
    const knownAvailable = stockAvailability[key]

    if (knownAvailable !== undefined) {
      if (knownAvailable <= 0) {
        setStockMessages((current) => ({ ...current, [key]: "هذا الاختيار نفد من المخزون" }))
        setUnavailableItems((current) => new Set(current).add(key))
        return
      }

      if (quantity > knownAvailable) {
        setStockMessages((current) => ({
          ...current,
          [key]: `الكمية المطلوبة أكبر من المتاح. الحد الأقصى ${knownAvailable} قطعة`,
        }))
        setCart((current) => current.map((item) =>
          item.id === id && item.selectedColor === color && item.selectedSize === size
            ? { ...item, quantity: knownAvailable }
            : item
        ))
        return
      }
    }

    setCart((current) => current.map((item) =>
      item.id === id && item.selectedColor === color && item.selectedSize === size
        ? { ...item, quantity }
        : item
    ))
  }

  function clearCart() {
    setCart([])
    setStockMessages({})
    setUnavailableItems(new Set())
    setStockAvailability({})
  }

  const cartCount = cart.reduce((total, item) => total + item.quantity, 0)
  const cartTotal = cart.reduce((total, item) => total + item.price * item.quantity, 0)

  return (
    <CartContext.Provider value={{ cart, addToCart, removeFromCart, clearCart, updateQuantity, cartCount, cartTotal, mounted, stockChecking, stockMessages, unavailableItems, refreshCartStock }}>
      {children}
    </CartContext.Provider>
  )
}

export function useCart() {
  const context = useContext(CartContext)
  if (!context) throw new Error("useCart must be used inside CartProvider")
  return context
}
