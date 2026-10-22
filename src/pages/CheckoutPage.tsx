import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { ErrorNote, Icon, Spinner } from '../components/Bits'
import { useCart } from '../lib/cart'
import { useStore } from '../lib/store'
import { api } from '../lib/api'
import type { Order } from '../lib/api'
import { egp } from '../lib/format'

const PHONE_KEY = 'store_phone'

export default function CheckoutPage() {
  const { items, subtotal, clear } = useCart()
  const { store } = useStore()
  const navigate = useNavigate()

  const [name, setName] = useState('')
  const [phone, setPhone] = useState(() => localStorage.getItem(PHONE_KEY) || '')
  const [address, setAddress] = useState('')
  const [notes, setNotes] = useState('')
  const [paymentRef, setPaymentRef] = useState('')
  const [numbers, setNumbers] = useState<string[]>([])
  const [loadingNumbers, setLoadingNumbers] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const shipping = store.shippingFee
  const total = subtotal + shipping
  const idsParam = useMemo(() => items.map((item) => item.productId).join(','), [items])

  useEffect(() => {
    let alive = true
    if (!idsParam) {
      setNumbers([])
      setLoadingNumbers(false)
      return undefined
    }
    setLoadingNumbers(true)
    api
      .get<{ numbers: string[] }>(`/api/payment/numbers?ids=${encodeURIComponent(idsParam)}`)
      .then((result) => {
        if (alive) setNumbers(result.numbers)
      })
      .catch(() => {
        if (alive) setNumbers([])
      })
      .finally(() => {
        if (alive) setLoadingNumbers(false)
      })
    return () => {
      alive = false
    }
  }, [idsParam])

  if (items.length === 0 && !submitting) return <Navigate to="/cart" replace />

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (submitting) return
    setError('')
    setSubmitting(true)
    try {
      const result = await api.post<{ order: Order }>('/api/orders', {
        name,
        phone,
        address,
        notes,
        paymentRef,
        items: items.map((item) => ({ productId: item.productId, qty: item.qty })),
      })
      try {
        localStorage.setItem(PHONE_KEY, phone.replace(/[^0-9]/g, ''))
      } catch {
        /* ignore */
      }
      clear()
      navigate(`/order/${result.order.code}`, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'حصل خطأ، حاول تاني')
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold sm:text-3xl">إتمام الطلب</h1>
        <p className="mt-1 text-sm text-stone-500">اكتب بياناتك وحوّل المبلغ على فودافون كاش وخلاص.</p>
      </div>

      {error && <div className="mb-5"><ErrorNote message={error} /></div>}

      <form onSubmit={submit} className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <section className="card space-y-4 p-5">
            <h2 className="flex items-center gap-2 text-base font-extrabold">
              <Icon name="user" className="h-5 w-5 text-brand-600" />
              بيانات التوصيل
            </h2>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="name">الاسم بالكامل *</label>
                <input id="name" className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="مثال: أحمد محمد" required minLength={3} />
              </div>
              <div>
                <label className="label" htmlFor="phone">رقم الموبايل *</label>
                <input
                  id="phone"
                  className="input"
                  dir="ltr"
                  inputMode="numeric"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/[^0-9]/g, '').slice(0, 11))}
                  placeholder="01012345678"
                  required
                />
                <p className="mt-1 text-xs text-stone-400">بهذا الرقم هتتتبّع طلبك من غير كلمة سر.</p>
              </div>
            </div>

            <div>
              <label className="label" htmlFor="address">عنوان التوصيل *</label>
              <input
                id="address"
                className="input"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="المدينة، المنطقة، الشارع، رقم العمارة والدور"
                required
                minLength={10}
              />
            </div>

            <div>
              <label className="label" htmlFor="notes">ملاحظات (اختياري)</label>
              <textarea id="notes" className="input min-h-24 resize-y" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="أي تفاصيل تساعدنا نوصّلك أسرع" />
            </div>
          </section>

          <section className="card space-y-4 border-brand-200 p-5">
            <h2 className="flex items-center gap-2 text-base font-extrabold">
              <Icon name="wallet" className="h-5 w-5 text-brand-600" />
              الدفع عبر فودافون كاش
            </h2>

            <div className="rounded-2xl bg-stone-950 p-5 text-white">
              <p className="text-xs font-bold text-stone-400">حوّل مبلغ</p>
              <p className="mt-1 text-3xl font-extrabold text-brand-400">{egp(total)}</p>
              <p className="mt-3 text-xs font-bold text-stone-400">على رقم فودافون كاش</p>

              {loadingNumbers ? (
                <p className="mt-2 flex items-center gap-2 text-sm text-stone-300">
                  <Spinner className="h-4 w-4" /> جاري تحميل رقم الدفع…
                </p>
              ) : numbers.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {numbers.map((number) => (
                    <button
                      key={number}
                      type="button"
                      onClick={() => navigator.clipboard?.writeText(number)}
                      className="rounded-xl bg-white/10 px-4 py-2.5 font-mono text-lg font-extrabold tracking-wider text-white transition hover:bg-white/20"
                      dir="ltr"
                      title="اضغط للنسخ"
                    >
                      {number}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="mt-2 rounded-xl bg-white/10 px-4 py-3 text-sm text-amber-300">
                  الرقم مش متاح حاليًا، تواصل مع المتجر من الصفحة الرئيسية.
                </p>
              )}

              <p className="mt-3 text-[11px] leading-5 text-stone-400">
                احفظ صورة التحويل وسجّل رقم العملية في الخانة اللي تحت عشان نأكّد الدفع بسرعة.
              </p>
            </div>

            <div>
              <label className="label" htmlFor="paymentRef">رقم عملية التحويل (اختياري)</label>
              <input
                id="paymentRef"
                className="input"
                dir="ltr"
                inputMode="numeric"
                value={paymentRef}
                onChange={(e) => setPaymentRef(e.target.value.slice(0, 40))}
                placeholder="مثال: 884422"
              />
            </div>

            <p className="text-xs leading-6 text-stone-500">
              حالة الطلب هتبقى <b>منتظر تأكيد الدفع</b> لحد ما المسؤول يتأكد من التحويل، وبعدها تتغير لـ
              <b> تم الدفع</b>. تقدر تتابع ده من صفحة الطلب برقم موبايلك.
            </p>
          </section>
        </div>

        <aside className="card h-fit space-y-4 p-5">
          <h2 className="text-base font-extrabold">طلباتك</h2>

          <ul className="max-h-64 space-y-3 overflow-auto pe-1">
            {items.map((item) => (
              <li key={item.productId} className="flex items-center justify-between gap-3 text-sm">
                <span className="min-w-0">
                  <span className="block truncate font-bold">{item.name}</span>
                  <span className="text-xs text-stone-400">الكمية: {item.qty}</span>
                </span>
                <span className="shrink-0 font-bold">{egp(item.price * item.qty)}</span>
              </li>
            ))}
          </ul>

          <dl className="space-y-2 border-t border-dashed border-stone-300 pt-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-stone-500">الإجمالي الفرعي</dt>
              <dd className="font-bold">{egp(subtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-stone-500">الشحن</dt>
              <dd className="font-bold">{shipping > 0 ? egp(shipping) : 'مجاني'}</dd>
            </div>
            <div className="flex justify-between border-t border-stone-200 pt-3 text-base">
              <dt className="font-extrabold">الإجمالي</dt>
              <dd className="font-extrabold">{egp(total)}</dd>
            </div>
          </dl>

          <button type="submit" className="btn-accent w-full" disabled={submitting}>
            {submitting ? (
              <>
                <Spinner className="h-4 w-4" /> جاري تأكيد الطلب…
              </>
            ) : (
              <>
                تأكيد الطلب
                <Icon name="check" className="h-4 w-4" />
              </>
            )}
          </button>

          <Link to="/cart" className="btn-ghost w-full">
            رجوع للسلة
          </Link>
        </aside>
      </form>
    </div>
  )
}
