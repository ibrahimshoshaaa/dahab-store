import type { Product } from "../data/products"

export const API_URL = process.env.NEXT_PUBLIC_API_URL || ""

export type ApiProduct = Product & {
  id: number
  active?: boolean
}

// ---------- public: products ----------

/**
 * Required homepage data: unlike the legacy helpers below, these functions
 * propagate API/Turso failures so the homepage stays on its loading state.
 */
let clientRequiredProductsCache: { expiresAt: number; promise: Promise<ApiProduct[]> } | null = null

export async function fetchProductsRequired(): Promise<ApiProduct[]> {
  if (typeof window !== "undefined" && clientRequiredProductsCache && clientRequiredProductsCache.expiresAt > Date.now()) {
    return clientRequiredProductsCache.promise
  }

  const request = (async () => {
    try {
      const res = await fetch(`${API_URL}/api/products`, { next: { revalidate: 60, tags: ["products"] } })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.message || "تعذر تحميل المنتجات")
      return data.products as ApiProduct[]
    } catch (error) {
      clientRequiredProductsCache = null
      throw error
    }
  })()

  if (typeof window !== "undefined") {
    clientRequiredProductsCache = { expiresAt: Date.now() + 60_000, promise: request }
  }

  return request
}


let clientProductsCache: { expiresAt: number; promise: Promise<ApiProduct[]> } | null = null

export async function fetchProducts(): Promise<ApiProduct[]> {
  if (typeof window !== "undefined" && clientProductsCache && clientProductsCache.expiresAt > Date.now()) {
    return clientProductsCache.promise
  }

  const request = (async () => {
    try {
      const res = await fetch(`${API_URL}/api/products`, { next: { revalidate: 60, tags: ["products"] } })
      const data = await res.json()

      if (!data.success) throw new Error(data.message)

      return data.products as ApiProduct[]
    } catch {
      return []
    }
  })()

  if (typeof window !== "undefined") {
    clientProductsCache = { expiresAt: Date.now() + 60_000, promise: request }
  }

  return request
}

export async function fetchProductBySlug(
  slug: string
): Promise<ApiProduct | undefined> {
  try {
    const res = await fetch(`${API_URL}/api/products/${slug}`, {
      next: { revalidate: 60, tags: ["products"] },
    })
    const data = await res.json()

    if (!data.success) throw new Error(data.message)

    return data.product
  } catch {
    return undefined
  }
}

// ---------- live cart stock ----------

export type CartStockItem = {
  product_id: number
  quantity: number
  selected_color?: string
  selected_size?: string
}

export type CartStockResult = {
  product_id: number
  selected_color?: string
  selected_size?: string
  requested: number
  available: number
  active: boolean
}

export async function checkCartStock(items: CartStockItem[]): Promise<CartStockResult[]> {
  if (!items.length) return []
  const res = await fetch(`${API_URL}/api/cart/stock`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({ items }),
  })
  const data = await res.json()
  if (!res.ok || !data.success) throw new Error(data.message || "تعذر التحقق من المخزون")
  return data.items as CartStockResult[]
}

// ---------- public: orders ----------

export type OrderPayload = {
  customer_name: string
  phone: string
  governorate: string
  area: string
  address: string
  notes?: string
  total: number
  coupon_code?: string
  items: {
    product_id: number
    product_name: string
    price: number
    quantity: number
    selected_color?: string
    selected_size?: string
  }[]
}

export async function createOrder(payload: OrderPayload) {
  const res = await fetch(`${API_URL}/api/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })

  const data = await res.json()

  if (!res.ok || !data.success) {
    throw new Error(data.message || "تعذر إتمام الطلب")
  }

  return {
    orderId: data.order_id as number,
    trackingCode: data.tracking_code as string,
  }
}

// Public tracking uses the unguessable tracking code — NOT the order id.
// (The old /api/orders/:id endpoint is now admin-only.)
export async function fetchOrderByCode(code: string) {
  const res = await fetch(
    `${API_URL}/api/orders/track/${encodeURIComponent(code.trim().toUpperCase())}`,
    { cache: "no-store" }
  )
  const data = await res.json()

  if (!res.ok || !data.success) {
    throw new Error(data.message || "الطلب غير موجود")
  }

  return data as { order: Record<string, unknown>; items: Record<string, unknown>[] }
}

// ---------- admin ----------

// The real admin token is HttpOnly; this marker is non-sensitive and only keeps legacy client route guards working.
export function getAdminToken() {
  if (typeof document === "undefined") return null
  return document.cookie.split(";").some((part) => part.trim() === "dahab_admin_session=1") ? "session-marker" : null
}

export function setAdminToken(_token: string) {}
export function clearAdminToken() {}

async function adminFetch(path: string, options: RequestInit = {}) {

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    cache: "no-store",
  })

  const data = await res.json()

  if (!res.ok || !data.success) {
    throw new Error(data.message || "حدث خطأ")
  }

  return data
}

export async function adminLogin(username: string, password: string) {
  const res = await fetch(`${API_URL}/api/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  })

  const data = await res.json()

  if (!res.ok || !data.success) {
    throw new Error(data.message || "بيانات الدخول غير صحيحة")
  }

  return true
}

export function adminLogout() {
  adminFetch("/api/admin/logout", { method: "POST" }).catch(() => {})
}

export type AdminOrdersResult = {
  orders: Record<string, unknown>[]
  pagination: { page: number; limit: number; total: number; totalPages: number }
  summary: Record<string, number>
}

export async function fetchAdminOrders(options: { page?: number; limit?: number; search?: string; status?: string; sort?: string } = {}): Promise<AdminOrdersResult> {
  const params = new URLSearchParams()
  if (options.page) params.set("page", String(options.page))
  if (options.limit) params.set("limit", String(options.limit))
  if (options.search) params.set("q", options.search)
  if (options.status && options.status !== "الكل") params.set("status", options.status)
  if (options.sort === "الأقدم") params.set("sort", "oldest")
  if (options.sort === "الأعلى سعرًا") params.set("sort", "highest")
  if (options.sort === "الأقل سعرًا") params.set("sort", "lowest")
  const data = await adminFetch(`/api/orders${params.toString() ? `?${params.toString()}` : ""}`)
  return {
    orders: data.orders as Record<string, unknown>[],
    pagination: data.pagination,
    summary: data.summary,
  }
}

export async function updateOrderStatus(id: number, status: string) {
  return adminFetch(`/api/orders/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  })
}

export async function fetchAdminProducts() {
  const data = await adminFetch("/api/admin/products")
  return data.products as ApiProduct[]
}

export async function createProduct(payload: Partial<ApiProduct>) {
  return adminFetch("/api/admin/products", {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

export async function updateProduct(id: number, payload: Partial<ApiProduct>) {
  return adminFetch(`/api/admin/products/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  })
}

export async function deleteProduct(id: number) {
  return adminFetch(`/api/admin/products/${id}`, { method: "DELETE" })
}

export async function updateProductStock(id: number, stock: number) {
  return adminFetch(`/api/admin/products/${id}/stock`, {
    method: "PATCH",
    body: JSON.stringify({ stock }),
  })
}

// ---------- admin customers ----------

export type AdminCustomer = {
  customer_name: string
  phone: string
  governorate: string
  area: string
  address: string
  orders_count: number
  total_spent: number
  last_order_at: string
  first_order_at: string
}

export async function fetchAdminCustomers() {
  const data = await adminFetch("/api/admin/customers")
  return data.customers as AdminCustomer[]
}

export async function fetchCustomerOrders(phone: string) {
  const data = await adminFetch(`/api/admin/customers/${encodeURIComponent(phone)}/orders`)
  return data.orders as Record<string, unknown>[]
}

// ---------- coupons ----------
export type AdminCoupon = { id:number; code:string; type:"percent"|"fixed"; value:number; min_order:number; max_uses:number; used_count:number; expires_at:string|null; starts_at:string|null; max_discount:number|null; min_items:number; product_id:number|null; category:string|null; free_shipping:number; active:number }
export async function fetchAdminCoupons(){const data=await adminFetch("/api/admin/coupons");return data.coupons as AdminCoupon[]}
export async function createCoupon(payload:Record<string,unknown>){return adminFetch("/api/admin/coupons",{method:"POST",body:JSON.stringify(payload)})}
export async function updateCoupon(id:number,payload:Record<string,unknown>){return adminFetch(`/api/admin/coupons/${id}`,{method:"PUT",body:JSON.stringify(payload)})}
export async function deleteCoupon(id:number){return adminFetch(`/api/admin/coupons/${id}`,{method:"DELETE"})}
export async function validateCoupon(code:string,subtotal:number,items?:{product_id:number;quantity:number;category?:string}[]){const res=await fetch(`${API_URL}/api/coupons/validate`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({code,subtotal,items})});const data=await res.json();if(!res.ok||!data.success)throw new Error(data.message||"الكوبون غير صالح");return data as {coupon:{code:string;type:string;value:number};discount:number;total:number}}

// ---------- reviews ----------
export type ProductReview = { id:number; product_id:number; customer_name:string; rating:number; comment:string; status?:string; created_at:string }
export async function fetchProductReviews(productId:number){const res=await fetch(`${API_URL}/api/products/${productId}/reviews`,{cache:"no-store"});const data=await res.json();if(!res.ok||!data.success)throw new Error(data.message||"تعذر جلب التقييمات");return data as {reviews:ProductReview[];average:number;count:number}}
export async function submitProductReview(productId:number,payload:{customer_name:string;rating:number;comment:string}){const res=await fetch(`${API_URL}/api/products/${productId}/reviews`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});const data=await res.json();if(!res.ok||!data.success)throw new Error(data.message||"تعذر إرسال التقييم");return data}
export async function fetchAdminReviews(){const data=await adminFetch("/api/admin/reviews");return data.reviews as ProductReview[] & {product_name:string}[]}
export async function updateReviewStatus(id:number,status:"pending"|"approved"|"hidden"){return adminFetch(`/api/admin/reviews/${id}`,{method:"PATCH",body:JSON.stringify({status})})}
export async function deleteReview(id:number){return adminFetch(`/api/admin/reviews/${id}`,{method:"DELETE"})}

// ---------- analytics ----------
export async function trackEvent(event:{event_type:"page_view"|"product_view"|"add_to_cart"|"begin_checkout"|"purchase";product_id?:number;path?:string;metadata?:Record<string,unknown>}){try{let sid=typeof window!=="undefined"?localStorage.getItem("dahab-session-id"):null;if(!sid&&typeof window!=="undefined"){sid=crypto.randomUUID();localStorage.setItem("dahab-session-id",sid)};await fetch(`${API_URL}/api/analytics/events`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...event,session_id:sid})})}catch{}}
export type AnalyticsSummary={days:number;counts:Record<string,number>;uniqueSessions:number;topProducts:{product_id:number;name:string;views:number}[]}
export async function fetchAnalytics(days:number){const data=await adminFetch(`/api/admin/analytics?days=${days}`);return data as AnalyticsSummary}

// ---------- settings ----------

let clientRequiredSettingsCache: { expiresAt: number; promise: Promise<SiteSettings> } | null = null

export async function fetchSettingsRequired(): Promise<SiteSettings> {
  if (typeof window !== "undefined" && clientRequiredSettingsCache && clientRequiredSettingsCache.expiresAt > Date.now()) {
    return clientRequiredSettingsCache.promise
  }

  const request = (async () => {
    try {
      const res = await fetch(`${API_URL}/api/settings`, { next: { revalidate: 60, tags: ["settings"] } })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.message || "تعذر تحميل إعدادات الموقع")
      return data.settings as SiteSettings
    } catch (error) {
      clientRequiredSettingsCache = null
      throw error
    }
  })()

  if (typeof window !== "undefined") {
    clientRequiredSettingsCache = { expiresAt: Date.now() + 60_000, promise: request }
  }

  return request
}


export type SiteSettings = Record<string, string>

let clientSettingsCache: { expiresAt: number; promise: Promise<SiteSettings> } | null = null

export async function fetchSettings(): Promise<SiteSettings> {
  if (typeof window !== "undefined" && clientSettingsCache && clientSettingsCache.expiresAt > Date.now()) {
    return clientSettingsCache.promise
  }

  const request = (async () => {
    try {
      const res = await fetch(`${API_URL}/api/settings`, { next: { revalidate: 60, tags: ["settings"] } })
      const data = await res.json()
      if (!data.success) throw new Error(data.message)
      return data.settings as SiteSettings
    } catch {
      return {}
    }
  })()

  if (typeof window !== "undefined") {
    clientSettingsCache = { expiresAt: Date.now() + 60_000, promise: request }
  }

  return request
}

export async function updateSettings(payload: SiteSettings) {
  return adminFetch("/api/admin/settings", {
    method: "PUT",
    body: JSON.stringify(payload),
  })
}

// ---------- image upload ----------

export async function uploadImage(file: File): Promise<string> {
  const formData = new FormData()
  formData.append("image", file)

  const res = await fetch(`${API_URL}/api/admin/upload`, {
    method: "POST",
    body: formData,
  })

  const data = await res.json()

  if (!res.ok || !data.success) {
    throw new Error(data.message || "فشل رفع الصورة")
  }

  return data.url as string
}

// ---------- contact messages ----------

export type ContactMessage = {
  id: number
  name: string
  phone: string
  message: string
  is_read: number
  created_at: string
}

export async function submitContactMessage(payload: {
  name: string
  phone: string
  message: string
}) {
  const res = await fetch(`${API_URL}/api/contact`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })

  const data = await res.json()

  if (!res.ok || !data.success) {
    throw new Error(data.message || "تعذر إرسال الرسالة")
  }

  return data.id as number
}

export async function fetchContactMessages() {
  const data = await adminFetch("/api/admin/contact-messages")
  return data.messages as ContactMessage[]
}

export async function markContactMessageRead(id: number) {
  return adminFetch(`/api/admin/contact-messages/${id}/read`, {
    method: "PATCH",
  })
}

export async function deleteContactMessage(id: number) {
  return adminFetch(`/api/admin/contact-messages/${id}`, {
    method: "DELETE",
  })
}
