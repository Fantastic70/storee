/**
 * إنشاء الجداول تلقائيًا (idempotent).
 * بيتنفّذ مرة واحدة لكل instance قبل أول طلب API، فمش محتاج تشغّل migrations يدويًا
 * لا في التطوير ولا على Cloudflare.
 */
const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    category TEXT NOT NULL DEFAULT '',
    price INTEGER NOT NULL,
    compare_price INTEGER NOT NULL DEFAULT 0,
    image_key TEXT NOT NULL DEFAULT '',
    vodafone_number TEXT NOT NULL DEFAULT '',
    stock INTEGER NOT NULL DEFAULT 100,
    active INTEGER NOT NULL DEFAULT 1,
    featured INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT ''
  )`,
  `CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY NOT NULL,
    code TEXT NOT NULL UNIQUE,
    customer_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    address TEXT NOT NULL,
    notes TEXT NOT NULL DEFAULT '',
    items TEXT NOT NULL,
    subtotal INTEGER NOT NULL,
    shipping INTEGER NOT NULL DEFAULT 0,
    total INTEGER NOT NULL,
    payment_number TEXT NOT NULL DEFAULT '',
    payment_ref TEXT NOT NULL DEFAULT '',
    payment_status TEXT NOT NULL DEFAULT 'pending',
    status TEXT NOT NULL DEFAULT 'new',
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT ''
  )`,
  `CREATE INDEX IF NOT EXISTS orders_phone_idx ON orders (phone)`,
  `CREATE INDEX IF NOT EXISTS orders_created_idx ON orders (created_at DESC)`,
  `CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL
  )`,
  `INSERT OR IGNORE INTO settings (key, value) VALUES
    ('store_name', 'متجرنا'),
    ('store_phone', '01000000000'),
    ('announcement', 'شحن لكل المحافظات — الدفع عبر فودافون كاش'),
    ('shipping_fee', '50')`,
  // الصور بتتخزن في D1 (مش محتاجة R2 ولا كارت بنكي)
  `CREATE TABLE IF NOT EXISTS images (
    key TEXT PRIMARY KEY NOT NULL,
    content_type TEXT NOT NULL,
    data TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  )`,
  // حسابات المسؤولين: المالك + اللي يضيفهم المالك (بصلاحية محدودة أو مفتوحة)
  `CREATE TABLE IF NOT EXISTS admins (
    email TEXT PRIMARY KEY NOT NULL,
    password_hash TEXT NOT NULL DEFAULT '',
    expires_at TEXT,
    created_by TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    last_login_at TEXT NOT NULL DEFAULT ''
  )`,
  // محادثة خاصة لكل طلب (بين العميل والمسؤولين فقط)
  `CREATE TABLE IF NOT EXISTS order_messages (
    id TEXT PRIMARY KEY NOT NULL,
    order_code TEXT NOT NULL,
    sender TEXT NOT NULL,
    admin_email TEXT NOT NULL DEFAULT '',
    body TEXT NOT NULL,
    created_at TEXT NOT NULL,
    read_at TEXT NOT NULL DEFAULT ''
  )`,
  `CREATE INDEX IF NOT EXISTS order_messages_code_idx ON order_messages (order_code, created_at)`,
  `CREATE TABLE IF NOT EXISTS login_attempts (
    key TEXT PRIMARY KEY NOT NULL,
    count INTEGER NOT NULL DEFAULT 0,
    reset_at INTEGER NOT NULL DEFAULT 0
  )`,
]

let ready: Promise<void> | null = null

export function ensureSchema(db: D1Database): Promise<void> {
  if (!ready) {
    ready = db
      .batch(STATEMENTS.map((sql) => db.prepare(sql)))
      .then(() => undefined)
      .catch((error: unknown) => {
        ready = null
        throw error
      })
  }
  return ready
}
