"use client"

import { createContext, useContext, useEffect, useState } from "react"
import type { Product } from "../data/products"
import { checkCartStock } from "../lib/api"

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

  useEffect(() => {
    const saved = localStorage.getItem("dahab-cart")
    if (saved) {
      try { setCart(JSON.parse(saved)) } catch { localStorage.removeItem("dahab-cart") }
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
      return true
    }

    setStockChecking(true)
    setStockMessages({})
    setUnavailableItems(new Set())

    try {
      const results = await checkCartStock(cart.map((item) => ({
        product_id: item.id,
        quantity: item.quantity,
        selected_color: item.selectedColor,
        selected_size: item.selectedSize,
      })))

      const messages: Record<string, string> = {}
      const unavailable = new Set<string>()

      setCart((current) => current.flatMap((item) => {
        const result = results.find((r) =>
          r.product_id === item.id &&
          (r.selected_color || "") === (item.selectedColor || "") &&
          (r.selected_size || "") === (item.selectedSize || "")
        )
        if (!result) return [item]

        const key = keyOf(item)
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
      return true
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
    setCart((current) => {
      const existing = current.find((item) => item.id === product.id && item.selectedColor === selectedColor && item.selectedSize === selectedSize)
      if (existing) return current.map((item) => item === existing ? { ...item, quantity: Math.min(product.stock ?? 99, item.quantity + quantity) } : item)
      return [...current, { ...product, quantity: Math.min(product.stock ?? 99, quantity), selectedColor, selectedSize }]
    })
  }

  function removeFromCart(id: number, color?: string, size?: string) {
    setCart((current) => current.filter((item) => !(item.id === id && item.selectedColor === color && item.selectedSize === size)))
  }

  function updateQuantity(id: number, quantity: number, color?: string, size?: string) {
    if (quantity <= 0) { removeFromCart(id, color, size); return }
    setCart((current) => current.map((item) =>
      item.id === id && item.selectedColor === color && item.selectedSize === size ? { ...item, quantity } : item
    ))
  }

  function clearCart() {
    setCart([])
    setStockMessages({})
    setUnavailableItems(new Set())
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
