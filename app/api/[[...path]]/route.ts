import { revalidateTag } from "next/cache"
import crypto from "node:crypto"
import { v2 as cloudinary } from "cloudinary"
import { db, ensureDb, generateTrackingCode } from "@/app/lib/server/db"
import { createAdminToken, getAdminTokenFromRequest, requireAdmin, revokeAdminToken, verifyAdminCredentials } from "@/app/lib/server/auth"
import { clientIp, rateLimit } from "@/app/lib/server/rate-limit"
import { couponDiscount, json, parseProduct, readJson, safeJsonParse, slugify } from "@/app/lib/server/utils"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

const allowedStatuses = ["جديد", "تم التأكيد", "جاري التجهيز", "تم الشحن", "تم التسليم", "ملغي"]

async function adminGuard(request: Request) {
  if (!(await requireAdmin(request))) return json({ success: false, message: "غير مصرح لك بهذا الإجراء" }, 401)
  return null
}

function numberParam(value: string | undefined) {
  const n = Number(value)
  return Number.isInteger(n) && n > 0 ? n : null
}

function normalizeVariantStock(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {}
  const result: Record<string, number> = {}
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    const n = Number(raw)
    if (Number.isFinite(n)) result[String(key)] = Math.max(0, Math.floor(n))
  }
  return result
}

function totalVariantStock(value: Record<string, number>) {
  return Object.values(value).reduce((sum, n) => sum + n, 0)
}

async function handle(request: Request, method: string, path: string[]) {
  await ensureDb()
  const contentType = request.headers.get("content-type") || ""

const body =
  ["GET", "HEAD"].includes(method) ||
  contentType.includes("multipart/form-data")
    ? {}
    : await readJson(request)
  const url = new URL(request.url)
  const p = path.map(decodeURIComponent)
  const keyPath=p.join("/")
  const ip=clientIp(request)
  const rules: Record<string,[number,number]>={"analytics/events":[120,60],"coupons/validate":[30,60],"contact":[10,600]}
  if(method==="POST" && rules[keyPath]) { const [limit,window]=rules[keyPath]; const rl=await rateLimit(`${keyPath}:${ip}`,limit,window); if(!rl.ok)return json({success:false,message:"طلبات كثيرة، حاول لاحقًا"},429) }
  if(method==="POST" && keyPath==="orders") { const rl=await rateLimit(`orders:${ip}`,20,600); if(!rl.ok)return json({success:false,message:"طلبات كثيرة، حاول لاحقًا"},429) }

  // /api health
  if (p.length === 0) return json({ success: true, message: "Dahab API is running" })

  // ---------- admin auth ----------
  if (p.join("/") === "admin/login" && method === "POST") {
    const rl=await rateLimit(`login:${clientIp(request)}`,8,600); if(!rl.ok) return json({success:false,message:"محاولات كثيرة، حاول لاحقًا"},429)
    const b: any = body
    if (!verifyAdminCredentials(b.username, b.password)) return json({ success: false, message: "بيانات الدخول غير صحيحة" }, 401)
    const token = await createAdminToken()
    const response = json({ success: true })
    const maxAge = Math.max(300, Number(process.env.ADMIN_TOKEN_TTL_SECONDS || 28800))
    response.headers.append("Set-Cookie", `dahab_admin_token=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`)
    response.headers.append("Set-Cookie", `dahab_admin_session=1; Path=/; Secure; SameSite=Lax; Max-Age=${maxAge}`)
    return response
  }

  if (p.join("/") === "admin/logout" && method === "POST") {
    const denied = await adminGuard(request); if (denied) return denied
    await revokeAdminToken(getAdminTokenFromRequest(request))
    const response = json({ success: true })
    response.headers.append("Set-Cookie", "dahab_admin_token=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0")
    response.headers.append("Set-Cookie", "dahab_admin_session=; Path=/; Secure; SameSite=Lax; Max-Age=0")
    return response
  }

  // ---------- public products ----------
  if (p.length === 1 && p[0] === "products" && method === "GET") {
    try {
      const result = await db.execute("SELECT id,slug,name,category,price,old_price,image,images,badge,colors,sizes,description,featured,best_seller,active,size_chart,material_details,care_instructions,stock,low_stock_threshold,variant_stock FROM products WHERE active = 1 ORDER BY id DESC")
      return json({ success: true, products: result.rows.map((r: any) => parseProduct(r)) })
    } catch (error) { console.error(error); return json({ success: false, message: "حدث خطأ في جلب المنتجات" }, 500) }
  }

  if (p.length === 2 && p[0] === "products" && method === "GET") {
    try {
      const result = await db.execute({ sql: "SELECT id,slug,name,category,price,old_price,image,images,badge,colors,sizes,description,featured,best_seller,active,size_chart,material_details,care_instructions,stock,low_stock_threshold,variant_stock FROM products WHERE slug = ? AND active = 1 LIMIT 1", args: [p[1]] })
      if (!result.rows[0]) return json({ success: false, message: "المنتج غير موجود" }, 404)
      return json({ success: true, product: parseProduct(result.rows[0] as any) })
    } catch (error) { console.error(error); return json({ success: false, message: "حدث خطأ في جلب المنتج" }, 500) }
  }

  // ---------- admin products ----------
  if (p.length === 2 && p[0] === "admin" && p[1] === "products" && method === "GET") {
    const denied = await adminGuard(request); if (denied) return denied
    try {
      const result = await db.execute("SELECT id,slug,name,category,price,old_price,image,images,badge,colors,sizes,description,featured,best_seller,active,size_chart,material_details,care_instructions,stock,low_stock_threshold,variant_stock FROM products ORDER BY id DESC")
      return json({ success: true, products: result.rows.map((r: any) => parseProduct(r)) })
    } catch (error) { console.error(error); return json({ success: false, message: "حدث خطأ في جلب المنتجات" }, 500) }
  }

  if (p.length === 2 && p[0] === "admin" && p[1] === "products" && method === "POST") {
    const denied = await adminGuard(request); if (denied) return denied
    try {
      const b: any = body
      const { name, category, price, oldPrice, image, images, badge, colors, sizes, description, featured, bestSeller, active, sizeChart, materialDetails, careInstructions, stock, lowStockThreshold, variantStock } = b
      const normalizedVariants = normalizeVariantStock(variantStock)
      const imageList = Array.isArray(images) ? images.filter(Boolean) : []
      const mainImage = image || imageList[0]
      if (!name || !category || price === undefined || !mainImage) return json({ success: false, message: "بيانات المنتج غير مكتملة" }, 400)
      let slug = slugify(name)
      const exists = await db.execute({ sql: "SELECT id FROM products WHERE slug = ?", args: [slug] })
      if (exists.rows[0]) slug = `${slug}-${Date.now()}`
      const result = await db.execute({
        sql: `INSERT INTO products (slug,name,category,price,old_price,image,images,badge,colors,sizes,description,featured,best_seller,active,size_chart,material_details,care_instructions,stock,low_stock_threshold,variant_stock) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        args: [slug, name, category, Number(price), oldPrice ? Number(oldPrice) : null, mainImage, JSON.stringify(imageList.length ? imageList : [mainImage]), badge || null, JSON.stringify(colors || []), JSON.stringify(sizes || []), description || "", featured ? 1 : 0, bestSeller ? 1 : 0, active === false ? 0 : 1, JSON.stringify(sizeChart || {}), materialDetails || "", careInstructions || "", Object.keys(normalizedVariants).length ? totalVariantStock(normalizedVariants) : Math.max(0, Number(stock ?? 20)), Math.max(0, Number(lowStockThreshold ?? 5)), JSON.stringify(normalizedVariants)]
      })
      return json({ success: true, id: Number(result.lastInsertRowid), slug }, 201)
    } catch (error) { console.error(error); return json({ success: false, message: "حدث خطأ أثناء إضافة المنتج" }, 500) }
  }

  if (p.length === 3 && p[0] === "admin" && p[1] === "products" && method === "PUT") {
    const denied = await adminGuard(request); if (denied) return denied
    const id = numberParam(p[2]); if (!id) return json({ success: false, message: "المنتج غير موجود" }, 404)
    try {
      const ex = await db.execute({ sql: "SELECT * FROM products WHERE id = ?", args: [id] })
      if (!ex.rows[0]) return json({ success: false, message: "المنتج غير موجود" }, 404)
      const e: any = ex.rows[0], b: any = body
      const { name, slug, category, price, oldPrice, image, images, badge, colors, sizes, description, featured, bestSeller, active, sizeChart, materialDetails, careInstructions, stock, lowStockThreshold, variantStock } = b
      const normalizedVariants = variantStock !== undefined ? normalizeVariantStock(variantStock) : safeJsonParse(e.variant_stock, {})
      const imageList = Array.isArray(images) ? images.filter(Boolean) : undefined
      const mainImage = image ?? imageList?.[0]
      await db.execute({ sql: `UPDATE products SET slug=?,name=?,category=?,price=?,old_price=?,image=?,images=?,badge=?,colors=?,sizes=?,description=?,featured=?,best_seller=?,active=?,size_chart=?,material_details=?,care_instructions=?,stock=?,low_stock_threshold=?,variant_stock=? WHERE id=?`, args: [slug ?? e.slug, name ?? e.name, category ?? e.category, price !== undefined ? Number(price) : e.price, oldPrice !== undefined ? (oldPrice ? Number(oldPrice) : null) : e.old_price, mainImage ?? e.image, imageList !== undefined ? JSON.stringify(imageList.length ? imageList : [mainImage ?? e.image]) : e.images, badge !== undefined ? badge : e.badge, colors !== undefined ? JSON.stringify(colors) : e.colors, sizes !== undefined ? JSON.stringify(sizes) : e.sizes, description !== undefined ? description : e.description, featured !== undefined ? (featured ? 1 : 0) : e.featured, bestSeller !== undefined ? (bestSeller ? 1 : 0) : e.best_seller, active !== undefined ? (active ? 1 : 0) : e.active, sizeChart !== undefined ? JSON.stringify(sizeChart) : e.size_chart, materialDetails !== undefined ? materialDetails : e.material_details, careInstructions !== undefined ? careInstructions : e.care_instructions, Object.keys(normalizedVariants).length ? totalVariantStock(normalizedVariants) : (stock !== undefined ? Math.max(0, Number(stock)) : Number(e.stock ?? 0)), lowStockThreshold !== undefined ? Math.max(0, Number(lowStockThreshold)) : Number(e.low_stock_threshold ?? 5), JSON.stringify(normalizedVariants), id] })
      return json({ success: true })
    } catch (error) { console.error(error); return json({ success: false, message: "حدث خطأ أثناء تعديل المنتج" }, 500) }
  }

  if (p.length === 4 && p[0] === "admin" && p[1] === "products" && p[3] === "stock" && method === "PATCH") {
    const denied = await adminGuard(request); if (denied) return denied
    const id = numberParam(p[2]); if (!id) return json({ success: false, message: "المنتج غير موجود" }, 404)
    try {
      const stock = Number((body as any)?.stock)
      if (!Number.isInteger(stock) || stock < 0) return json({success:false,message:"الكمية يجب أن تكون رقمًا صحيحًا غير سالب"},400)
      const product = await db.execute({sql:"SELECT variant_stock FROM products WHERE id=?",args:[id]})
      if (!product.rows[0]) return json({success:false,message:"المنتج غير موجود"},404)
      const variants = normalizeVariantStock(safeJsonParse(product.rows[0].variant_stock, {}))
      if (Object.keys(variants).length) {
        return json({success:false,message:"هذا المنتج يستخدم مخزون الألوان والمقاسات؛ حدّث مخزون كل اختيار من جدول المتغيرات"},400)
      }
      await db.execute({sql:"UPDATE products SET stock=? WHERE id=?",args:[stock,id]})
      return json({success:true,stock})
    } catch(error) {
      console.error(error)
      return json({success:false,message:"حدث خطأ أثناء تحديث المخزون"},500)
    }
  }

  if (p.length === 3 && p[0] === "admin" && p[1] === "products" && method === "DELETE") {
    const denied = await adminGuard(request); if (denied) return denied
    const id = numberParam(p[2]); if (!id) return json({ success:false,message:"المنتج غير موجود" },404)
    try { const r=await db.execute({sql:"DELETE FROM products WHERE id=?",args:[id]}); if(!r.rowsAffected)return json({success:false,message:"المنتج غير موجود"},404); return json({success:true}) }
    catch(error){console.error(error);return json({success:false,message:"حدث خطأ أثناء حذف المنتج"},500)}
  }

  // ---------- reviews ----------
  if (p.length === 3 && p[0] === "products" && p[2] === "reviews" && method === "GET") {
    const productId=numberParam(p[1]); if(!productId)return json({success:false,message:"معرف المنتج غير صحيح"},400)
    try {
      const [rowsResult, statsResult]=await Promise.all([
        db.execute({sql:"SELECT id,product_id,customer_name,rating,comment,created_at FROM product_reviews WHERE product_id=? AND status='approved' ORDER BY id DESC LIMIT 50",args:[productId]}),
        db.execute({sql:"SELECT COUNT(*) AS count,COALESCE(AVG(rating),0) AS average FROM product_reviews WHERE product_id=? AND status='approved'",args:[productId]}),
      ])
      const stats:any=(statsResult.rows as any[])[0]||{}
      return json({success:true,reviews:rowsResult.rows,average:Number(stats.average||0),count:Number(stats.count||0)})
    } catch(error){console.error(error);return json({success:false,message:"تعذر جلب التقييمات"},500)}
  }
  if (p.length === 3 && p[0] === "products" && p[2] === "reviews" && method === "POST") {
    const productId=numberParam(p[1]); const b:any=body; const name=String(b?.customer_name||"").trim(),comment=String(b?.comment||"").trim(),rating=Number(b?.rating); if(!productId||!name||name.length>80||!Number.isInteger(rating)||rating<1||rating>5||!comment||comment.length>500)return json({success:false,message:"من فضلك أدخل تقييمًا صحيحًا"},400)
    try { const product=await db.execute({sql:"SELECT id FROM products WHERE id=? AND active=1",args:[productId]}); if(!product.rows[0])return json({success:false,message:"المنتج غير موجود"},404); await db.execute({sql:"INSERT INTO product_reviews(product_id,customer_name,rating,comment,status) VALUES(?,?,?,?,?)",args:[productId,name,rating,comment,"pending"]}); return json({success:true,message:"تم إرسال تقييمك للمراجعة"},201) }
    catch(error){console.error(error);return json({success:false,message:"تعذر إرسال التقييم"},500)}
  }
  if (p.length === 2 && p[0] === "admin" && p[1] === "reviews" && method === "GET") { const denied=await adminGuard(request);if(denied)return denied; try{const r=await db.execute("SELECT r.*,p.name AS product_name FROM product_reviews r LEFT JOIN products p ON p.id=r.product_id ORDER BY r.id DESC");return json({success:true,reviews:r.rows})}catch(error){console.error(error);return json({success:false,message:"تعذر جلب التقييمات"},500)} }
  if (p.length === 3 && p[0] === "admin" && p[1] === "reviews" && method === "PATCH") { const denied=await adminGuard(request);if(denied)return denied; try{const status=String((body as any)?.status||"");if(!["pending","approved","hidden"].includes(status))return json({success:false,message:"الحالة غير صحيحة"},400);const r=await db.execute({sql:"UPDATE product_reviews SET status=? WHERE id=?",args:[status,Number(p[2])]});if(!r.rowsAffected)return json({success:false,message:"التقييم غير موجود"},404);return json({success:true})}catch(error){console.error(error);return json({success:false,message:"تعذر تحديث التقييم"},500)} }
  if (p.length === 3 && p[0] === "admin" && p[1] === "reviews" && method === "DELETE") { const denied=await adminGuard(request);if(denied)return denied; try{const r=await db.execute({sql:"DELETE FROM product_reviews WHERE id=?",args:[Number(p[2])]});if(!r.rowsAffected)return json({success:false,message:"التقييم غير موجود"},404);return json({success:true})}catch(error){console.error(error);return json({success:false,message:"تعذر حذف التقييم"},500)} }

  // ---------- analytics ----------
  if (p.join("/") === "analytics/events" && method === "POST") {
    try { const events=Array.isArray((body as any)?.events)?(body as any).events:[body]; const allowed=new Set(["page_view","product_view","add_to_cart","begin_checkout","purchase"]); const statements=events.slice(0,20).flatMap((event:any)=>{const type=String(event?.event_type||"");if(!allowed.has(type))return [];const productId=event?.product_id?Number(event.product_id):null;return [{sql:"INSERT INTO analytics_events(event_type,product_id,path,session_id,metadata) VALUES(?,?,?,?,?)",args:[type,Number.isInteger(productId)?productId:null,String(event?.path||"").slice(0,300),String(event?.session_id||"").slice(0,120),JSON.stringify(event?.metadata||{})]}]});if(statements.length)await db.batch(statements,"write"); return json({success:true}) } catch(error){console.error(error);return json({success:false,message:"تعذر تسجيل الإحصائية"},500)}
  }
  if (p.join("/") === "admin/analytics" && method === "GET") {
    const denied=await adminGuard(request);if(denied)return denied
    try {
      const days=Math.min(90,Math.max(1,Number(url.searchParams.get("days")||30)))
      const modifier=`-${days} days`
      const [countsResult,sessionsResult,productsResult]=await Promise.all([
        db.execute({
          sql:"SELECT event_type,COUNT(*) AS count FROM analytics_events WHERE created_at>=datetime('now', ?) GROUP BY event_type",
          args:[modifier],
        }),
        db.execute({
          sql:"SELECT COUNT(DISTINCT session_id) AS count FROM analytics_events WHERE created_at>=datetime('now', ?) AND session_id IS NOT NULL AND session_id != ''",
          args:[modifier],
        }),
        db.execute({
          sql:"SELECT product_id,COUNT(*) AS views FROM analytics_events WHERE event_type='product_view' AND created_at>=datetime('now', ?) AND product_id IS NOT NULL GROUP BY product_id ORDER BY views DESC LIMIT 10",
          args:[modifier],
        }),
      ])
      const counts:any={page_view:0,product_view:0,add_to_cart:0,begin_checkout:0,purchase:0}
      for(const row of countsResult.rows as any[])counts[row.event_type]=(counts[row.event_type]||0)+Number(row.count)
      const uniqueSessions=Number((sessionsResult.rows as any[])[0]?.count||0)
      const ids=(productsResult.rows as any[]).map(r=>Number(r.product_id))
      let names:any[]=[]
      if(ids.length){
        const rs=await db.execute(`SELECT id,name FROM products WHERE id IN (${ids.map(()=>"?").join(",")})`,ids)
        names=rs.rows as any[]
      }
      const nameMap=Object.fromEntries(names.map(r=>[Number(r.id),r.name]))
      return json({
        success:true,
        days,
        counts,
        uniqueSessions,
        topProducts:(productsResult.rows as any[]).map(r=>({
          product_id:Number(r.product_id),
          name:nameMap[Number(r.product_id)]||"منتج",
          views:Number(r.views),
        })),
      })
    }catch(error){console.error(error);return json({success:false,message:"تعذر جلب الإحصائيات"},500)}
  }

  // ---------- coupons ----------
  if (p.join("/") === "coupons/validate" && method === "POST") { try{const b:any=body,code=String(b?.code||"").trim().toUpperCase(),subtotal=Number(b?.subtotal||0);if(!code||!Number.isFinite(subtotal)||subtotal<0)return json({success:false,message:"بيانات الكوبون غير صحيحة"},400);const r=await db.execute({sql:"SELECT * FROM coupons WHERE code=?",args:[code]});const coupon:any=r.rows[0];const discount=couponDiscount(coupon,subtotal,Array.isArray(b?.items)?b.items:[]);if(!coupon||discount<=0)return json({success:false,message:"الكوبون غير صالح أو لا ينطبق على هذا الطلب"},400);return json({success:true,coupon:{code:coupon.code,type:coupon.type,value:coupon.value},discount,total:Math.max(0,subtotal-discount)})}catch(error){console.error(error);return json({success:false,message:"حدث خطأ أثناء التحقق من الكوبون"},500)} }
  if (p.join("/") === "admin/coupons" && method === "GET") { const denied=await adminGuard(request);if(denied)return denied;try{const r=await db.execute("SELECT * FROM coupons ORDER BY id DESC");return json({success:true,coupons:r.rows})}catch(error){console.error(error);return json({success:false,message:"تعذر جلب الكوبونات"},500)} }
  if (p.join("/") === "admin/coupons" && method === "POST") { const denied=await adminGuard(request);if(denied)return denied;try{const b:any=body,{code,type,value,minOrder,maxUses,expiresAt,startsAt,maxDiscount,minItems,productId,category,freeShipping,active}=b;const normalized=String(code||"").trim().toUpperCase();if(!normalized||!["percent","fixed"].includes(type)||!Number.isFinite(Number(value))||Number(value)<0||(type==="percent"&&Number(value)>100))return json({success:false,message:"بيانات الكوبون غير صحيحة"},400);const r=await db.execute({sql:"INSERT INTO coupons(code,type,value,min_order,max_uses,expires_at,starts_at,max_discount,min_items,product_id,category,free_shipping,active) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)",args:[normalized,type,Number(value),Math.max(0,Number(minOrder||0)),Math.max(0,Number(maxUses||0)),expiresAt||null,startsAt||null,maxDiscount===""||maxDiscount==null?null:Math.max(0,Number(maxDiscount)),Math.max(0,Number(minItems||0)),productId?Number(productId):null,category||null,freeShipping?1:0,active===false?0:1]});return json({success:true,id:Number(r.lastInsertRowid)},201)}catch(error:any){console.error(error);return json({success:false,message:error?.message?.includes("UNIQUE")?"كود الكوبون مستخدم بالفعل":"تعذر إنشاء الكوبون"},400)} }
  if (p.length===3&&p[0]==="admin"&&p[1]==="coupons"&&method==="PUT") { const denied=await adminGuard(request);if(denied)return denied;try{const id=Number(p[2]),ex=await db.execute({sql:"SELECT * FROM coupons WHERE id=?",args:[id]});if(!ex.rows[0])return json({success:false,message:"الكوبون غير موجود"},404);const old:any=ex.rows[0],b:any=body,type=b.type??old.type,value=b.value!==undefined?Number(b.value):Number(old.value);if(!["percent","fixed"].includes(type)||value<0||(type==="percent"&&value>100))return json({success:false,message:"بيانات الكوبون غير صحيحة"},400);await db.execute({sql:"UPDATE coupons SET code=?,type=?,value=?,min_order=?,max_uses=?,expires_at=?,starts_at=?,max_discount=?,min_items=?,product_id=?,category=?,free_shipping=?,active=? WHERE id=?",args:[String(b.code??old.code).trim().toUpperCase(),type,value,Math.max(0,Number(b.minOrder??old.min_order)),Math.max(0,Number(b.maxUses??old.max_uses)),b.expiresAt===undefined?old.expires_at:(b.expiresAt||null),b.startsAt===undefined?old.starts_at:(b.startsAt||null),b.maxDiscount===undefined?old.max_discount:(b.maxDiscount===""||b.maxDiscount==null?null:Math.max(0,Number(b.maxDiscount))),Math.max(0,Number(b.minItems??old.min_items)),b.productId===undefined?old.product_id:(b.productId?Number(b.productId):null),b.category===undefined?old.category:(b.category||null),b.freeShipping===undefined?old.free_shipping:(b.freeShipping?1:0),b.active===undefined?old.active:(b.active?1:0),id]});return json({success:true})}catch(error){console.error(error);return json({success:false,message:"تعذر تعديل الكوبون"},400)} }
  if (p.length===3&&p[0]==="admin"&&p[1]==="coupons"&&method==="DELETE") { const denied=await adminGuard(request);if(denied)return denied;try{const r=await db.execute({sql:"DELETE FROM coupons WHERE id=?",args:[Number(p[2])]});if(!r.rowsAffected)return json({success:false,message:"الكوبون غير موجود"},404);return json({success:true})}catch(error){console.error(error);return json({success:false,message:"تعذر حذف الكوبون"},500)} }

  // ---------- live cart stock ----------
  if (p.join("/") === "cart/stock" && method === "POST") {
    try {
      const items = Array.isArray((body as any)?.items) ? (body as any).items.slice(0, 100) : []
      if (!items.length) return json({ success: true, items: [] })

      const normalized = items.map((item: any) => ({
        product_id: Number(item.product_id),
        quantity: Math.floor(Number(item.quantity)),
        selected_color: item.selected_color ? String(item.selected_color) : undefined,
        selected_size: item.selected_size ? String(item.selected_size) : undefined,
      }))

      const invalid = normalized.some((item: any) =>
        !Number.isInteger(item.product_id) || item.product_id <= 0 ||
        !Number.isInteger(item.quantity) || item.quantity <= 0
      )
      if (invalid) return json({ success: false, message: "بيانات السلة غير صحيحة" }, 400)

      const ids: number[] = Array.from(new Set(normalized.map((item: any) => Number(item.product_id))))
      const result = await db.execute(
        `SELECT id, stock, active, variant_stock FROM products WHERE id IN (${ids.map(() => "?").join(",")})`,
        ids
      )
      const products = new Map((result.rows as any[]).map((row) => [Number(row.id), row]))

      const checked = normalized.map((item: any) => {
        const product: any = products.get(item.product_id)
        if (!product || !product.active) {
          return { ...item, requested: item.quantity, available: 0, active: false }
        }

        const variants = safeJsonParse<any>(product.variant_stock, {})
        let available = Number(product.stock ?? 0)

        if (Object.keys(variants).length) {
          const key = `${item.selected_color || "-"}|${item.selected_size || "-"}`
          available = Number(variants[key] ?? 0)
        }

        return {
          ...item,
          requested: item.quantity,
          available: Math.max(0, available),
          active: true,
        }
      })

      return json({ success: true, items: checked })
    } catch (error) {
      console.error(error)
      return json({ success: false, message: "تعذر التحقق من المخزون" }, 500)
    }
  }

  // ---------- admin dashboard summary ----------
  if (p.join("/") === "admin/orders/summary" && method === "GET") {
    const denied = await adminGuard(request); if (denied) return denied
    try {
      const rawOffset = Number(url.searchParams.get("tzOffsetMinutes") || 0)
      const tzOffset = Number.isFinite(rawOffset) ? Math.max(-840, Math.min(840, Math.trunc(rawOffset))) : 0
      const modifier = `${tzOffset <= 0 ? "+" : "-"}${Math.abs(tzOffset)} minutes`
      const localDate = `date(created_at, '${modifier}')`
      const today = `date('now', '${modifier}')`
      const weekStart = `date('now', '${modifier}', '-6 days')`

      const [aggregateResult, statusResult, daysResult, topProductsResult, recentResult] = await Promise.all([
        db.execute({
          sql: `SELECT COUNT(*) AS total_orders, SUM(CASE WHEN status != 'ملغي' THEN 1 ELSE 0 END) AS valid_orders, COALESCE(SUM(CASE WHEN status != 'ملغي' THEN total ELSE 0 END),0) AS all_revenue, SUM(CASE WHEN status != 'ملغي' AND ${localDate} = ${today} THEN 1 ELSE 0 END) AS today_orders, COALESCE(SUM(CASE WHEN status != 'ملغي' AND ${localDate} = ${today} THEN total ELSE 0 END),0) AS today_revenue, SUM(CASE WHEN status != 'ملغي' AND ${localDate} BETWEEN ${weekStart} AND ${today} THEN 1 ELSE 0 END) AS week_orders, COALESCE(SUM(CASE WHEN status != 'ملغي' AND ${localDate} BETWEEN ${weekStart} AND ${today} THEN total ELSE 0 END),0) AS week_revenue FROM orders`,
          args: [],
        }),
        db.execute({ sql: "SELECT status, COUNT(*) AS count FROM orders GROUP BY status", args: [] }),
        db.execute({
          sql: `SELECT ${localDate} AS date, COUNT(*) AS orders, COALESCE(SUM(CASE WHEN status != 'ملغي' THEN total ELSE 0 END),0) AS revenue FROM orders WHERE ${localDate} BETWEEN ${weekStart} AND ${today} GROUP BY ${localDate} ORDER BY date ASC`,
          args: [],
        }),
        db.execute({
          sql: `SELECT oi.product_name AS name, SUM(oi.quantity) AS quantity, COALESCE(SUM(oi.price * oi.quantity),0) AS revenue FROM order_items oi INNER JOIN orders o ON o.id = oi.order_id WHERE o.status != 'ملغي' GROUP BY oi.product_name ORDER BY quantity DESC, revenue DESC LIMIT 5`,
          args: [],
        }),
        db.execute({ sql: "SELECT id,customer_name,phone,total,status,tracking_code,created_at FROM orders ORDER BY id DESC LIMIT 6", args: [] }),
      ])

      const recentRows = recentResult.rows as any[]
      const recentIds = recentRows.map((row) => Number(row.id))
      let itemRows: any[] = []
      if (recentIds.length) {
        const itemsResult = await db.execute(`SELECT id,order_id,product_id,product_name,price,quantity,selected_color,selected_size FROM order_items WHERE order_id IN (${recentIds.map(() => "?").join(",")}) ORDER BY id ASC`, recentIds)
        itemRows = itemsResult.rows as any[]
      }
      const itemsByOrder = new Map<number, any[]>()
      for (const item of itemRows) { const key = Number(item.order_id); const list = itemsByOrder.get(key) || []; list.push(item); itemsByOrder.set(key, list) }
      const recentOrders = recentRows.map((order) => ({ ...order, items: itemsByOrder.get(Number(order.id)) || [] }))
      const aggregate = (aggregateResult.rows as any[])[0] || {}
      const statusCounts: Record<string, number> = {}
      for (const row of statusResult.rows as any[]) statusCounts[String(row.status)] = Number(row.count || 0)
      const days = (daysResult.rows as any[]).map((row) => ({ date: String(row.date), orders: Number(row.orders || 0), revenue: Number(row.revenue || 0) }))
      const topProducts = (topProductsResult.rows as any[]).map((row) => ({ name: String(row.name || ""), quantity: Number(row.quantity || 0), revenue: Number(row.revenue || 0) }))
      const todayOrders = Number(aggregate.today_orders || 0)
      const todayRevenue = Number(aggregate.today_revenue || 0)
      return json({ success: true, stats: { totalOrders: Number(aggregate.total_orders || 0), validOrders: Number(aggregate.valid_orders || 0), allRevenue: Number(aggregate.all_revenue || 0), todayOrders, todayRevenue, weekOrders: Number(aggregate.week_orders || 0), weekRevenue: Number(aggregate.week_revenue || 0), averageToday: todayOrders ? todayRevenue / todayOrders : 0, newOrders: statusCounts["جديد"] || 0, preparing: statusCounts["جاري التجهيز"] || 0, shipping: statusCounts["تم الشحن"] || 0, delivered: statusCounts["تم التسليم"] || 0, canceled: statusCounts["ملغي"] || 0 }, statusCounts, days, topProducts, recentOrders })
    } catch (error) { console.error(error); return json({ success: false, message: "حدث خطأ في جلب ملخص الداشبورد" }, 500) }
  }
  // ---------- orders ----------
  if (p.join("/") === "orders" && method === "GET") {
    const denied=await adminGuard(request); if(denied)return denied
    try {
      const page=Math.max(1,Math.floor(Number(url.searchParams.get("page")||1)))
      const limit=Math.min(50,Math.max(10,Math.floor(Number(url.searchParams.get("limit")||20))))
      const offset=(page-1)*limit
      const q=String(url.searchParams.get("q")||"").trim()
      const status=String(url.searchParams.get("status")||"").trim()
      const sort=String(url.searchParams.get("sort")||"newest")
      const where:string[]=[]
      const args:any[]=[]
      if(status && allowedStatuses.includes(status)){where.push("o.status=?");args.push(status)}
      if(q){
        where.push("(o.customer_name LIKE ? OR o.phone LIKE ? OR CAST(o.id AS TEXT) LIKE ? OR COALESCE(o.tracking_code,'') LIKE ? OR o.governorate LIKE ? OR o.area LIKE ? OR o.address LIKE ? OR EXISTS (SELECT 1 FROM order_items qi WHERE qi.order_id=o.id AND (qi.product_name LIKE ? OR COALESCE(qi.selected_color,'') LIKE ? OR COALESCE(qi.selected_size,'') LIKE ?)))")
        const term=`%${q}%`
        args.push(term,term,term,term,term,term,term,term,term,term)
      }
      const whereSql=where.length ? " WHERE "+where.join(" AND ") : ""
      const orderSql=sort==="oldest"?"o.id ASC":sort==="highest"?"o.total DESC, o.id DESC":sort==="lowest"?"o.total ASC, o.id DESC":"o.id DESC"
      const summaryWhere:string[]=[]
      const summaryArgs:any[]=[]
      if(q){
        summaryWhere.push("(o.customer_name LIKE ? OR o.phone LIKE ? OR CAST(o.id AS TEXT) LIKE ? OR COALESCE(o.tracking_code,'') LIKE ? OR o.governorate LIKE ? OR o.area LIKE ? OR o.address LIKE ? OR EXISTS (SELECT 1 FROM order_items qi WHERE qi.order_id=o.id AND (qi.product_name LIKE ? OR COALESCE(qi.selected_color,'') LIKE ? OR COALESCE(qi.selected_size,'') LIKE ?)))")
        const summaryTerm=`%${q}%`
        summaryArgs.push(summaryTerm,summaryTerm,summaryTerm,summaryTerm,summaryTerm,summaryTerm,summaryTerm,summaryTerm,summaryTerm,summaryTerm)
      }
      const summaryWhereSql=summaryWhere.length ? " WHERE "+summaryWhere.join(" AND ") : ""
      const [countResult,rowsResult,summaryResult]=await Promise.all([
        db.execute({sql:"SELECT COUNT(*) AS count FROM orders o"+whereSql,args}),
        db.execute({sql:"SELECT id,customer_name,phone,governorate,area,address,notes,total,status,tracking_code,created_at FROM orders o"+whereSql+" ORDER BY "+orderSql+" LIMIT ? OFFSET ?",args:[...args,limit,offset]}),
        db.execute({sql:"SELECT status,COUNT(*) AS count,COALESCE(SUM(CASE WHEN status!='ملغي' THEN total ELSE 0 END),0) AS revenue FROM orders o"+summaryWhereSql+" GROUP BY status",args:summaryArgs}),
      ])
      const orderRows=rowsResult.rows as any[]
      const ids=orderRows.map(order=>Number(order.id))
      let itemRows:any[]=[]
      if(ids.length){
        const itemsResult=await db.execute(`SELECT * FROM order_items WHERE order_id IN (${ids.map(()=>"?").join(",")}) ORDER BY id ASC`,ids)
        itemRows=itemsResult.rows as any[]
      }
      const itemsByOrder=new Map<number,any[]>()
      for(const item of itemRows){const key=Number(item.order_id);const list=itemsByOrder.get(key)||[];list.push(item);itemsByOrder.set(key,list)}
      const orders=orderRows.map(order=>({...order,items:itemsByOrder.get(Number(order.id))||[]}))
      const total=Number((countResult.rows as any[])[0]?.count||0)
      const summary:any={all:0,revenue:0}
      for(const row of summaryResult.rows as any[]){const count=Number(row.count||0);summary[row.status]=count;summary.all+=count;summary.revenue+=Number(row.revenue||0)}
      return json({success:true,orders,pagination:{page,limit,total,totalPages:Math.max(1,Math.ceil(total/limit))},summary})
    }catch(error){console.error(error);return json({success:false,message:"حدث خطأ في جلب الطلبات"},500)}
  }

  if (p.join("/") === "orders" && method === "POST") {
    let tx:any=null
    try {
      const b:any=body,{customer_name,phone,governorate,area,address,notes,items,total,coupon_code}=b
      if(!customer_name||!phone||!governorate||!area||!address||!Array.isArray(items)||items.length===0)return json({success:false,message:"بيانات الطلب غير مكتملة"},400)
      const quantities=new Map<number,number>(); for(const item of items){const id=Number(item.product_id),q=Math.floor(Number(item.quantity));if(!Number.isInteger(id)||id<=0||!Number.isInteger(q)||q<=0)return json({success:false,message:"بيانات المنتجات غير صحيحة"},400);quantities.set(id,(quantities.get(id)||0)+q)}
      tx=await db.transaction("write")
      const normalized:any[]=[]
      const ids=Array.from(quantities.keys())
      const productsResult=await tx.execute(`SELECT id,name,category,price,stock,active,variant_stock FROM products WHERE id IN (${ids.map(()=>"?").join(",")})`,ids)
      const products=new Map((productsResult.rows as any[]).map(product=>[Number(product.id),product]))
      for(const [id,qty] of quantities){const product:any=products.get(id);if(!product||!product.active)throw Object.assign(new Error("UNAVAILABLE"),{code:"UNAVAILABLE"});const vs=safeJsonParse<any>(product.variant_stock,{}), matching=items.filter((x:any)=>Number(x.product_id)===id);if(Object.keys(vs).length){for(const item of matching){const key=`${item.selected_color||"-"}|${item.selected_size||"-"}`,q=Math.floor(Number(item.quantity));if(Number(vs[key]??0)<q)throw Object.assign(new Error("OUT_OF_STOCK"),{code:"OUT_OF_STOCK"})}}else if(Number(product.stock)<qty)throw Object.assign(new Error("OUT_OF_STOCK"),{code:"OUT_OF_STOCK"});for(const item of matching)normalized.push({product_id:id,product_name:product.name,price:Number(product.price),quantity:Math.floor(Number(item.quantity)),selected_color:item.selected_color||null,selected_size:item.selected_size||null,category:product.category})}
      const subtotal=normalized.reduce((sum,x)=>sum+x.price*x.quantity,0);let discount=0,coupon:any=null
      if(coupon_code){const cr=await tx.execute({sql:"SELECT * FROM coupons WHERE code=?",args:[String(coupon_code).trim().toUpperCase()]});coupon=cr.rows[0];discount=couponDiscount(coupon,subtotal,normalized);if(!coupon||discount<=0)throw Object.assign(new Error("BAD_COUPON"),{code:"BAD_COUPON"})}
      const finalTotal=Math.max(0,subtotal-discount);if(total!==undefined&&Math.abs(Number(total)-finalTotal)>0.01)throw Object.assign(new Error("PRICE_CHANGED"),{code:"PRICE_CHANGED"})
      let trackingCode=generateTrackingCode(); for(let i=0;i<5;i++){const c=await tx.execute({sql:"SELECT 1 FROM orders WHERE tracking_code=?",args:[trackingCode]});if(!c.rows[0])break;trackingCode=generateTrackingCode()}
      const orderResult=await tx.execute({sql:`INSERT INTO orders (customer_name,phone,governorate,area,address,notes,total,status,tracking_code,coupon_code,discount) VALUES (?,?,?,?,?,?,?,'جديد',?,?,?)`,args:[customer_name,phone,governorate,area,address,notes||"",finalTotal,trackingCode,coupon?coupon.code:null,discount]});const orderId=Number(orderResult.lastInsertRowid)
      for(const item of normalized)await tx.execute({sql:"INSERT INTO order_items(order_id,product_id,product_name,price,quantity,selected_color,selected_size) VALUES(?,?,?,?,?,?,?)",args:[orderId,item.product_id,item.product_name,item.price,item.quantity,item.selected_color,item.selected_size]})
      for(const [id,qty] of quantities){
        const product:any=products.get(id)
        const originalVariantStock=String(product.variant_stock ?? "{}")
        const vs=safeJsonParse<any>(originalVariantStock,{})
        if(Object.keys(vs).length){
          for(const item of normalized.filter(x=>x.product_id===id)){
            const key=`${item.selected_color||"-"}|${item.selected_size||"-"}`
            vs[key]=Number(vs[key]||0)-item.quantity
            if(vs[key]<0)throw Object.assign(new Error("OUT_OF_STOCK"),{code:"OUT_OF_STOCK"})
          }
          const nextVariantStock=JSON.stringify(vs)
          const u=await tx.execute({
            sql:"UPDATE products SET stock=?,variant_stock=? WHERE id=? AND variant_stock=?",
            args:[totalVariantStock(vs),nextVariantStock,id,originalVariantStock],
          })
          if(u.rowsAffected!==1)throw Object.assign(new Error("OUT_OF_STOCK"),{code:"OUT_OF_STOCK"})
        }else{
          const u=await tx.execute({sql:"UPDATE products SET stock=stock-? WHERE id=? AND stock>=?",args:[qty,id,qty]})
          if(u.rowsAffected!==1)throw Object.assign(new Error("OUT_OF_STOCK"),{code:"OUT_OF_STOCK"})
        }
      }
      if(coupon){const u=await tx.execute({sql:"UPDATE coupons SET used_count=used_count+1 WHERE id=? AND (max_uses=0 OR used_count<max_uses)",args:[coupon.id]});if(u.rowsAffected!==1)throw Object.assign(new Error("COUPON_EXHAUSTED"),{code:"BAD_COUPON"})}
      await tx.execute({sql:"INSERT INTO analytics_events(event_type,path,session_id,metadata) VALUES(?,?,?,?)",args:["purchase","/checkout",null,JSON.stringify({order_id:orderId,total:finalTotal})]})
      await tx.commit(); tx=null
      return json({success:true,message:"تم إنشاء الطلب بنجاح",order_id:orderId,tracking_code:trackingCode,discount,total:finalTotal},201)
    }catch(error:any){if(tx)try{await tx.rollback()}catch{};console.error(error);const code=error?.code;if(code==="OUT_OF_STOCK")return json({success:false,message:"تغير المخزون أثناء إتمام الطلب، راجعي السلة وحاولي مرة أخرى"},409);if(code==="BAD_COUPON")return json({success:false,message:"الكوبون غير صالح أو انتهت صلاحيته"},400);if(code==="PRICE_CHANGED")return json({success:false,message:"تغيرت أسعار المنتجات، أعد مراجعة السلة ثم حاول مرة أخرى"},400);if(code==="UNAVAILABLE")return json({success:false,message:"أحد المنتجات لم يعد متاحًا"},400);return json({success:false,message:"حدث خطأ أثناء إنشاء الطلب"},500)}
  }

  if (p.length===3&&p[0]==="orders"&&p[1]==="track"&&method==="GET") { try{const code=String(p[2]).trim().toUpperCase();const r=await db.execute({sql:"SELECT * FROM orders WHERE tracking_code=?",args:[code]});if(!r.rows[0])return json({success:false,message:"لم يتم العثور على طلب بهذا الكود"},404);const order:any=r.rows[0],items=await db.execute({sql:"SELECT * FROM order_items WHERE order_id=?",args:[order.id]});return json({success:true,order:{id:order.id,status:order.status,total:order.total,customer_name:order.customer_name,created_at:order.created_at},items:items.rows})}catch(error){console.error(error);return json({success:false,message:"حدث خطأ"},500)} }
  if (p.length===2&&p[0]==="orders"&&method==="GET") { const denied=await adminGuard(request);if(denied)return denied; try{const id=numberParam(p[1]);if(!id)return json({success:false,message:"الطلب غير موجود"},404);const r=await db.execute({sql:"SELECT * FROM orders WHERE id=?",args:[id]});if(!r.rows[0])return json({success:false,message:"الطلب غير موجود"},404);const items=await db.execute({sql:"SELECT * FROM order_items WHERE order_id=?",args:[id]});return json({success:true,order:r.rows[0],items:items.rows})}catch(error){console.error(error);return json({success:false,message:"حدث خطأ"},500)} }
  if (p.length===3&&p[0]==="orders"&&p[2]==="status"&&method==="PATCH") { const denied=await adminGuard(request);if(denied)return denied;try{const id=numberParam(p[1]),status=String((body as any)?.status||"");if(!id)return json({success:false,message:"الطلب غير موجود"},404);if(!allowedStatuses.includes(status))return json({success:false,message:"حالة الطلب غير صحيحة"},400);const r=await db.execute({sql:"UPDATE orders SET status=? WHERE id=?",args:[status,id]});if(!r.rowsAffected)return json({success:false,message:"الطلب غير موجود"},404);return json({success:true,message:"تم تحديث حالة الطلب"})}catch(error){console.error(error);return json({success:false,message:"حدث خطأ أثناء تحديث الطلب"},500)} }

  // ---------- customers ----------
  if (p.join("/")==="admin/customers"&&method==="GET") { const denied=await adminGuard(request);if(denied)return denied;try{const r=await db.execute("SELECT o.phone,COUNT(*) AS orders_count,SUM(CASE WHEN o.status='ملغي' THEN 0 ELSE o.total END) AS total_spent,MAX(o.created_at) AS last_order_at,MIN(o.created_at) AS first_order_at,(SELECT x.customer_name FROM orders x WHERE x.phone=o.phone ORDER BY x.id DESC LIMIT 1) AS customer_name,(SELECT x.governorate FROM orders x WHERE x.phone=o.phone ORDER BY x.id DESC LIMIT 1) AS governorate,(SELECT x.area FROM orders x WHERE x.phone=o.phone ORDER BY x.id DESC LIMIT 1) AS area,(SELECT x.address FROM orders x WHERE x.phone=o.phone ORDER BY x.id DESC LIMIT 1) AS address FROM orders o WHERE TRIM(COALESCE(o.phone,''))<>'' GROUP BY o.phone ORDER BY last_order_at DESC");const customers=(r.rows as any[]).map(x=>({...x,phone:String(x.phone).trim(),orders_count:Number(x.orders_count||0),total_spent:Number(x.total_spent||0)}));return json({success:true,customers})}catch(error){console.error(error);return json({success:false,message:"حدث خطأ في جلب العملاء"},500)} }
  if (p.length===4&&p[0]==="admin"&&p[1]==="customers"&&p[3]==="orders"&&method==="GET") { const denied=await adminGuard(request);if(denied)return denied;try{const phone=String(p[2]||"").trim();if(!phone)return json({success:false,message:"رقم الهاتف غير صحيح"},400);const result=await db.execute({sql:"SELECT id,customer_name,phone,governorate,area,address,notes,total,status,tracking_code,created_at FROM orders WHERE phone=? ORDER BY id DESC",args:[phone]});const orderRows=result.rows as any[];const ids=orderRows.map(order=>Number(order.id));let itemRows:any[]=[];if(ids.length){const itemsResult=await db.execute(`SELECT * FROM order_items WHERE order_id IN (${ids.map(()=>"?").join(",")}) ORDER BY id ASC`,ids);itemRows=itemsResult.rows as any[]}const itemsByOrder=new Map<number,any[]>();for(const item of itemRows){const key=Number(item.order_id);const list=itemsByOrder.get(key)||[];list.push(item);itemsByOrder.set(key,list)}const orders=orderRows.map(order=>({...order,items:itemsByOrder.get(Number(order.id))||[]}));return json({success:true,orders})}catch(error){console.error(error);return json({success:false,message:"حدث خطأ في جلب طلبات العميل"},500)} }

  // ---------- contact ----------
  if (p.join("/")==="contact"&&method==="POST") {
    try{
      const b:any=body
      const name=String(b?.name||"").trim()
      const phone=String(b?.phone||"").trim()
      const message=String(b?.message||"").trim()
      if(!name||!phone||!message)return json({success:false,message:"من فضلك أكملي كل الحقول"},400)
      if(name.length>80||phone.length>30||message.length>1000)return json({success:false,message:"البيانات المدخلة طويلة جدًا"},400)
      if(!/^[0-9+()\s.-]{7,30}$/.test(phone))return json({success:false,message:"رقم الهاتف غير صحيح"},400)
      const r=await db.execute({sql:"INSERT INTO contact_messages(name,phone,message) VALUES(?,?,?)",args:[name,phone,message]})
      return json({success:true,id:Number(r.lastInsertRowid)})
    }catch(error){console.error(error);return json({success:false,message:"حدث خطأ أثناء إرسال الرسالة"},500)}
  }
  if (p.join("/")==="admin/contact-messages"&&method==="GET") { const denied=await adminGuard(request);if(denied)return denied;try{const r=await db.execute("SELECT * FROM contact_messages ORDER BY id DESC");return json({success:true,messages:r.rows})}catch(error){console.error(error);return json({success:false,message:"حدث خطأ في جلب الرسائل"},500)} }
  if (p.length===4&&p[0]==="admin"&&p[1]==="contact-messages"&&p[3]==="read"&&method==="PATCH") { const denied=await adminGuard(request);if(denied)return denied;try{await db.execute({sql:"UPDATE contact_messages SET is_read=1 WHERE id=?",args:[p[2]]});return json({success:true})}catch(error){console.error(error);return json({success:false,message:"حدث خطأ أثناء التحديث"},500)} }
  if (p.length===3&&p[0]==="admin"&&p[1]==="contact-messages"&&method==="DELETE") { const denied=await adminGuard(request);if(denied)return denied;try{await db.execute({sql:"DELETE FROM contact_messages WHERE id=?",args:[p[2]]});return json({success:true})}catch(error){console.error(error);return json({success:false,message:"حدث خطأ أثناء الحذف"},500)} }

  // ---------- settings ----------
  if (p.join("/")==="settings"&&method==="GET") { try{const r=await db.execute("SELECT key,value FROM settings");return json({success:true,settings:Object.fromEntries((r.rows as any[]).map(x=>[x.key,x.value]))})}catch(error){console.error(error);return json({success:false,message:"حدث خطأ في جلب الإعدادات"},500)} }
  if (p.join("/")==="admin/settings"&&method==="PUT") { const denied=await adminGuard(request);if(denied)return denied;try{const statements=Object.entries((body as any)||{}).map(([key,value])=>({sql:"INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",args:[key,String(value)]}));if(statements.length)await db.batch(statements,"write");revalidateTag("settings", "max");return json({success:true})}catch(error){console.error(error);return json({success:false,message:"حدث خطأ أثناء حفظ الإعدادات"},500)} }

  // ---------- image upload ----------
  if (p.join("/")==="admin/upload"&&method==="POST") {
    const denied=await adminGuard(request);if(denied)return denied
    try {
      if(!process.env.CLOUDINARY_CLOUD_NAME)return json({success:false,message:"Cloudinary غير مُعدّ"},500)
      const form=await request.formData();const file=form.get("image");if(!(file instanceof File))return json({success:false,message:"لم يتم إرسال صورة"},400)
      if(!file.type.startsWith("image/"))return json({success:false,message:"ملفات الصور فقط مسموحة"},400)
      const buffer=Buffer.from(await file.arrayBuffer());if(buffer.byteLength>4*1024*1024)return json({success:false,message:"حجم الصورة كبير جدًا (الحد 4MB)"},400)
      const result:any=await new Promise((resolve,reject)=>{const stream=cloudinary.uploader.upload_stream({folder:"dahab-store",resource_type:"image"},(error,result)=>error?reject(error):resolve(result));stream.end(buffer)});return json({success:true,url:result.secure_url})
    }catch(error:any){console.error("Upload error:",error);return json({success:false,message:"فشل رفع الصورة: "+(error?.message||"خطأ غير معروف")},500)}
  }

  return json({ success: false, message: "المسار غير موجود" }, 404)
}

export async function GET(request: Request, context: { params: Promise<{ path?: string[] }> }) {
  try { return await handle(request, "GET", (await context.params).path || []) }
  catch (error) { console.error(error); return json({ success: false, message: "حدث خطأ في الخادم" }, 500) }
}
export async function POST(request: Request, context: { params: Promise<{ path?: string[] }> }) {
  try { return await handle(request, "POST", (await context.params).path || []) }
  catch (error) { console.error(error); return json({ success: false, message: "حدث خطأ في الخادم" }, 500) }
}
export async function PUT(request: Request, context: { params: Promise<{ path?: string[] }> }) {
  try { return await handle(request, "PUT", (await context.params).path || []) }
  catch (error) { console.error(error); return json({ success: false, message: "حدث خطأ في الخادم" }, 500) }
}
export async function PATCH(request: Request, context: { params: Promise<{ path?: string[] }> }) {
  try { return await handle(request, "PATCH", (await context.params).path || []) }
  catch (error) { console.error(error); return json({ success: false, message: "حدث خطأ في الخادم" }, 500) }
}
export async function DELETE(request: Request, context: { params: Promise<{ path?: string[] }> }) {
  try { return await handle(request, "DELETE", (await context.params).path || []) }
  catch (error) { console.error(error); return json({ success: false, message: "حدث خطأ في الخادم" }, 500) }
}
