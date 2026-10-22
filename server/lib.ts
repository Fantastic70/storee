import { getCookie, setCookie, deleteCookie } from 'hono/cookie'
import { createMiddleware } from 'hono/factory'
import type { Context } from 'hono'

/* --------------------------------- config ---------------------------------- */

/** الإيميل الوحيد المسموح له يكون "مالك" لوحة التحكم. */
export const OWNER_EMAIL = 'eljoker1213141@gmail.com'

export type AdminRole = 'owner' | 'admin'

export type AdminSession = {
  email: string
  role: AdminRole
  /** null = صلاحية مفتوحة */
  expiresAt: string | null
}

/** SETUP_KEY اختياري: لو اتضاف كـ Secret في Cloudflare بيتطلب وقت إنشاء حساب المالك لأول مرة. */
export type AppBindings = Env & { SETUP_KEY?: string }
export type AppEnv = { Bindings: AppBindings; Variables: { admin: AdminSession } }

/* ---------------------------------- types --------------------------------- */

export type ProductRow = {
  id: string
  name: string
  description: string
  category: string
  price: number
  compare_price: number
  image_key: string
  vodafone_number: string
  stock: number
  active: number
  featured: number
  created_at: string
  updated_at: string
}

export type OrderItem = {
  productId: string
  name: string
  price: number
  qty: number
  image: string | null
}

export type PaymentStatus = 'pending' | 'paid' | 'rejected'
export type OrderStatus = 'new' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled'

export type OrderRow = {
  id: string
  code: string
  customer_name: string
  phone: string
  address: string
  notes: string
  items: string
  subtotal: number
  shipping: number
  total: number
  payment_number: string
  payment_ref: string
  payment_status: PaymentStatus
  status: OrderStatus
  created_at: string
  updated_at: string
}

export type AdminRow = {
  email: string
  password_hash: string
  expires_at: string | null
  created_by: string
  created_at: string
  last_login_at: string
}

/* --------------------------------- helpers -------------------------------- */

export function newId(): string {
  return crypto.randomUUID()
}

export function nowIso(): string {
  return new Date().toISOString()
}

export function fail(c: Context, status: 400 | 401 | 403 | 404 | 409 | 413 | 429 | 500, message: string) {
  return c.json({ ok: false, message }, status)
}

export async function readJson<T>(c: Context): Promise<T | null> {
  try {
    return await c.req.json<T>()
  } catch {
    return null
  }
}

const textEncoder = new TextEncoder()

function toB64url(bytes: Uint8Array): string {
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromB64url(value: string): Uint8Array {
  const b64 = value.replace(/-/g, '+').replace(/_/g, '/')
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

function equalBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i]
  return diff === 0
}

export function safeEqual(a: string, b: string): boolean {
  return equalBytes(textEncoder.encode(a), textEncoder.encode(b))
}

export function bytesToBase64(bytes: Uint8Array): string {
  let bin = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...Array.from(bytes.subarray(i, i + chunk)))
  }
  return btoa(bin)
}

export function base64ToBytes(value: string): Uint8Array {
  const bin = atob(value)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

/* ---------------------------------- emails --------------------------------- */

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export function normalizeEmail(value: string): string {
  return (value || '').trim().toLowerCase().slice(0, 120)
}

export function isOwnerEmail(email: string): boolean {
  return normalizeEmail(email) === OWNER_EMAIL
}

/* -------------------------------- passwords -------------------------------- */

const PBKDF2_ITERATIONS = 100_000

async function derive(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', textEncoder.encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations, hash: 'SHA-256' },
    key,
    256,
  )
  return new Uint8Array(bits)
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const hash = await derive(password, salt, PBKDF2_ITERATIONS)
  return `pbkdf2$${PBKDF2_ITERATIONS}$${toB64url(salt)}$${toB64url(hash)}`
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$')
  if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false
  const iterations = Number(parts[1])
  if (!Number.isFinite(iterations) || iterations < 10_000 || iterations > 1_000_000) return false
  try {
    const expected = fromB64url(parts[3])
    const candidate = await derive(password, fromB64url(parts[2]), iterations)
    return equalBytes(candidate, expected)
  } catch {
    return false
  }
}

/* --------------------------------- sessions -------------------------------- */

async function hmacSign(secret: string, data: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', textEncoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
  ])
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, textEncoder.encode(data)))
}

const SESSION_MAX_AGE = 60 * 60 * 24 * 7

/** بصمة قصيرة لكلمة السر الحالية — لو اتغيّرت كلمة السر كل الجلسات القديمة بتبطل. */
async function passwordTag(secret: string, passwordHash: string): Promise<string> {
  return toB64url(await hmacSign(secret, `pv:${passwordHash}`)).slice(0, 16)
}

/** توكن الجلسة: exp.nonce.email.pv.signature */
export async function createSessionToken(secret: string, email: string, passwordHash: string): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + SESSION_MAX_AGE
  const nonce = crypto.randomUUID().replace(/-/g, '')
  const emailPart = toB64url(textEncoder.encode(email))
  const pv = await passwordTag(secret, passwordHash)
  const payload = `${exp}.${nonce}.${emailPart}.${pv}`
  const signature = toB64url(await hmacSign(secret, payload))
  return `${payload}.${signature}`
}

type ParsedToken = { email: string; pv: string }

async function verifySessionToken(token: string, secret: string): Promise<ParsedToken | null> {
  const parts = token.split('.')
  if (parts.length !== 5) return null
  const [exp, nonce, emailPart, pv, signature] = parts
  try {
    const payload = `${exp}.${nonce}.${emailPart}.${pv}`
    const expected = await hmacSign(secret, payload)
    if (!equalBytes(expected, fromB64url(signature))) return null
    const expSeconds = Number(exp)
    if (!Number.isFinite(expSeconds) || expSeconds * 1000 <= Date.now()) return null
    const email = new TextDecoder().decode(fromB64url(emailPart))
    return { email: normalizeEmail(email), pv }
  } catch {
    return null
  }
}

export function setAdminCookie(c: Context, token: string) {
  setCookie(c, 'admin_session', token, {
    httpOnly: true,
    sameSite: 'Lax',
    path: '/',
    maxAge: SESSION_MAX_AGE,
    secure: c.req.url.startsWith('https://'),
  })
}

export function clearAdminCookie(c: Context) {
  deleteCookie(c, 'admin_session', { path: '/' })
}

/* -------------------------------- settings --------------------------------- */

export async function getSetting(db: D1Database, key: string): Promise<string | null> {
  const row = await db.prepare('SELECT value FROM settings WHERE key = ?').bind(key).first<{ value: string }>()
  return row?.value ?? null
}

export async function setSetting(db: D1Database, key: string, value: string): Promise<void> {
  await db
    .prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
    .bind(key, value)
    .run()
}

export async function getSettings(db: D1Database, keys: string[]): Promise<Record<string, string>> {
  const result: Record<string, string> = {}
  await Promise.all(
    keys.map(async (key) => {
      const value = await getSetting(db, key)
      if (value !== null) result[key] = value
    }),
  )
  return result
}

export async function getSessionSecret(db: D1Database): Promise<string> {
  const existing = await getSetting(db, 'session_secret')
  if (existing) return existing
  const secret = toB64url(crypto.getRandomValues(new Uint8Array(32)))
  // INSERT OR IGNORE: لو طلبين اشتغلوا في نفس اللحظة نفس السر هو اللي يتخزن
  await db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)').bind('session_secret', secret).run()
  return (await getSetting(db, 'session_secret')) ?? secret
}

/* --------------------------------- validation ------------------------------- */

export const PHONE_RE = /^01[0125][0-9]{8}$/

export function normalizePhone(value: string): string {
  let phone = (value || '').replace(/[^0-9]/g, '')
  if (phone.startsWith('20')) phone = phone.slice(2)
  if (phone.length === 11 && phone.startsWith('0')) return phone
  return phone
}

/* ---------------------------------- auth ----------------------------------- */

export const ADMIN_TOKEN_HEADER = 'x-admin-token'

export function readAdminTokens(c: Context): string[] {
  const tokens: string[] = []
  const header = c.req.header(ADMIN_TOKEN_HEADER)?.trim()
  if (header && header.length > 10) tokens.push(header)
  const cookie = getCookie(c, 'admin_session')
  if (cookie) tokens.push(cookie)
  return tokens
}

export type AuthResult =
  | { ok: true; admin: AdminSession }
  | { ok: false; reason: 'missing' | 'invalid' | 'expired' }

export function isExpired(expiresAt: string | null): boolean {
  if (!expiresAt) return false
  const time = Date.parse(expiresAt)
  return Number.isFinite(time) && time <= Date.now()
}

export function toAdminSession(row: AdminRow): AdminSession {
  const owner = isOwnerEmail(row.email)
  return { email: row.email, role: owner ? 'owner' : 'admin', expiresAt: owner ? null : row.expires_at }
}

/** بيتحقق من التوكن + إن الإيميل لسه مصرّح له + إن صلاحيته ما خلصتش (في كل طلب). */
export async function authenticate(db: D1Database, tokens: string[]): Promise<AuthResult> {
  if (tokens.length === 0) return { ok: false, reason: 'missing' }
  const secret = await getSessionSecret(db)
  let sawExpired = false

  for (const token of tokens) {
    const parsed = await verifySessionToken(token, secret)
    if (!parsed) continue
    const row = await db.prepare('SELECT * FROM admins WHERE email = ?').bind(parsed.email).first<AdminRow>()
    if (!row || !row.password_hash) continue
    if (parsed.pv !== (await passwordTag(secret, row.password_hash))) continue
    if (!isOwnerEmail(row.email) && isExpired(row.expires_at)) {
      sawExpired = true
      continue
    }
    return { ok: true, admin: toAdminSession(row) }
  }
  return { ok: false, reason: sawExpired ? 'expired' : 'invalid' }
}

export const requireAdmin = createMiddleware<AppEnv>(async (c, next) => {
  const result = await authenticate(c.env.DB, readAdminTokens(c))
  if (!result.ok) {
    const message =
      result.reason === 'expired'
        ? 'انتهت صلاحية حسابك — كلّم مالك الموقع لتجديدها'
        : result.reason === 'missing'
          ? 'يجب تسجيل الدخول كمسؤول'
          : 'انتهت الجلسة، سجّل دخول مرة أخرى'
    return c.json({ ok: false, message }, 401)
  }
  c.set('admin', result.admin)
  await next()
})

export const requireOwner = createMiddleware<AppEnv>(async (c, next) => {
  if (c.get('admin').role !== 'owner') {
    return c.json({ ok: false, message: 'الصفحة دي لمالك الموقع فقط' }, 403)
  }
  await next()
})

/* ------------------------- login throttling (في D1) ------------------------- */

const WINDOW_MS = 10 * 60 * 1000
export const MAX_PER_IP = 10
export const MAX_PER_EMAIL = 40

export function clientIp(c: { req: { header: (name: string) => string | undefined } }): string {
  return c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || 'local'
}

export async function isBlocked(db: D1Database, key: string, max: number): Promise<boolean> {
  const row = await db
    .prepare('SELECT count, reset_at FROM login_attempts WHERE key = ?')
    .bind(key)
    .first<{ count: number; reset_at: number }>()
  return !!row && row.reset_at > Date.now() && row.count >= max
}

export async function recordFailure(db: D1Database, keys: string[]): Promise<void> {
  const now = Date.now()
  const resetAt = now + WINDOW_MS
  const statements = keys.map((key) =>
    db
      .prepare(
        `INSERT INTO login_attempts (key, count, reset_at) VALUES (?, 1, ?)
         ON CONFLICT(key) DO UPDATE SET
           count = CASE WHEN login_attempts.reset_at <= ? THEN 1 ELSE login_attempts.count + 1 END,
           reset_at = CASE WHEN login_attempts.reset_at <= ? THEN ? ELSE login_attempts.reset_at END`,
      )
      .bind(key, resetAt, now, now, resetAt),
  )
  statements.push(db.prepare('DELETE FROM login_attempts WHERE reset_at < ?').bind(now - WINDOW_MS))
  await db.batch(statements)
}

export async function clearFailures(db: D1Database, keys: string[]): Promise<void> {
  await db.batch(keys.map((key) => db.prepare('DELETE FROM login_attempts WHERE key = ?').bind(key)))
}

/* --------------------------------- messages -------------------------------- */

export type MessageRow = {
  id: string
  order_code: string
  sender: 'customer' | 'admin'
  admin_email: string
  body: string
  created_at: string
  read_at: string
}

/** نسخة العميل: من غير إيميل المسؤول (بيظهر له "المتجر" بس). */
export function publicMessage(row: MessageRow) {
  return { id: row.id, sender: row.sender, body: row.body, createdAt: row.created_at }
}

export function adminMessage(row: MessageRow) {
  return { ...publicMessage(row), adminEmail: row.sender === 'admin' ? row.admin_email : '' }
}

/* --------------------------------- mappers --------------------------------- */

export function publicProduct(row: ProductRow) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    category: row.category,
    price: row.price,
    comparePrice: row.compare_price,
    image: row.image_key ? `/api/images/${row.image_key}` : null,
    stock: row.stock,
    active: row.active === 1,
    featured: row.featured === 1,
    createdAt: row.created_at,
  }
}

export function adminProduct(row: ProductRow) {
  return {
    ...publicProduct(row),
    vodafoneNumber: row.vodafone_number,
    updatedAt: row.updated_at,
  }
}

export function publicOrder(row: OrderRow) {
  let items: OrderItem[] = []
  try {
    items = JSON.parse(row.items) as OrderItem[]
  } catch {
    items = []
  }
  return {
    code: row.code,
    customerName: row.customer_name,
    phone: row.phone,
    address: row.address,
    notes: row.notes,
    items,
    subtotal: row.subtotal,
    shipping: row.shipping,
    total: row.total,
    paymentNumbers: row.payment_number
      .split(',')
      .map((n) => n.trim())
      .filter(Boolean),
    paymentRef: row.payment_ref,
    paymentStatus: row.payment_status,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}
