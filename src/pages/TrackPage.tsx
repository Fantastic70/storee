import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { EmptyState, ErrorNote, Icon, OrderBadge, PageLoader, PaymentBadge } from '../components/Bits'
import type { Order } from '../lib/api'
import { api } from '../lib/api'
import { egp, formatDate } from '../lib/format'

const PHONE_KEY = 'store_phone'

export default function TrackPage() {
  const [phone, setPhone] = useState(() => localStorage.getItem(PHONE_KEY) || '')
  const [orders, setOrders] = useState<Order[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function search(event: FormEvent, value?: string) {
    event.preventDefault()
    let digits = (value ?? phone).replace(/[^0-9]/g, '')
    if (digits.startsWith('20') && digits.length === 12) digits = digits.slice(2)
    if (digits.length === 10 && digits.startsWith('1')) digits = `0${digits}`
    if (!/^01[0125][0-9]{8}$/.test(digits)) {
      setError('رقم الموبايل غير صحيح (مثال: 01012345678)')
      return
    }
    setLoading(true)
    setError('')
    try {
      const result = await api.get<{ orders: Order[] }>(`/api/orders/track?phone=${digits}`)
      setOrders(result.orders)
      setPhone(digits)
      try {
        localStorage.setItem(PHONE_KEY, digits)
      } catch {
        /* ignore */
      }
    } catch (err) {
      setOrders(null)
      setError(err instanceof Error ? err.message : 'حصل خطأ، حاول تاني')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-extrabold sm:text-3xl">تتبّع طلبك</h1>
        <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-stone-500">
          اكتب رقم الموبايل اللي طلبت بيه وهتتشاف كل طلباتك مع حالة الدفع — من غير كلمة سر.
        </p>
      </div>

      <form onSubmit={(event) => search(event)} className="card mx-auto flex max-w-xl flex-col gap-3 p-5 sm:flex-row">
        <div className="flex-1">
          <label className="label" htmlFor="track-phone">رقم الموبايل</label>
          <input
            id="track-phone"
            className="input"
            dir="ltr"
            inputMode="numeric"
            value={phone}
            onChange={(event) => setPhone(event.target.value.replace(/[^0-9]/g, '').slice(0, 12))}
            placeholder="01012345678"
          />
        </div>
        <button type="submit" className="btn-primary sm:mt-7" disabled={loading}>
          {loading ? <Icon name="refresh" className="h-4 w-4 animate-spin" /> : <Icon name="search" className="h-4 w-4" />}
          بحث
        </button>
      </form>

      {error && <div className="mx-auto mt-4 max-w-xl"><ErrorNote message={error} /></div>}
      {loading && <PageLoader label="جاري البحث عن طلباتك…" />}

      {!loading && orders && orders.length === 0 && (
        <div className="mt-6">
          <EmptyState
            icon="package"
            title="مفيش طلبات بهذا الرقم"
            description="تأكد من الرقم أو ابدأ طلب جديد."
            action={
              <Link to="/products" className="btn-primary">
                تسوّق الآن
              </Link>
            }
          />
        </div>
      )}

      {!loading && orders && orders.length > 0 && (
        <div className="mt-8 space-y-4">
          <p className="text-sm font-bold text-stone-500">تم العثور على {orders.length} طلب</p>
          {orders.map((order) => (
            <Link
              key={order.code}
              to={`/order/${order.code}`}
              className="card block p-5 transition hover:-translate-y-0.5 hover:border-stone-900 hover:shadow-md"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-lg font-extrabold tracking-wider" dir="ltr">
                    #{order.code}
                  </p>
                  <p className="text-xs text-stone-500">{formatDate(order.createdAt)}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <PaymentBadge status={order.paymentStatus} />
                  <OrderBadge status={order.status} />
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-dashed border-stone-200 pt-3 text-sm">
                <span className="text-stone-500">
                  {order.items.length} منتج — {egp(order.total)}
                </span>
                <span className="font-bold text-brand-700">عرض التفاصيل</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
