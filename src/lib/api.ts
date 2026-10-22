export type Product = {
  id: string
  name: string
  description: string
  category: string
  price: number
  comparePrice: number
  image: string | null
  stock: number
  active: boolean
  featured: boolean
  createdAt: string
  vodafoneNumber?: string
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

export type Order = {
  code: string
  customerName: string
  phone: string
  address: string
  notes: string
  items: OrderItem[]
  subtotal: number
  shipping: number
  total: number
  paymentNumbers: string[]
  paymentRef: string
  paymentStatus: PaymentStatus
  status: OrderStatus
  createdAt: string
  updatedAt: string
  /** للوحة التحكم فقط: عدد رسائل العميل الغير مقروءة */
  unreadMessages?: number
}

export type ChatMessage = {
  id: string
  sender: 'customer' | 'admin'
  body: string
  createdAt: string
  /** للوحة التحكم فقط */
  adminEmail?: string
}

export type StoreInfo = {
  name: string
  phone: string
  announcement: string
  shippingFee: number
}

export type AdminStats = {
  totalOrders: number
  pendingPayments: number
  paidRevenue: number
  todayOrders: number
  activeProducts: number
  lowStock: number
}

export type AdminInfo = {
  email: string
  role: 'owner' | 'admin'
  /** null = صلاحية مفتوحة */
  expiresAt: string | null
}

export type Bootstrap = {
  needsSetup: boolean
  setupKeyRequired: boolean
  authenticated: boolean
  admin: AdminInfo | null
}

export type TeamMember = AdminInfo & {
  expired: boolean
  createdBy: string
  createdAt: string
  lastLoginAt: string
}

type ErrorBody = { ok?: boolean; message?: string }

const ADMIN_TOKEN_KEY = 'admin_token'

export const adminSession = {
  get(): string | null {
    try {
      return localStorage.getItem(ADMIN_TOKEN_KEY)
    } catch {
      return null
    }
  },
  set(token: string) {
    try {
      localStorage.setItem(ADMIN_TOKEN_KEY, token)
    } catch {
      /* ignore */
    }
  },
  clear() {
    try {
      localStorage.removeItem(ADMIN_TOKEN_KEY)
    } catch {
      /* ignore */
    }
  },
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {}
  if (!(init?.body instanceof FormData)) headers['content-type'] = 'application/json'
  const token = adminSession.get()
  if (token) headers['x-admin-token'] = token

  const res = await fetch(path, {
    credentials: 'same-origin',
    ...init,
    headers: { ...headers, ...((init?.headers as Record<string, string>) || {}) },
  })

  let data: (T & ErrorBody) | null = null
  try {
    data = (await res.json()) as T & ErrorBody
  } catch {
    data = null
  }

  if (!res.ok || data?.ok === false) {
    throw new Error(data?.message || 'حصل خطأ، حاول مرة أخرى')
  }
  return data as T
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PUT', body: body === undefined ? undefined : JSON.stringify(body) }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PATCH', body: body === undefined ? undefined : JSON.stringify(body) }),
  remove: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
}

const MAX_UPLOAD_BYTES = 1_100_000

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))
}

/** بيصغّر الصورة ويضغطها (JPEG) عشان تتخزن بسرعة وتفتح بسرعة عند العملاء. */
async function compressImage(file: File): Promise<File> {
  if (file.type === 'image/gif' && file.size <= MAX_UPLOAD_BYTES) return file
  try {
    const bitmap = await createImageBitmap(file)
    let maxSide = 1600
    for (let round = 0; round < 4; round++) {
      const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(bitmap.width * scale))
      canvas.height = Math.max(1, Math.round(bitmap.height * scale))
      const ctx = canvas.getContext('2d')
      if (!ctx) break
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
      for (const quality of [0.86, 0.74, 0.62]) {
        const blob = await canvasToBlob(canvas, quality)
        if (blob && blob.size <= MAX_UPLOAD_BYTES) {
          bitmap.close()
          return new File([blob], 'photo.jpg', { type: 'image/jpeg' })
        }
      }
      maxSide = Math.round(maxSide * 0.75)
    }
    bitmap.close()
  } catch {
    /* الصيغة مش مدعومة في المتصفح — نجرّب نرفع الملف الأصلي */
  }
  if (file.size <= MAX_UPLOAD_BYTES) return file
  throw new Error('تعذّر تصغير الصورة، جرّب صورة JPG أو PNG أصغر')
}

export async function uploadImage(file: File): Promise<{ key: string; url: string }> {
  const prepared = await compressImage(file)
  const form = new FormData()
  form.append('file', prepared)
  return request('/api/admin/images', { method: 'POST', body: form })
}
