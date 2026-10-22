import OrderChat from '../components/OrderChat'
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { EmptyState, ErrorNote, Icon, PageLoader, PaymentBadge, OrderBadge, ProductThumb } from '../components/Bits'
import type { Order } from '../lib/api'
import { api } from '../lib/api'
import { egp, formatDate } from '../lib/format'

const PHONE_KEY = 'store_phone'

export default function OrderPage() {
  const { code = '' } = useParams()
  const [phone, setPhone] = useState(() => localStorage.getItem(PHONE_KEY) || '')
  const [input, setInput] = useState('')
  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState('')

  const load = useCallback(
    async (phoneValue: string) => {
      const digits = phoneValue.replace(/[^0-9]/g, '')
      if (!/^01[0125][0-9]{8}$/.test(digits)) {
        setError('اكتب رقم الموبايل اللي طلبت بيه (11 رقم)')
        return
      }
      setLoading(true)
      setError('')
      try {
        const result = await api.get<{ order: Order }>(`/api/orders/${encodeURIComponent(code)}?phone=${digits}`)
        setOrder(result.order)
        try {
          localStorage.setItem(PHONE_KEY, digits)
        } catch {
          /* ignore */
        }
        setPhone(digits)
      } catch (err) {
        setOrder(null)
        setError(err instanceof Error ? err.message : 'مش لاقيين الطلب')
      } finally {
        setLoading(false)
      }
    },
    [code],
  )

  useEffect(() => {
    if (phone) void load(phone)
  }, [phone, load])

  function submit(event: FormEvent) {
    event.preventDefault()
    void load(input)
  }

  function copy(value: string) {
    navigator.clipboard?.writeText(value).then(
      () => {
        setCopied(value)
        setTimeout(() => setCopied(''), 2000)
      },
      () => undefined,
    )
  }

  if (loading && !order) return <div className="mx-auto max-w-3xl px-4 py-16"><PageLoader label="جاري تحميل الطلب…" /></div>

  if (!order) {
    return (
      <div className="mx-auto max-w-lg space-y-4 px-4 py-16">
        <EmptyState
          icon="search"
          title="اكتب رقم موبايلك"
          description={`نحتاج رقم الموبايل اللي طلبت بيه عرض الطلب رقم ${code}.`}
        />
        <form onSubmit={submit} className="card space-y-3 p-5">
          {error && <ErrorNote message={error} />}
          <label className="label" htmlFor="track-phone">رقم الموبايل</label>
          <input
            id="track-phone"
            className="input"
            dir="ltr"
            inputMode="numeric"
            value={input}
            onChange={(event) => setInput(event.target.value.replace(/[^0-9]/g, '').slice(0, 11))}
            placeholder="01012345678"
          />
          <button type="submit" className="btn-primary w-full">
            عرض الطلب
          </button>
        </form>
        <Link to="/track" className="btn-ghost mx-auto flex w-fit">
          تتبّع كل طلباتي
        </Link>
      </div>
    )
  }

  const pending = order.paymentStatus === 'pending'

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="card overflow-hidden">
        <div className="bg-stone-950 p-6 text-center text-white sm:p-8">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-brand-500 text-stone-950">
            <Icon name="check" className="h-7 w-7" />
          </span>
          <h1 className="mt-4 text-xl font-extrabold sm:text-2xl">تم استلام طلبك بنجاح</h1>
          <p className="mt-2 text-sm text-stone-400">احتفظ برقم الطلب ده عشان تتابعه في أي وقت.</p>
          <p className="mt-4 inline-block rounded-xl bg-white/10 px-5 py-2 font-mono text-2xl font-extrabold tracking-[0.2em] text-brand-300" dir="ltr">
            #{order.code}
          </p>
        </div>

        <div className="grid gap-3 border-b border-stone-200 bg-stone-50 p-4 sm:grid-cols-2 sm:p-5">
          <div className="flex items-center justify-between gap-3 rounded-xl border border-stone-200 bg-white p-3">
            <span className="text-xs font-bold text-stone-500">حالة الدفع</span>
            <PaymentBadge status={order.paymentStatus} />
          </div>
          <div className="flex items-center justify-between gap-3 rounded-xl border border-stone-200 bg-white p-3">
            <span className="text-xs font-bold text-stone-500">حالة الطلب</span>
            <OrderBadge status={order.status} />
          </div>
        </div>

        <div className="space-y-6 p-5 sm:p-6">
          <section className={`rounded-2xl border p-5 ${pending ? 'border-amber-200 bg-amber-50' : 'border-emerald-200 bg-emerald-50'}`}>
            <div className="flex items-center gap-2">
              <Icon name="wallet" className={`h-5 w-5 ${pending ? 'text-amber-700' : 'text-emerald-700'}`} />
              <h2 className="text-sm font-extrabold">
                {pending ? 'المطلوب تحويل المبلغ الآن' : 'تم تأكيد الدفع من المتجر'}
              </h2>
            </div>

            {pending ? (
              <div className="mt-4 space-y-3">
                <div className="rounded-xl bg-stone-950 p-4 text-white">
                  <p className="text-xs font-bold text-stone-400">حوّل مبلغ</p>
                  <p className="mt-1 text-2xl font-extrabold text-brand-400">{egp(order.total)}</p>
                  <p className="mt-3 text-xs font-bold text-stone-400">على رقم فودافون كاش</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {order.paymentNumbers.length > 0 ? (
                      order.paymentNumbers.map((number) => (
                        <button
                          key={number}
                          type="button"
                          onClick={() => copy(number)}
                          className="rounded-lg bg-white/10 px-4 py-2 font-mono text-lg font-extrabold text-white transition hover:bg-white/20"
                          dir="ltr"
                          title="اضغط للنسخ"
                        >
                          {copied === number ? 'تم النسخ ✓' : number}
                        </button>
                      ))
                    ) : (
                      <span className="text-sm text-amber-200">تواصل مع المتجر لبيانات الدفع.</span>
                    )}
                  </div>
                </div>
                <ul className="space-y-1.5 text-xs leading-6 text-stone-700">
                  <li>• حوّل المبلغ على الرقم اللي فوق.</li>
                  <li>• احفظ الإيصال أو رقم العملية.</li>
                  {order.paymentRef && <li>• رقم العملية المسجّل: <b dir="ltr">{order.paymentRef}</b></li>}
                  <li>• لمن التأكيد من المتجر هتتحول الحالة لـ «تم الدفع».</li>
                </ul>
              </div>
            ) : (
              <p className="mt-2 text-sm text-stone-700">
                {order.paymentStatus === 'paid'
                  ? 'تم تسجيل الدفع للطلب ده وكل حاجة تمام، جاري التجهيز والتوصيل.'
                  : 'الدفع مش مؤكد حاليًا، لو حصلت مشكلة تواصل مع المتجر.'}
              </p>
            )}
          </section>

          <section>
            <h2 className="mb-3 text-sm font-extrabold">المنتجات</h2>
            <ul className="space-y-3">
              {order.items.map((item) => (
                <li key={item.productId} className="flex items-center gap-3 rounded-xl border border-stone-200 p-3">
                  <span className="h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-stone-200">
                    <ProductThumb product={{ name: item.name, category: '', image: item.image }} className="h-full w-full" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-extrabold">{item.name}</span>
                    <span className="text-xs text-stone-500">
                      {item.qty} × {egp(item.price)}
                    </span>
                  </span>
                  <span className="text-sm font-extrabold">{egp(item.price * item.qty)}</span>
                </li>
              ))}
            </ul>
          </section>

          <div className="grid gap-6 sm:grid-cols-2">
            <section>
              <h2 className="mb-2 text-sm font-extrabold">بيانات التوصيل</h2>
              <div className="space-y-1 rounded-xl bg-stone-50 p-4 text-sm text-stone-600">
                <p className="font-bold text-stone-900">{order.customerName}</p>
                <p dir="ltr" className="text-start">{order.phone}</p>
                <p className="leading-6">{order.address}</p>
                {order.notes && <p className="text-xs text-stone-500">ملاحظات: {order.notes}</p>}
              </div>
            </section>

            <section>
              <h2 className="mb-2 text-sm font-extrabold">الملخّص</h2>
              <div className="space-y-2 rounded-xl bg-stone-50 p-4 text-sm">
                <p className="flex justify-between">
                  <span className="text-stone-500">الإجمالي الفرعي</span>
                  <span className="font-bold">{egp(order.subtotal)}</span>
                </p>
                <p className="flex justify-between">
                  <span className="text-stone-500">الشحن</span>
                  <span className="font-bold">{order.shipping > 0 ? egp(order.shipping) : 'مجاني'}</span>
                </p>
                <p className="flex justify-between border-t border-stone-200 pt-2 font-extrabold">
                  <span>الإجمالي</span>
                  <span>{egp(order.total)}</span>
                </p>
                <p className="text-xs text-stone-400">تاريخ الطلب: {formatDate(order.createdAt)}</p>
              </div>
            </section>
          </div>

          <OrderChat mode="customer" code={order.code} phone={order.phone} />

          <div className="flex flex-wrap gap-3 border-t border-stone-200 pt-4">
            <Link to="/products" className="btn-primary">
              تسوّق تاني
            </Link>
            <Link to="/track" className="btn-ghost">
              تتبّع كل طلباتي
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
