# DAHAB — متجر عبايات وإكسسوارات

متجر إلكتروني مبني بـ Next.js App Router + Turso + Cloudinary مع لوحة تحكم للأدمن.

## التشغيل محليًا

```bash
npm ci
npm run dev
```

الموقع يعمل افتراضيًا على `http://localhost:3000`.

## متغيرات البيئة

- `TURSO_DATABASE_URL`
- `TURSO_AUTH_TOKEN`
- `ADMIN_USER`
- `ADMIN_PASS`
- `ADMIN_TOKEN_SECRET` — قيمة عشوائية قوية، ويفضل 32 حرفًا أو أكثر.
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`
- `NEXT_PUBLIC_SITE_URL` — الدومين الأساسي للموقع ويُستخدم في metadata وsitemap.

## قاعدة البيانات

تهيئة الـschema والـmigrations لا تعمل أثناء استقبال الطلبات. بعد تجهيز متغيرات Turso شغّل:

```bash
npm run db:migrate
```

في الإنتاج، شغّل migration كخطوة نشر/إدارة منفصلة قبل توجيه الترافيك للنسخة الجديدة.


التطبيق يتحقق فقط من جاهزية الـschema أثناء runtime. إذا كانت الجداول المطلوبة ناقصة، سيطلب تشغيل migration بدل تعديل قاعدة البيانات تلقائيًا.


لا يتم إدخال منتجات تجريبية تلقائيًا في الإنتاج.


## لوحة الأدمن

`http://localhost:3000/admin/login`

بيانات الدخول الافتراضية (من `backend/.env.example`):
- Username: `admin`
- Password: `dahab123`

⚠️ ده auth بسيط جدًا لأغراض العرض (token في الذاكرة، بيتصفر لما تعيد تشغيل السيرفر). قبل ما تنزل المتجر لأي بيئة حقيقية، لازم auth أقوى (hashed password, persisted sessions/JWT).

من اللوحة تقدر:
- تشوف كل الطلبات، تفلترها بالحالة، وتحدّث حالة كل طلب.
- تضيف/تعدّل/تحذف منتجات، وتتحكم في ظهورها بالمتجر (active/hidden).

## تتبع الطلب

العميل يقدر يتابع طلبه من `/track` باستخدام كود التتبع الذي يظهر بعد إتمام الطلب.

## الحالة الحالية

- قاعدة البيانات: Turso
- التخزين السحابي للصور: Cloudinary
- API: Next.js App Router

- ✅ واجهة المتجر بنفس هوية DAHAB: الرئيسية، المنتجات، تفاصيل المنتج، السلة، المفضلة، Checkout، التتبع، التواصل، الشحن والاسترجاع.
- ✅ بحث سريع من الهيدر + فلترة وترتيب محسّنان للمنتجات + واجهة Mobile-first.
- ✅ عرض المخزون وحالات نفاد/انخفاض المخزون للعميل.
- ✅ كوبونات خصم مرتبطة فعليًا بالـCheckout والـBackend.
- ✅ التحقق من السعر والمخزون من قاعدة البيانات عند إنشاء الطلب بدل الاعتماد على بيانات المتصفح.
- ✅ خصم المخزون تلقائيًا عند إنشاء الطلب، وحفظ الكوبون والخصم مع الطلب.
- ✅ لوحة أدمن كاملة: Dashboard، طلبات، منتجات، مخزون، عملاء، تقارير، كوبونات، إشعارات، رسائل، إعدادات الصفحة والشكل.
- ⏳ الدفع الإلكتروني غير مفعّل حاليًا (الدفع عند الاستلام هو المتاح).
- ✅ Auth الأدمن يستخدم جلسات محفوظة في Turso وCookie محمية.

## Production deployment checklist

Before deploying to Vercel, run `npm run db:migrate` against the target Turso database, then configure all required environment variables. In particular,
`ADMIN_TOKEN_SECRET` must be a cryptographically random value of at least 32 characters;
there are intentionally no production fallback admin credentials in the server code.

Required variables:
- `TURSO_DATABASE_URL`
- `TURSO_AUTH_TOKEN`
- `ADMIN_USER`
- `ADMIN_PASS`
- `ADMIN_TOKEN_SECRET`
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`

`ADMIN_TOKEN_TTL_SECONDS` is optional and defaults to 8 hours.


<!-- CI refresh -->
