# متجر لولو — Lulu Store

متجر إلكتروني عربي (RTL) لبيع الشنط والملابس، مع **الدفع بتحويل فودافون كاش** و**حالة دفع واضحة لكل طلب** (تم الدفع / منتظر التأكيد / غير مؤكد).
لوحة التحكم محمية بتسجيل دخول **بالإيميل وكلمة السر** (المالك فقط + مسؤولين يضيفهم المالك بصلاحية مؤقتة أو دائمة)، والعملاء بيدخلوا المتجر ويشتروا **من غير أي تسجيل**.

---

## 1) التقنيات

| الجزء | التقنية |
|---|---|
| الواجهة | React 19 + TypeScript + Tailwind CSS v4 (RTL عربي) + react-router-dom |
| الخلفية (API) | Hono على Cloudflare Workers (ملفات `server/`) |
| قاعدة البيانات | Cloudflare D1 (SQLite) — binding اسمه `DB` |
| الصور | جدول `images` في D1 (بتتصغّر وتتضغط في المتصفح قبل الرفع) — مش محتاج R2 |
| الأصول الثابتة | Cloudflare Assets (SPA) — binding اسمه `ASSETS` |
| الأدوات | Vite 8 + `@cloudflare/vite-plugin` + Wrangler + TypeScript 7 |

مفيش متغيرات بيئة إجبارية — الإعدادات وحسابات المسؤولين محفوظة في D1. (متغير سري **اختياري** اسمه `SETUP_KEY` — شوف قسم الأمان).

---

## 2) التشغيل خطوة بخطوة

المتطلبات: Node.js 20.19+ (يفضّل 22).

```bash
npm install        # تحميل الحزم
npm run dev        # تشغيل الموقع → http://localhost:3000
```

الجداول بتتعمل **تلقائيًا** أول طلب API (ملف `server/schema.ts`) — مفيش migrations تشغّلها.

أوامر أخرى:

```bash
npm run typecheck  # فحص الأنواع
npm run build      # بناء نسخة الإنتاج
```

### أول دخول للوحة التحكم

1. افتح `/admin`
2. اكتب إيميل المالك `eljoker1213141@gmail.com` واختار كلمة سر (8 خانات على الأقل) — **أي إيميل تاني بيترفض**.
3. من تبويب **المسؤولين** تقدر تضيف إيميلات تانية (مؤقتة أو دائمة).

> العملاء بيدخلوا الموقع عادي. لوحة التحكم لها مسار مستقل `/admin`.

### مكان البيانات المحلية

- قاعدة D1 المحلية: `.wrangler/state/v3/d1/`

لو عايز تبدأ من جديد: امسح مجلد `.wrangler` وشغّل `npm run dev`.

---

## 3) هيكل المشروع

```
.
├── index.html                  # نقطة دخول الـ SPA (dir="rtl" lang="ar")
├── vite.config.ts              # إعداد Vite + Tailwind + إضافة Cloudflare
├── wrangler.jsonc              # إعداد الـ Worker: D1 + Assets
├── tsconfig.json               # إعداد TypeScript (يشمل src و server)
│
├── server/                     # ===== الخلفية (Hono Worker) =====
│   ├── index.ts                # تركيب الـ app + معالجة الأخطاء و SPA fallback
│   ├── public.ts               # API العام (متاح للعملاء)
│   ├── admin.ts                # API الإدارة + تسجيل الدخول + إدارة المسؤولين
│   ├── schema.ts               # إنشاء الجداول تلقائيًا
│   └── lib.ts                  # الأنواع، الباسورد، الجلسات، الإعدادات، الـ mappers
│
└── src/                        # ===== الواجهة =====
    ├── main.tsx                # تشغيل React
    ├── App.tsx                 # كل المسارات (Routes)
    ├── index.css               # ثيم Tailwind + كلاسات (.btn-primary, .input, .card…)
    ├── lib/
    │   ├── api.ts              # عميل الـ fetch + تعريف الأنواع (Product, Order…)
    │   ├── useApi.ts           # hook لجلب البيانات (GET) مع reload()
    │   ├── cart.tsx            # حالة السلة (Context + localStorage)
    │   ├── store.tsx           # بيانات المتجر (الاسم، الإعلان، الشحن)
    │   └── format.ts           # تنسيق الجنيه والتاريخ + ألوان الحالات
    ├── components/
    │   ├── Layout.tsx          # الهيدر + شريط الإعلان + الفوتر
    │   ├── ProductCard.tsx     # كارت المنتج
    │   └── Bits.tsx            # الأيقونات، السبينر، الشارات، الصورة البديلة
    └── pages/
        ├── Home.tsx  ProductsPage.tsx  ProductPage.tsx
        ├── CartPage.tsx  CheckoutPage.tsx
        ├── OrderPage.tsx  TrackPage.tsx  NotFound.tsx
        └── admin/
            ├── AdminShell.tsx      # حارس الجلسة + تبويبات اللوحة
            ├── AdminLogin.tsx      # الدخول بالإيميل / تفعيل حساب المالك
            ├── AdminTeam.tsx       # (للمالك فقط) إضافة مسؤولين بمدة صلاحية
            ├── AdminDashboard.tsx  # إحصائيات + طلبات تنتظر تأكيد الدفع
            ├── AdminProducts.tsx   # إضافة/تعديل/حذف المنتجات + رفع الصور
            ├── AdminOrders.tsx     # الطلبات وتأكيد/رفض الدفع
            └── AdminSettings.tsx   # إعدادات المتجر + تغيير كلمة السر
```

---

## 4) قاعدة البيانات

### جدول `products`

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | TEXT | UUID |
| `name` | TEXT | اسم المنتج |
| `description` | TEXT | الوصف |
| `category` | TEXT | القسم (يُشتق تلقائيًا في الواجهة عبر `GROUP BY`) |
| `price` | INTEGER | السعر بالجنيه (صحيح) |
| `compare_price` | INTEGER | السعر قبل الخصم (0 = بدون خصم) |
| `image_key` | TEXT | مفتاح الصورة في جدول `images` → تُعرض في `/api/images/{key}` |
| `vodafone_number` | TEXT | **رقم فودافون كاش الخاص بالمنتج** (يظهر للعميل وقت الطلب) |
| `stock` | INTEGER | الكمية المتوفرة |
| `active` | INTEGER | 1 ظاهر للعملاء، 0 مخفي |
| `featured` | INTEGER | 1 = منتج مميز |
| `created_at` / `updated_at` | TEXT | ISO timestamp |

### جدول `orders`

| العمود | النوع | ملاحظات |
|---|---|---|
| `code` | TEXT UNIQUE | رقم الطلب (6 أرقام) — العميل يتتبع بيه + الموبايل |
| `customer_name`, `phone`, `address`, `notes` | TEXT | بيانات التوصيل (`phone` له فهرس) |
| `items` | TEXT | JSON: `[{productId, name, price, qty, image}]` |
| `subtotal`, `shipping`, `total` | INTEGER | بالجنيه |
| `payment_number` | TEXT | أرقام الفودافون كاش المستلمة (مفصولة بفاصلة) |
| `payment_ref` | TEXT | رقم عملية التحويل اللي كتبه العميل |
| `payment_status` | TEXT | `pending` \| `paid` \| `rejected` |
| `status` | TEXT | `new` \| `confirmed` \| `shipped` \| `delivered` \| `cancelled` |
| `created_at` / `updated_at` | TEXT | ISO timestamp |

### جدول `settings`

ثنائي (key/value). المفاتيح الموجودة:

`store_name` · `store_phone` · `announcement` · `shipping_fee` · `session_secret` (يُولَّد تلقائيًا).

### جدول `admins`

| العمود | ملاحظات |
|---|---|
| `email` | الإيميل (lowercase) — المفتاح الأساسي |
| `password_hash` | PBKDF2-SHA256 |
| `expires_at` | تاريخ انتهاء الصلاحية — `NULL` = غير محدودة (المالك دايمًا بلا انتهاء) |
| `created_by` / `created_at` / `last_login_at` | تتبّع |

جدول `images` (الصور) وجدول `login_attempts` (تقييد المحاولات) بيتعملوا تلقائيًا كمان.

### إضافة تعديل على الجداول

1. أضف `ALTER TABLE ... ADD COLUMN ...` لقائمة `STATEMENTS` في `server/schema.ts` (بشكل آمن للتكرار، مثلاً داخل try منفصل أو بإنشاء جدول جديد بـ `IF NOT EXISTS`).
2. أعد تشغيل `npm run dev`.
3. حدّث الأنواع في `server/lib.ts` (`ProductRow` / `OrderRow`) والدوال `publicProduct` / `adminProduct` / `publicOrder`.
4. حدّث الـ payload في `server/admin.ts` (`readProduct`) وفي الواجهة.

---

## 5) الـ API

**قاعدة:** كل الردود JSON. نجاح: `{"ok": true, ...}` — فشل: `{"ok": false, "message": "…"}` مع كود مناسب
(`400` بيانات، `401` غير مخوّل، `404` غير موجود، `409` تعارض، `413` صورة كبيرة، `429` محاولات كثيرة، `500` خطأ).

كل المسارات تبدأ بـ `/api`.

### 5.1 مسارات عامة (بدون دخول)

| Method | المسار | الوصف |
|---|---|---|
| GET | `/api/health` | فحص حياة الخدمة |
| GET | `/api/store` | اسم المتجر، رقم التواصل، شريط الإعلان، رسوم الشحن |
| GET | `/api/categories` | الأقسام مع عدد منتجاتها |
| GET | `/api/products?category=&q=` | المنتجات النشطة فقط |
| GET | `/api/products/:id` | منتج واحد |
| GET | `/api/images/:key` | الصورة (كاش سنة) |
| GET | `/api/payment/numbers?ids=id1,id2` | أرقام فودافون كاش المطلوبة لتحويل المبلغ |
| POST | `/api/orders` | إنشاء طلب جديد |
| GET | `/api/orders/track?phone=010…` | كل طلبات رقم موبايل معين |
| GET | `/api/orders/:code?phone=010…` | طلب واحد |
| GET | `/api/orders/:code/messages?phone=010…` | رسائل المحادثة الخاصة بالطلب (تتطلب رقم الطلب + موبايل العميل) |
| POST | `/api/orders/:code/messages` | `{phone, body}` إرسال رسالة من العميل (حد 1000 حرف، 6 رسائل/دقيقة) |

**شكل المنتج العام:**

```json
{
  "id": "42e4d4f4-2d5d-439e-a1e6-3642e508efe6",
  "name": "شنطة ظهر كلاسيك",
  "description": "...",
  "category": "شنط",
  "price": 850,
  "comparePrice": 1000,
  "image": "/api/images/<key>.jpg",
  "stock": 12,
  "active": true,
  "featured": true,
  "createdAt": "2026-10-21T23:16:13.205Z"
}
```

**إنشاء طلب:**

```bash
curl -X POST http://localhost:3000/api/orders \
  -H 'content-type: application/json' \
  -d '{
    "name": "أحمد محمد",
    "phone": "01098765432",
    "address": "القاهرة - مدينة نصر - شارع مصطفى النحاس 12",
    "notes": "اتصل بيا قبل التوصيل",
    "paymentRef": "884422",
    "items": [{ "productId": "42e4d4f4-...", "qty": 2 }]
  }'
```

رد ناجح (`201`):

```json
{
  "ok": true,
  "order": {
    "code": "150174",
    "customerName": "أحمد محمد",
    "phone": "01098765432",
    "address": "...",
    "notes": "...",
    "items": [{ "productId": "...", "name": "شنطة ظهر كلاسيك", "price": 850, "qty": 2, "image": null }],
    "subtotal": 1700,
    "shipping": 50,
    "total": 1750,
    "paymentNumbers": ["01012345678"],
    "paymentRef": "884422",
    "paymentStatus": "pending",
    "status": "new",
    "createdAt": "2026-10-21T23:16:13.205Z",
    "updatedAt": "2026-10-21T23:16:13.205Z"
  }
}
```

**التحقق اللي بيحصل في الخادم عند إنشاء الطلب:**

- الاسم ≥ 3 حروف، العنوان ≥ 10 حروف، الموبايل يطابق `^01[0125][0-9]{8}$`
- كل منتج لازم يكون `active = 1` والكمية ≤ `stock`
- الأسعار تُحسب من قاعدة البيانات **مش من العميل**
- خصم المخزون داخل `db.batch()` مع شرط `stock >= qty` (ماينخصمش تحت الصفر)
- `shipping` ييجي من `settings.shipping_fee`
- رقم الطلب = 6 أرقام عشوائية + فحص التفرد (6 محاولات)
- الطلب بيتولد دائمًا بحالة `payment_status = pending`

### 5.2 مسارات الإدارة

الجلسة بكوكي `admin_session` (HttpOnly) — الـ fetch في الواجهة بيبعتها تلقائيًا (`credentials: 'same-origin'`).

**مسارات قبل المصادقة:**

| Method | المسار | الوصف |
|---|---|---|
| GET | `/api/admin/bootstrap` | `{needsSetup, setupKeyRequired, authenticated, admin}` — بتاع شاشة الدخول |
| POST | `/api/admin/setup` | تفعيل حساب المالك أول مرة `{email, password, setupKey?}` — لإيميل المالك فقط |
| POST | `/api/admin/login` | `{email, password}` → يضبط الكوكي |
| POST | `/api/admin/logout` | يمسح الكوكي |

**مسارات محمية** (ترجع `401` من غير كوكي صالح):

| Method | المسار | الوصف |
|---|---|---|
| PUT | `/api/admin/password` | `{current, next}` تغيير كلمة سر الحساب الحالي |
| GET | `/api/admin/team` | **(مالك فقط)** قائمة المسؤولين |
| POST | `/api/admin/team` | **(مالك فقط)** `{email, password, expiresInHours}` — `null` = غير محدودة |
| PATCH | `/api/admin/team/:email` | **(مالك فقط)** تعديل المدة (من الآن) و/أو إعادة تعيين كلمة السر |
| DELETE | `/api/admin/team/:email` | **(مالك فقط)** سحب الصلاحية فورًا |
| GET | `/api/admin/settings` | قراءة إعدادات المتجر |
| PUT | `/api/admin/settings` | `{storeName, storePhone, announcement, shippingFee}` |
| POST | `/api/admin/images` | رفع صورة (multipart, حقل `file`، JPG/PNG/WEBP/GIF حتى ~1.4MB — الواجهة بتضغطها تلقائيًا) → `{key, url}` |
| GET | `/api/admin/products` | كل المنتجات (بما فيها المخفية) + `vodafoneNumber` |
| POST | `/api/admin/products` | إنشاء منتج |
| PUT | `/api/admin/products/:id` | تعديل منتج |
| DELETE | `/api/admin/products/:id` | حذف منتج (ويمسح صورته لو مفيش غيره بيستخدمها) |
| GET | `/api/admin/orders?payment=&status=&q=` | الطلبات + عدّادات لكل حالة دفع |
| GET | `/api/admin/orders/:code` | تفاصيل طلب |
| GET | `/api/admin/orders/:code/messages` | محادثة الطلب (بتعلّم رسائل العميل كمقروءة) |
| POST | `/api/admin/orders/:code/messages` | `{body}` رد المسؤول على العميل |
| PATCH | `/api/admin/orders/:code` | `{paymentStatus?, status?, paymentRef?}` |
| GET | `/api/admin/stats` | إحصائيات اللوحة |

**مثال: تأكيد دفع طلب**

```bash
curl -X PATCH http://localhost:3000/api/admin/orders/150174 \
  -b cookies.txt -H 'content-type: application/json' \
  -d '{"paymentStatus":"paid","status":"confirmed"}'
```

**مثال: إضافة منتج**

```bash
curl -X POST http://localhost:3000/api/admin/products \
  -b cookies.txt -H 'content-type: application/json' \
  -d '{
    "name": "شنطة كتف نسائية",
    "description": "جلد صناعي — ألوان متعددة",
    "category": "شنط",
    "price": 650,
    "comparePrice": 800,
    "stock": 20,
    "vodafoneNumber": "01012345678",
    "imageKey": "3f6e....jpg",
    "featured": true,
    "active": true
  }'
```

**رفع صورة:**

```bash
curl -X POST http://localhost:3000/api/admin/images \
  -b cookies.txt -F "file=@./photo.jpg"
# → {"ok":true,"key":"<uuid>.jpg","url":"/api/images/<uuid>.jpg"}
```

**قيود الإدخال:** اسم المنتج ≥ 2 حرف · السعر 0..10,000,000 · المخزون 0..100,000 ·
رقم الفودافون `^01[0125][0-9]{8}$` (وممكن يكون فاضل) · الصورة JPG/PNG/WEBP/GIF بحد أقصى ~1.4MB · إسم المتجر ≥ 2 · رسوم الشحن 0..10,000.

---

## 6) المصادقة والأمان

| النقطة | التنفيذ |
|---|---|
| من يدخل؟ | **المالك** `eljoker1213141@gmail.com` (ثابت في `server/lib.ts → OWNER_EMAIL`) + مسؤولين بيضيفهم المالك فقط |
| كلمات السر | **PBKDF2-SHA256** — 100,000 تكرار، salt عشوائي، 8 خانات على الأقل |
| الجلسة | توكن موقّع بـ HMAC-SHA256 يحمل الإيميل + بصمة كلمة السر، صالح 7 أيام |
| التحقق في **كل** طلب | الإيميل لسه موجود + صلاحيته ما خلصتش → سحب/انتهاء الصلاحية بيطرد المسؤول فورًا |
| تغيير كلمة السر | بيبطّل كل الجلسات القديمة لنفس الحساب |
| الكوكي | `admin_session` — `HttpOnly` + `SameSite=Lax` + `Secure` على HTTPS |
| تقييد المحاولات | 10 محاولات غلط لكل IP و40 لكل إيميل خلال 10 دقائق ثم `429` (محفوظ في D1) |
| إضافة المسؤولين | للمالك فقط (`requireOwner`) — المالك نفسه مينفعش يتعدّل أو يتحذف |
| الصور | بتتخدم عبر `/api/images/:key` فقط، وبصيغ محددة (من غير SVG) |
| العميل | **من غير تسجيل** — التتبع بـ (رقم الموبايل + رقم الطلب) فقط |

> **تنبيه مهم:** الإيميل ما بيتأكدش بإرسال كود (مفيش خدمة بريد). عشان كده **فعّل حساب المالك فور أول نشر** — أول مين يفعّله بيحدد كلمة السر. لو عايز حماية إضافية خلال الفترة دي: ضيف Secret اسمه `SETUP_KEY` في Cloudflare (Settings → Variables and Secrets) وساعتها شاشة التفعيل هتطلبه.

### محادثة الطلب (عميل ↔ مسؤول)

كل طلب له محادثة خاصة (جدول `order_messages`): العميل بيدخلها من صفحة الطلب `/order/:code`، والمسؤولين من تفاصيل الطلب في لوحة التحكم (مع شارة «رسالة جديدة» وفلتر «رسائل جديدة»). مفيش أي مسار عام بيعرض الرسائل: الوصول للعميل بيتطلب **رقم الطلب + موبايل الطلب** (وفي حد للمحاولات الغلط)، وللمسؤولين بيتطلب تسجيل دخول. العميل مبيشوفش إيميل المسؤول، بيشوف «المتجر» بس.

## 7) منطق الدفع (فودافون كاش)

الدفع **تحويل يدوي** — مفيش API مباشر من فودافون للمتاجر الصغيرة، فالطريقة العملية:

1. المسؤول بيدخل **رقم فودافون كاش مع كل منتج** وقت الإنشاء/التعديل.
2. وقت إتمام الطلب، الواجهة بتطلب `GET /api/payment/numbers?ids=...` وتعرض للعميل: المبلغ + الرقم (بالضغط بيتنسخ) + خانة **رقم عملية التحويل**.
3. الطلب يتسجل `payment_status = pending` → بيظهر للعميل «منتظر تأكيد الدفع».
4. المسؤول يراجع التحويل في محفظته ويضغط **تم الدفع** (`paid`) أو **رفض الدفع** (`rejected`) أو يرجّعه `pending`.
5. العميل بيتابع فورًا من `/track` أو `/order/:code`.

لتفعيل **دفع أوتوماتيكي** لاحقًا (Paymob / Kashier بيدعموا Vodafone Cash): أضف endpoint للـ callback يحدّث `payment_status` بعد التحقق من التوقيع، وخلي إنشاء الطلب يوجّه لصفحة الدفع بدل العرض اليدوي — الباقي (الحالات والطلبات) موجود.

---

## 8) الواجهة الأمامية

- **السلة**: `src/lib/cart.tsx` — Context محفوظ في `localStorage` تحت المفتاح `store_cart_v1`.
- **رقم الموبايل الأخير**: `localStorage.store_phone` (يُستخدم لتعبئة تتبّع الطلب تلقائيًا).
- **جلب البيانات**: hook `useApi(path)` بيرجّع `{data, loading, error, reload}`.
- **الطلبات**: `src/lib/api.ts` فيه `api.get/post/put/patch/remove` + `uploadImage(file)`، وكل الأخطاء بتتحول لرسالة عربية (`Error.message`).
- **الكلاسات الجاهزة** في `src/index.css`: `.btn-primary` `.btn-accent` `.btn-ghost` `.btn-danger` `.input` `.label` `.card` `.badge`.
- **الألوان**: درجة `brand-*` (كهرماني) + `stone-*` معرّرة في `@theme`.
- **الشارات**: `PAYMENT_META` و`ORDER_META` في `src/lib/format.ts` — غيّرهم لو أضفت حالة جديدة.

---

## 9) البناء والنشر (Cloudflare Workers + GitHub)

1. ارفع المشروع على GitHub، ومن Cloudflare: **Workers & Pages → Create → Import a repository**.
2. إعدادات البناء: Build command `npm run build` — Deploy command `npx wrangler deploy` (الافتراضي).
3. **مفيش حاجة تانية تعملها:** ملف `wrangler.jsonc` من غير `database_id`، فـ Cloudflare بتنشئ قاعدة D1 وتربطها بالمشروع تلقائيًا أول نشر، والجداول بتتعمل لوحدها أول زيارة.
4. افتح `https://<اسم-موقعك>.workers.dev/api/health` — لازم يرجع `{"ok":true,"db":"ok"}`.
5. افتح `/admin` وفعّل حساب المالك (قسم 2).

لو ظهر خطأ: افتح `/api/health` — بيقولك لو قاعدة البيانات مش مربوطة. ولو أنشأت D1 بإيدك: اربطها من Settings → Bindings باسم `DB`.

## 10) إضافة ميزة جديدة (خارطة سريعة)

**إضافة حقل للمنتج (مثال: مقاس):**
`server/schema.ts` (إضافة العمود) → `server/lib.ts` (النوع + `publicProduct`/`adminProduct`) → `readProduct` في `server/admin.ts` → نموذج الإضافة في `AdminProducts.tsx` → العرض في `ProductCard.tsx`.

**إضافة endpoint جديد:**
- للعملاء: `app.get('/api/...')` في `server/public.ts`.
- للمسؤول: أضفه في `server/admin.ts` **بعد** سطر `app.use('/api/admin/*', requireAdmin)`.

**إضافة صفحة:**
أنشئ ملف في `src/pages/` وسجّل المسار في `src/App.tsx` داخل `<Route>`.

---

## 11) مشاكل ممكن تقابلها

| المشكلة | الحل |
|---|---|
| `Cannot apply unknown utility class` في `index.css` | Tailwind v4: ممنوع `@apply` على كلاس معرّف في `@layer components` — استخدم الكلاسات الأصلية أو `@utility` |
| الأنواع متأخرة بعد تغيير `wrangler.jsonc` | شغّل `npx wrangler types` (بيحدّث `worker-configuration.d.ts`) |
| الجداول فاضية | بتتعمل تلقائيًا؛ افتح `/api/health` وشوف الرد |
| الصور مش بتظهر | تأكد إن `image_key` موجود وإن الصورة اترفعت من لوحة التحكم |
| الطلب بيعدي من غير خصم مخزون | راجع إن `stock` رقم مش سالب — الخصم بيحصل داخل `db.batch()` |
| الدخول بيرجع `429` | 8 محاولات غلط في 10 دقائق — استنى أو أعد تشغيل الـ dev server |
