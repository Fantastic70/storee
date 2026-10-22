import { Hono } from 'hono'
import {
  EMAIL_RE,
  OWNER_EMAIL,
  PHONE_RE,
  adminProduct,
  authenticate,
  clearFailures,
  clientIp,
  isBlocked,
  recordFailure,
  MAX_PER_EMAIL,
  MAX_PER_IP,
  clearAdminCookie,
  createSessionToken,
  fail,
  getSessionSecret,
  getSettings,
  hashPassword,
  isExpired,
  isOwnerEmail,
  newId,
  normalizeEmail,
  nowIso,
  publicOrder,
  readAdminTokens,
  adminMessage,
  type MessageRow,
  readJson,
  requireAdmin,
  requireOwner,
  safeEqual,
  setAdminCookie,
  toAdminSession,
  verifyPassword,
  bytesToBase64,
  type AdminRow,
  type AppEnv,
  type OrderRow,
  type ProductRow,
} from './lib'

const app = new Hono<AppEnv>()

const MIN_PASSWORD = 8

/** hash وهمي عشان وقت الرد يفضل ثابت حتى لو الإيميل مش موجود. */
const DUMMY_HASH = `pbkdf2$100000$${'A'.repeat(22)}$${'A'.repeat(43)}`

/* ------------------------------- auth (public) ------------------------------ */

app.get('/api/admin/bootstrap', async (c) => {
  const owner = await c.env.DB.prepare('SELECT password_hash FROM admins WHERE email = ?')
    .bind(OWNER_EMAIL)
    .first<{ password_hash: string }>()
  const needsSetup = !owner || !owner.password_hash

  const auth = await authenticate(c.env.DB, readAdminTokens(c))
  return c.json({
    ok: true,
    needsSetup,
    setupKeyRequired: needsSetup && !!c.env.SETUP_KEY,
    authenticated: auth.ok,
    admin: auth.ok ? auth.admin : null,
  })
})

/** إنشاء حساب المالك لأول مرة — مسموح فقط لإيميل المالك. */
app.post('/api/admin/setup', async (c) => {
  const ipKey = `ip:${clientIp(c)}`
  if (await isBlocked(c.env.DB, ipKey, MAX_PER_IP)) return fail(c, 429, 'محاولات كثيرة، استنى شوية وحاول تاني')

  const body = await readJson<{ email?: string; password?: string; setupKey?: string }>(c)
  const email = normalizeEmail(body?.email || '')
  const password = (body?.password || '').trim()

  if (!isOwnerEmail(email)) {
    await recordFailure(c.env.DB, [ipKey])
    return fail(c, 403, 'الإيميل ده غير مصرّح له بإنشاء حساب مالك الموقع')
  }
  if (c.env.SETUP_KEY && !safeEqual(body?.setupKey || '', c.env.SETUP_KEY)) {
    await recordFailure(c.env.DB, [ipKey])
    return fail(c, 403, 'مفتاح التفعيل (SETUP_KEY) غير صحيح')
  }
  if (password.length < MIN_PASSWORD) return fail(c, 400, `كلمة السر لازم تكون ${MIN_PASSWORD} خانات على الأقل`)

  const hash = await hashPassword(password)
  const now = nowIso()
  // claim ذرّي: بينجح بس لو الحساب لسه ملوش كلمة سر
  const result = await c.env.DB.prepare(
    `INSERT INTO admins (email, password_hash, created_by, created_at, last_login_at) VALUES (?, ?, 'setup', ?, ?)
     ON CONFLICT(email) DO UPDATE SET password_hash = excluded.password_hash, last_login_at = excluded.last_login_at
     WHERE admins.password_hash = ''`,
  )
    .bind(OWNER_EMAIL, hash, now, now)
    .run()
  if (!result.meta.changes) return fail(c, 409, 'تم إنشاء حساب المالك من قبل، سجّل دخول')

  const token = await createSessionToken(await getSessionSecret(c.env.DB), OWNER_EMAIL, hash)
  setAdminCookie(c, token)
  return c.json({
    ok: true,
    message: 'تم إنشاء حساب المالك بنجاح',
    token,
    admin: { email: OWNER_EMAIL, role: 'owner', expiresAt: null },
  })
})

app.post('/api/admin/login', async (c) => {
  const body = await readJson<{ email?: string; password?: string }>(c)
  const email = normalizeEmail(body?.email || '')
  const password = body?.password || ''

  const ipKey = `ip:${clientIp(c)}`
  const emailKey = `email:${email}`
  if ((await isBlocked(c.env.DB, ipKey, MAX_PER_IP)) || (await isBlocked(c.env.DB, emailKey, MAX_PER_EMAIL))) {
    return fail(c, 429, 'محاولات كثيرة، استنى شوية وحاول تاني')
  }

  const row = email
    ? await c.env.DB.prepare('SELECT * FROM admins WHERE email = ?').bind(email).first<AdminRow>()
    : null
  const stored = row?.password_hash || ''
  const valid = password.length > 0 && (await verifyPassword(password, stored || DUMMY_HASH)) && !!stored

  if (!row || !valid) {
    await recordFailure(c.env.DB, [ipKey, emailKey])
    if (!row && isOwnerEmail(email)) return fail(c, 409, 'لسه مفيش حساب للمالك، أنشئ كلمة سر الأول')
    return fail(c, 401, 'الإيميل أو كلمة السر غير صحيحة')
  }

  if (!isOwnerEmail(row.email) && isExpired(row.expires_at)) {
    return fail(c, 403, 'انتهت صلاحية حسابك — كلّم مالك الموقع لتجديدها')
  }

  await clearFailures(c.env.DB, [ipKey, emailKey])
  const now = nowIso()
  await c.env.DB.prepare('UPDATE admins SET last_login_at = ? WHERE email = ?').bind(now, row.email).run()

  const token = await createSessionToken(await getSessionSecret(c.env.DB), row.email, row.password_hash)
  setAdminCookie(c, token)
  return c.json({ ok: true, message: 'تم تسجيل الدخول', token, admin: toAdminSession(row) })
})

app.post('/api/admin/logout', (c) => {
  clearAdminCookie(c)
  return c.json({ ok: true, message: 'تم تسجيل الخروج' })
})

/* -------------------------- everything below is admin ------------------------ */

app.use('/api/admin/*', requireAdmin)

/** تغيير كلمة سر الحساب اللي داخل بيه حاليًا (مالك أو مسؤول مضاف). */
app.put('/api/admin/password', async (c) => {
  const me = c.get('admin')
  const body = await readJson<{ current?: string; next?: string }>(c)
  const row = await c.env.DB.prepare('SELECT * FROM admins WHERE email = ?').bind(me.email).first<AdminRow>()
  if (!row) return fail(c, 401, 'الحساب غير موجود')
  if (!(await verifyPassword(body?.current || '', row.password_hash))) return fail(c, 401, 'كلمة السر الحالية غير صحيحة')
  const next = (body?.next || '').trim()
  if (next.length < MIN_PASSWORD) return fail(c, 400, `كلمة السر الجديدة لازم تكون ${MIN_PASSWORD} خانات على الأقل`)

  const hash = await hashPassword(next)
  await c.env.DB.prepare('UPDATE admins SET password_hash = ? WHERE email = ?').bind(hash, me.email).run()

  // الجلسات القديمة بتبطل — نصدر توكن جديد للجهاز الحالي
  const token = await createSessionToken(await getSessionSecret(c.env.DB), me.email, hash)
  setAdminCookie(c, token)
  return c.json({ ok: true, message: 'تم تغيير كلمة السر', token })
})

/* ----------------------------- team (owner only) ---------------------------- */

type TeamBody = { email?: string; password?: string; expiresInHours?: number | null }

const MAX_HOURS = 24 * 365 * 5

function readExpiry(value: unknown): { ok: true; expiresAt: string | null } | { ok: false; error: string } {
  if (value === null || value === undefined) return { ok: true, expiresAt: null }
  const hours = Number(value)
  if (!Number.isFinite(hours) || hours < 1 || hours > MAX_HOURS) return { ok: false, error: 'مدة الصلاحية غير صحيحة' }
  return { ok: true, expiresAt: new Date(Date.now() + Math.floor(hours) * 3_600_000).toISOString() }
}

function teamMember(row: AdminRow) {
  const owner = isOwnerEmail(row.email)
  return {
    email: row.email,
    role: owner ? 'owner' : 'admin',
    expiresAt: owner ? null : row.expires_at,
    expired: owner ? false : isExpired(row.expires_at),
    createdBy: row.created_by,
    createdAt: row.created_at,
    lastLoginAt: row.last_login_at,
  }
}

app.get('/api/admin/team', requireOwner, async (c) => {
  const rows = await c.env.DB.prepare('SELECT * FROM admins WHERE password_hash <> \'\' ORDER BY created_at ASC').all<AdminRow>()
  const members = (rows.results ?? []).map(teamMember).sort((a, b) => Number(b.role === 'owner') - Number(a.role === 'owner'))
  return c.json({ ok: true, members })
})

app.post('/api/admin/team', requireOwner, async (c) => {
  const body = await readJson<TeamBody>(c)
  if (!body) return fail(c, 400, 'بيانات غير صحيحة')

  const email = normalizeEmail(body.email || '')
  const password = (body.password || '').trim()
  if (!EMAIL_RE.test(email)) return fail(c, 400, 'اكتب إيميل صحيح')
  if (isOwnerEmail(email)) return fail(c, 400, 'ده إيميل المالك — مش محتاج إضافة')
  if (password.length < MIN_PASSWORD) return fail(c, 400, `كلمة السر لازم تكون ${MIN_PASSWORD} خانات على الأقل`)
  const expiry = readExpiry(body.expiresInHours)
  if (!expiry.ok) return fail(c, 400, expiry.error)

  const exists = await c.env.DB.prepare('SELECT 1 FROM admins WHERE email = ?').bind(email).first()
  if (exists) return fail(c, 409, 'الإيميل ده مضاف قبل كده')

  await c.env.DB.prepare(
    'INSERT INTO admins (email, password_hash, expires_at, created_by, created_at) VALUES (?, ?, ?, ?, ?)',
  )
    .bind(email, await hashPassword(password), expiry.expiresAt, OWNER_EMAIL, nowIso())
    .run()

  const row = await c.env.DB.prepare('SELECT * FROM admins WHERE email = ?').bind(email).first<AdminRow>()
  return c.json({ ok: true, message: 'تمت إضافة المسؤول', member: teamMember(row!) }, 201)
})

/** تعديل مدة الصلاحية (تتحسب من الآن) و/أو إعادة تعيين كلمة السر. */
app.patch('/api/admin/team/:email', requireOwner, async (c) => {
  const email = normalizeEmail(c.req.param('email') || '')
  if (isOwnerEmail(email)) return fail(c, 400, 'مينفعش تعدّل صلاحيات المالك')
  const row = await c.env.DB.prepare('SELECT * FROM admins WHERE email = ?').bind(email).first<AdminRow>()
  if (!row) return fail(c, 404, 'المسؤول غير موجود')

  const body = await readJson<TeamBody>(c)
  if (!body) return fail(c, 400, 'بيانات غير صحيحة')

  let expiresAt = row.expires_at
  if ('expiresInHours' in body) {
    const expiry = readExpiry(body.expiresInHours)
    if (!expiry.ok) return fail(c, 400, expiry.error)
    expiresAt = expiry.expiresAt
  }

  let hash = row.password_hash
  const password = (body.password || '').trim()
  if (password) {
    if (password.length < MIN_PASSWORD) return fail(c, 400, `كلمة السر لازم تكون ${MIN_PASSWORD} خانات على الأقل`)
    hash = await hashPassword(password)
  }

  await c.env.DB.prepare('UPDATE admins SET expires_at = ?, password_hash = ? WHERE email = ?').bind(expiresAt, hash, email).run()
  const updated = await c.env.DB.prepare('SELECT * FROM admins WHERE email = ?').bind(email).first<AdminRow>()
  return c.json({ ok: true, message: 'تم تحديث المسؤول', member: teamMember(updated!) })
})

app.delete('/api/admin/team/:email', requireOwner, async (c) => {
  const email = normalizeEmail(c.req.param('email') || '')
  if (isOwnerEmail(email)) return fail(c, 400, 'مينفعش تحذف المالك')
  const result = await c.env.DB.prepare('DELETE FROM admins WHERE email = ?').bind(email).run()
  if (!result.meta.changes) return fail(c, 404, 'المسؤول غير موجود')
  return c.json({ ok: true, message: 'تم سحب صلاحية المسؤول' })
})

/* --------------------------------- settings --------------------------------- */

app.get('/api/admin/settings', async (c) => {
  const settings = await getSettings(c.env.DB, ['store_name', 'store_phone', 'announcement', 'shipping_fee'])
  return c.json({
    ok: true,
    settings: {
      storeName: settings.store_name || 'متجرنا',
      storePhone: settings.store_phone || '',
      announcement: settings.announcement || '',
      shippingFee: Number(settings.shipping_fee || 0),
    },
  })
})

app.put('/api/admin/settings', async (c) => {
  const body = await readJson<{ storeName?: string; storePhone?: string; announcement?: string; shippingFee?: number }>(c)
  if (!body) return fail(c, 400, 'بيانات غير صحيحة')

  const storeName = (body.storeName || '').trim().slice(0, 60)
  const storePhone = (body.storePhone || '').replace(/[^0-9]/g, '').slice(0, 11)
  const announcement = (body.announcement || '').trim().slice(0, 160)
  const shippingFee = Math.floor(Number(body.shippingFee))

  if (storeName.length < 2) return fail(c, 400, 'اسم المتجر قصير')
  if (storePhone && !PHONE_RE.test(storePhone)) return fail(c, 400, 'رقم تواصل غير صحيح')
  if (!Number.isFinite(shippingFee) || shippingFee < 0 || shippingFee > 10_000) return fail(c, 400, 'رسوم الشحن غير صحيحة')

  await c.env.DB.batch([
    c.env.DB.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').bind('store_name', storeName),
    c.env.DB.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').bind('store_phone', storePhone),
    c.env.DB.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').bind('announcement', announcement),
    c.env.DB.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').bind('shipping_fee', String(shippingFee)),
  ])

  return c.json({ ok: true, message: 'تم حفظ الإعدادات' })
})

/* --------------------------------- images ----------------------------------- */

const IMAGE_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif',
}

// الواجهة بتضغط الصورة قبل الرفع؛ ده الحد الأقصى المقبول في السيرفر (D1 بيقبل صف لحد ~2MB)
const MAX_IMAGE_BYTES = 1_400_000

app.post('/api/admin/images', async (c) => {
  const form = await c.req.formData()
  const file = form.get('file')
  if (!file || typeof file === 'string') return fail(c, 400, 'اختر صورة من الجهاز')
  const ext = IMAGE_EXT[file.type]
  if (!ext) return fail(c, 400, 'الصيغة المقبولة: JPG أو PNG أو WEBP أو GIF')
  if (file.size > MAX_IMAGE_BYTES) return fail(c, 413, 'حجم الصورة كبير، جرّب صورة أصغر')

  const bytes = new Uint8Array(await file.arrayBuffer())
  const key = `${newId()}.${ext}`
  await c.env.DB.prepare('INSERT INTO images (key, content_type, data, created_at) VALUES (?, ?, ?, ?)')
    .bind(key, file.type, bytesToBase64(bytes), nowIso())
    .run()
  return c.json({ ok: true, key, url: `/api/images/${key}` }, 201)
})

/* --------------------------------- products --------------------------------- */

type ProductBody = {
  name?: string
  description?: string
  category?: string
  price?: number
  comparePrice?: number
  imageKey?: string
  vodafoneNumber?: string
  stock?: number
  featured?: boolean
  active?: boolean
}

type ParsedProduct =
  | { ok: true; value: {
      name: string
      description: string
      category: string
      price: number
      comparePrice: number
      stock: number
      imageKey: string
      vodafoneNumber: string
      featured: number
      active: number
    } }
  | { ok: false; error: string }

function readProduct(body: ProductBody): ParsedProduct {
  const name = (body.name || '').trim().slice(0, 120)
  const description = (body.description || '').trim().slice(0, 3000)
  const category = (body.category || '').trim().slice(0, 60)
  const price = Math.floor(Number(body.price))
  const comparePrice = Math.floor(Number(body.comparePrice || 0))
  const stock = Math.floor(Number(body.stock ?? 100))
  const imageKey = (body.imageKey || '').trim().slice(0, 120)
  const vodafoneNumber = (body.vodafoneNumber || '').replace(/[^0-9]/g, '').slice(0, 11)

  if (name.length < 2) return { ok: false, error: 'اسم المنتج مطلوب' }
  if (!Number.isFinite(price) || price < 0 || price > 10_000_000) return { ok: false, error: 'السعر غير صحيح' }
  if (!Number.isFinite(comparePrice) || comparePrice < 0) return { ok: false, error: 'السعر قبل الخصم غير صحيح' }
  if (!Number.isFinite(stock) || stock < 0 || stock > 100_000) return { ok: false, error: 'الكمية المتوفرة غير صحيحة' }
  if (vodafoneNumber && !PHONE_RE.test(vodafoneNumber)) return { ok: false, error: 'رقم فودافون كاش غير صحيح (مثال: 01012345678)' }

  return {
    ok: true,
    value: {
      name,
      description,
      category,
      price,
      comparePrice,
      stock,
      imageKey,
      vodafoneNumber,
      featured: body.featured ? 1 : 0,
      active: body.active === false ? 0 : 1,
    },
  }
}

app.get('/api/admin/products', async (c) => {
  const rows = await c.env.DB.prepare('SELECT * FROM products ORDER BY created_at DESC LIMIT 500').all<ProductRow>()
  return c.json({ ok: true, products: (rows.results ?? []).map(adminProduct) })
})

app.post('/api/admin/products', async (c) => {
  const body = await readJson<ProductBody>(c)
  if (!body) return fail(c, 400, 'بيانات المنتج غير صحيحة')
  const parsed = readProduct(body)
  if (!parsed.ok) return fail(c, 400, parsed.error)

  const id = newId()
  const createdAt = nowIso()
  const v = parsed.value
  await c.env.DB.prepare(
    `INSERT INTO products (id, name, description, category, price, compare_price, image_key, vodafone_number,
      stock, active, featured, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(id, v.name, v.description, v.category, v.price, v.comparePrice, v.imageKey, v.vodafoneNumber, v.stock, v.active, v.featured, createdAt, createdAt)
    .run()

  const row = await c.env.DB.prepare('SELECT * FROM products WHERE id = ?').bind(id).first<ProductRow>()
  return c.json({ ok: true, product: adminProduct(row!) }, 201)
})

app.put('/api/admin/products/:id', async (c) => {
  const body = await readJson<ProductBody>(c)
  if (!body) return fail(c, 400, 'بيانات المنتج غير صحيحة')
  const existing = await c.env.DB.prepare('SELECT * FROM products WHERE id = ?').bind(c.req.param('id')).first<ProductRow>()
  if (!existing) return fail(c, 404, 'المنتج غير موجود')

  const parsed = readProduct({ active: true, featured: false, ...body })
  if (!parsed.ok) return fail(c, 400, parsed.error)
  const v = parsed.value
  await c.env.DB.prepare(
    `UPDATE products SET name = ?, description = ?, category = ?, price = ?, compare_price = ?, image_key = ?,
      vodafone_number = ?, stock = ?, active = ?, featured = ?, updated_at = ? WHERE id = ?`,
  )
    .bind(v.name, v.description, v.category, v.price, v.comparePrice, v.imageKey, v.vodafoneNumber, v.stock, v.active, v.featured, nowIso(), existing.id)
    .run()

  const row = await c.env.DB.prepare('SELECT * FROM products WHERE id = ?').bind(existing.id).first<ProductRow>()
  return c.json({ ok: true, product: adminProduct(row!) })
})

app.delete('/api/admin/products/:id', async (c) => {
  const id = c.req.param('id')
  const existing = await c.env.DB.prepare('SELECT * FROM products WHERE id = ?').bind(id).first<ProductRow>()
  if (!existing) return fail(c, 404, 'المنتج غير موجود')

  await c.env.DB.prepare('DELETE FROM products WHERE id = ?').bind(id).run()

  if (existing.image_key) {
    const others = await c.env.DB.prepare('SELECT 1 FROM products WHERE image_key = ? LIMIT 1').bind(existing.image_key).first()
    if (!others) await c.env.DB.prepare('DELETE FROM images WHERE key = ?').bind(existing.image_key).run()
  }
  return c.json({ ok: true, message: 'تم حذف المنتج' })
})

/* ---------------------------------- orders ---------------------------------- */

app.get('/api/admin/orders', async (c) => {
  const where: string[] = []
  const binds: string[] = []
  const payment = c.req.query('payment') || ''
  const status = c.req.query('status') || ''
  const q = (c.req.query('q') || '').trim()

  if (['pending', 'paid', 'rejected'].includes(payment)) {
    where.push('payment_status = ?')
    binds.push(payment)
  }
  if (['new', 'confirmed', 'shipped', 'delivered', 'cancelled'].includes(status)) {
    where.push('status = ?')
    binds.push(status)
  }
  if (c.req.query('unread') === '1') {
    where.push("code IN (SELECT order_code FROM order_messages WHERE sender = 'customer' AND read_at = '')")
  }
  if (q) {
    where.push('(code LIKE ? OR phone LIKE ? OR customer_name LIKE ?)')
    binds.push(`%${q}%`, `%${q}%`, `%${q}%`)
  }

  const sql = `SELECT * FROM orders ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY created_at DESC LIMIT 300`
  const rows = await c.env.DB.prepare(sql).bind(...binds).all<OrderRow>()

  const counters = await c.env.DB.prepare(
    'SELECT payment_status, COUNT(*) AS count FROM orders GROUP BY payment_status',
  ).all<{ payment_status: string; count: number }>()

  const byPayment: Record<string, number> = { pending: 0, paid: 0, rejected: 0 }
  for (const row of counters.results ?? []) byPayment[row.payment_status] = row.count

  const unreadRows = await c.env.DB.prepare(
    "SELECT order_code, COUNT(*) AS count FROM order_messages WHERE sender = 'customer' AND read_at = '' GROUP BY order_code",
  ).all<{ order_code: string; count: number }>()
  const unread = new Map((unreadRows.results ?? []).map((r) => [r.order_code, r.count]))
  byPayment.unread = unread.size

  return c.json({
    ok: true,
    orders: (rows.results ?? []).map((row) => ({ ...publicOrder(row), unreadMessages: unread.get(row.code) ?? 0 })),
    counters: byPayment,
  })
})

app.get('/api/admin/orders/:code', async (c) => {
  const code = (c.req.param('code') || '').replace(/[^0-9]/g, '')
  const row = await c.env.DB.prepare('SELECT * FROM orders WHERE code = ?').bind(code).first<OrderRow>()
  if (!row) return fail(c, 404, 'الطلب غير موجود')
  return c.json({ ok: true, order: publicOrder(row) })
})

app.patch('/api/admin/orders/:code', async (c) => {
  const code = (c.req.param('code') || '').replace(/[^0-9]/g, '')
  const row = await c.env.DB.prepare('SELECT * FROM orders WHERE code = ?').bind(code).first<OrderRow>()
  if (!row) return fail(c, 404, 'الطلب غير موجود')

  const body = await readJson<{ paymentStatus?: string; status?: string; paymentRef?: string }>(c)
  if (!body) return fail(c, 400, 'بيانات غير صحيحة')

  const paymentStatuses = ['pending', 'paid', 'rejected']
  const statuses = ['new', 'confirmed', 'shipped', 'delivered', 'cancelled']

  const paymentStatus = body.paymentStatus === undefined ? row.payment_status : body.paymentStatus
  const nextStatus = body.status === undefined ? row.status : body.status
  const paymentRef = body.paymentRef === undefined ? row.payment_ref : body.paymentRef.trim().slice(0, 40)

  if (!paymentStatuses.includes(paymentStatus)) return fail(c, 400, 'حالة الدفع غير صحيحة')
  if (!statuses.includes(nextStatus)) return fail(c, 400, 'حالة الطلب غير صحيحة')

  await c.env.DB.prepare('UPDATE orders SET payment_status = ?, status = ?, payment_ref = ?, updated_at = ? WHERE code = ?')
    .bind(paymentStatus, nextStatus, paymentRef, nowIso(), row.code)
    .run()

  const updated = await c.env.DB.prepare('SELECT * FROM orders WHERE code = ?').bind(row.code).first<OrderRow>()
  return c.json({ ok: true, order: publicOrder(updated!) })
})

/* ------------------------------ order chat ---------------------------------- */

app.get('/api/admin/orders/:code/messages', async (c) => {
  const code = (c.req.param('code') || '').replace(/[^0-9]/g, '')
  const order = await c.env.DB.prepare('SELECT code FROM orders WHERE code = ?').bind(code).first()
  if (!order) return fail(c, 404, 'الطلب غير موجود')

  const rows = await c.env.DB.prepare('SELECT * FROM order_messages WHERE order_code = ? ORDER BY created_at ASC, rowid ASC LIMIT 500')
    .bind(code)
    .all<MessageRow>()
  await c.env.DB.prepare("UPDATE order_messages SET read_at = ? WHERE order_code = ? AND sender = 'customer' AND read_at = ''")
    .bind(nowIso(), code)
    .run()
  return c.json({ ok: true, messages: (rows.results ?? []).map(adminMessage) })
})

app.post('/api/admin/orders/:code/messages', async (c) => {
  const code = (c.req.param('code') || '').replace(/[^0-9]/g, '')
  const order = await c.env.DB.prepare('SELECT code FROM orders WHERE code = ?').bind(code).first()
  if (!order) return fail(c, 404, 'الطلب غير موجود')

  const body = await readJson<{ body?: string }>(c)
  const text = (body?.body || '').trim()
  if (text.length < 1) return fail(c, 400, 'اكتب رسالتك الأول')
  if (text.length > 1000) return fail(c, 400, 'الرسالة طويلة (الحد الأقصى 1000 حرف)')

  const row: MessageRow = {
    id: newId(),
    order_code: code,
    sender: 'admin',
    admin_email: c.get('admin').email,
    body: text,
    created_at: nowIso(),
    read_at: '',
  }
  await c.env.DB.prepare(
    'INSERT INTO order_messages (id, order_code, sender, admin_email, body, created_at, read_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
  )
    .bind(row.id, row.order_code, row.sender, row.admin_email, row.body, row.created_at, row.read_at)
    .run()
  return c.json({ ok: true, message: adminMessage(row) }, 201)
})

/* ---------------------------------- stats ----------------------------------- */

app.get('/api/admin/stats', async (c) => {
  const startOfDay = new Date()
  startOfDay.setHours(0, 0, 0, 0)

  const [total, pendingPayments, revenue, today, products, lowStock] = await Promise.all([
    c.env.DB.prepare('SELECT COUNT(*) AS count FROM orders').first<{ count: number }>(),
    c.env.DB.prepare("SELECT COUNT(*) AS count FROM orders WHERE payment_status = 'pending'").first<{ count: number }>(),
    c.env.DB.prepare("SELECT COALESCE(SUM(total), 0) AS sum FROM orders WHERE payment_status = 'paid' AND status <> 'cancelled'").first<{ sum: number }>(),
    c.env.DB.prepare('SELECT COUNT(*) AS count FROM orders WHERE created_at >= ?').bind(startOfDay.toISOString()).first<{ count: number }>(),
    c.env.DB.prepare('SELECT COUNT(*) AS count FROM products WHERE active = 1').first<{ count: number }>(),
    c.env.DB.prepare('SELECT COUNT(*) AS count FROM products WHERE active = 1 AND stock <= 3').first<{ count: number }>(),
  ])

  return c.json({
    ok: true,
    stats: {
      totalOrders: total?.count ?? 0,
      pendingPayments: pendingPayments?.count ?? 0,
      paidRevenue: revenue?.sum ?? 0,
      todayOrders: today?.count ?? 0,
      activeProducts: products?.count ?? 0,
      lowStock: lowStock?.count ?? 0,
    },
  })
})

export default app
