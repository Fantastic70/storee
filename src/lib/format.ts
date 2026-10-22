import type { OrderStatus, PaymentStatus } from './api'

export function egp(amount: number): string {
  return `${new Intl.NumberFormat('en-US').format(Math.round(amount))} ج.م`
}

export function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat('ar-EG', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso))
  } catch {
    return iso
  }
}

export function formatShortDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat('ar-EG', { dateStyle: 'medium' }).format(new Date(iso))
  } catch {
    return iso
  }
}

type Meta = { label: string; className: string; dot: string }

export const PAYMENT_META: Record<PaymentStatus, Meta> = {
  pending: { label: 'منتظر تأكيد الدفع', className: 'bg-amber-100 text-amber-800', dot: 'bg-amber-500' },
  paid: { label: 'تم الدفع', className: 'bg-emerald-100 text-emerald-800', dot: 'bg-emerald-500' },
  rejected: { label: 'الدفع غير مؤكد', className: 'bg-red-100 text-red-700', dot: 'bg-red-500' },
}

export const ORDER_META: Record<OrderStatus, Meta> = {
  new: { label: 'طلب جديد', className: 'bg-sky-100 text-sky-800', dot: 'bg-sky-500' },
  confirmed: { label: 'قيد التجهيز', className: 'bg-indigo-100 text-indigo-800', dot: 'bg-indigo-500' },
  shipped: { label: 'تم الشحن', className: 'bg-violet-100 text-violet-800', dot: 'bg-violet-500' },
  delivered: { label: 'تم التوصيل', className: 'bg-emerald-100 text-emerald-800', dot: 'bg-emerald-500' },
  cancelled: { label: 'ملغي', className: 'bg-stone-200 text-stone-700', dot: 'bg-stone-500' },
}

export const ORDER_STATUSES: OrderStatus[] = ['new', 'confirmed', 'shipped', 'delivered', 'cancelled']
export const PAYMENT_STATUSES: PaymentStatus[] = ['pending', 'paid', 'rejected']
