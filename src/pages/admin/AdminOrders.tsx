import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { EmptyState, ErrorNote, Icon, OrderBadge, PageLoader, PaymentBadge, ProductThumb, Spinner } from '../../components/Bits'
import OrderChat from '../../components/OrderChat'
import type { Order } from '../../lib/api'
import { api } from '../../lib/api'
import { ORDER_STATUSES, PAYMENT_STATUSES, ORDER_META, egp, formatDate } from '../../lib/format'
import { useApi } from '../../lib/useApi'

type OrdersResponse = { orders: Order[]; counters: Record<string, number> }

const PAYMENT_TABS: { key: string; label: string }[] = [
  { key: '', label: 'الكل' },
  { key: 'pending', label: 'منتظر الدفع' },
  { key: 'paid', label: 'تم الدفع' },
  { key: 'rejected', label: 'غير مؤكد' },
  { key: 'unread', label: 'رسائل جديدة' },
]

export default function AdminOrders() {
  const [params, setParams] = useSearchParams()
  const payment = params.get('payment') || ''
  const status = params.get('status') || ''
  const unread = params.get('unread') === '1'
  const openCode = params.get('code') || ''

  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')
  const [busyCode, setBusyCode] = useState('')
  const [actionError, setActionError] = useState('')
  const [readCodes, setReadCodes] = useState<string[]>([])

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), 350)
    return () => clearTimeout(timer)
  }, [query])

  const path = useMemo(() => {
    const search = new URLSearchParams()
    if (payment) search.set('payment', payment)
    if (status) search.set('status', status)
    if (unread) search.set('unread', '1')
    if (debounced) search.set('q', debounced)
    return `/api/admin/orders?${search.toString()}`
  }, [payment, status, unread, debounced])

  const { data, loading, error, reload } = useApi<OrdersResponse>(path)

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next, { replace: true })
  }

  const markRead = useCallback((code: string) => {
    setReadCodes((current) => (current.includes(code) ? current : [...current, code]))
  }, [])

  async function patch(code: string, body: Record<string, string>) {
    setBusyCode(code)
    setActionError('')
    try {
      await api.patch(`/api/admin/orders/${code}`, body)
      reload()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'حصل خطأ أثناء الحفظ')
    } finally {
      setBusyCode('')
    }
  }

  const counters = data?.counters ?? {}
  const orders = data?.orders ?? []
  const openOrder = orders.find((order) => order.code === openCode)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">الطلبات</h1>
          <p className="mt-1 text-sm text-stone-500">
            {data ? `${orders.length} طلب${payment ? ' مطابق' : ''}` : '…'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Icon name="search" className="pointer-events-none absolute inset-y-0 end-3 my-auto h-4 w-4 text-stone-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="رقم الطلب أو الموبايل أو الاسم"
              className="input pe-10 sm:w-72"
              aria-label="بحث في الطلبات"
            />
          </div>
          <button type="button" onClick={reload} className="btn-ghost !px-3" title="تحديث" aria-label="تحديث">
            <Icon name="refresh" className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {PAYMENT_TABS.map((tab) => {
          const isUnreadTab = tab.key === 'unread'
          const count = tab.key ? counters[tab.key] ?? 0 : orders.length
          const active = isUnreadTab ? unread : !unread && payment === tab.key
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => {
                const next = new URLSearchParams(params)
                next.delete('payment')
                next.delete('unread')
                if (isUnreadTab) next.set('unread', '1')
                else if (tab.key) next.set('payment', tab.key)
                setParams(next, { replace: true })
              }}
              className={`rounded-full px-4 py-2 text-sm font-bold transition ${
                active ? 'bg-stone-950 text-white' : 'border border-stone-300 bg-white text-stone-600 hover:border-stone-900'
              }`}
            >
              {tab.label}
              <span className={`ms-1.5 text-xs ${active ? 'text-brand-300' : 'text-stone-400'}`}>{count}</span>
            </button>
          )
        })}

        <select value={status} onChange={(event) => setParam('status', event.target.value)} className="input !w-auto ms-auto" aria-label="فلتر حالة الطلب">
          <option value="">كل حالات الطلب</option>
          {ORDER_STATUSES.map((value) => (
            <option key={value} value={value}>
              {ORDER_META[value].label}
            </option>
          ))}
        </select>
      </div>

      {actionError && <ErrorNote message={actionError} />}
      {loading && <PageLoader />}
      {error && <ErrorNote message={error} onRetry={reload} />}

      {!loading && !error && orders.length === 0 && (
        <EmptyState
          icon="package"
          title="مفيش طلبات هنا"
          description="غيّر الفلتر أو استنى أول طلب من العملاء."
          action={
            <button
              type="button"
              className="btn-ghost"
              onClick={() => {
                setQuery('')
                setParams(new URLSearchParams(), { replace: true })
              }}
            >
              مسح الفلاتر
            </button>
          }
        />
      )}

      {!loading && !error && orders.length > 0 && (
        <ul className="space-y-3">
          {orders.map((order) => {
            const open = order.code === openCode
            const busy = busyCode === order.code
            return (
              <li key={order.code} className="card overflow-hidden">
                <button
                  type="button"
                  onClick={() => setParam('code', open ? '' : order.code)}
                  className="flex w-full flex-wrap items-center gap-4 p-4 text-start transition hover:bg-stone-50"
                  aria-expanded={open}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-base font-extrabold" dir="ltr">
                        #{order.code}
                      </span>
                      <PaymentBadge status={order.paymentStatus} />
                      <OrderBadge status={order.status} />
                      {(order.unreadMessages ?? 0) > 0 && !readCodes.includes(order.code) && (
                        <span className="badge bg-red-500 text-white">
                          <Icon name="chat" className="h-3 w-3" />
                          {order.unreadMessages} رسالة جديدة
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm font-bold text-stone-700">{order.customerName}</p>
                    <p className="text-xs text-stone-400">
                      <span dir="ltr">{order.phone}</span> • {formatDate(order.createdAt)}
                    </p>
                  </div>

                  <div className="text-end">
                    <p className="text-lg font-extrabold">{egp(order.total)}</p>
                    <p className="text-xs text-stone-400">{order.items.length} منتج</p>
                  </div>

                  <Icon name="chevronDown" className={`h-5 w-5 shrink-0 text-stone-400 transition ${open ? 'rotate-180' : ''}`} />
                </button>

                {open && openOrder && (
                  <div className="border-t border-stone-200 bg-stone-50 p-4 sm:p-5">
                    <div className="grid gap-5 lg:grid-cols-2">
                      <div className="space-y-4">
                        <section>
                          <h3 className="mb-2 text-xs font-extrabold uppercase text-stone-400">المنتجات</h3>
                          <ul className="space-y-2">
                            {openOrder.items.map((item) => (
                              <li key={item.productId} className="flex items-center gap-3 rounded-xl border border-stone-200 bg-white p-2.5">
                                <span className="h-11 w-11 shrink-0 overflow-hidden rounded-lg border border-stone-200">
                                  <ProductThumb product={{ name: item.name, category: '', image: item.image }} className="h-full w-full" />
                                </span>
                                <span className="min-w-0 flex-1">
                                  <span className="block truncate text-sm font-bold">{item.name}</span>
                                  <span className="text-xs text-stone-500">
                                    {item.qty} × {egp(item.price)}
                                  </span>
                                </span>
                                <span className="text-sm font-extrabold">{egp(item.price * item.qty)}</span>
                              </li>
                            ))}
                          </ul>
                        </section>

                        <section className="rounded-xl border border-stone-200 bg-white p-4 text-sm">
                          <h3 className="mb-2 text-xs font-extrabold uppercase text-stone-400">بيانات العميل</h3>
                          <p className="font-bold">{openOrder.customerName}</p>
                          <p dir="ltr" className="text-start text-stone-600">{openOrder.phone}</p>
                          <p className="mt-1 leading-6 text-stone-600">{openOrder.address}</p>
                          {openOrder.notes && <p className="mt-1 text-xs text-stone-500">ملاحظات: {openOrder.notes}</p>}
                        </section>
                      </div>

                      <div className="space-y-4">
                        <section className="rounded-xl border border-stone-200 bg-white p-4">
                          <h3 className="mb-3 text-xs font-extrabold uppercase text-stone-400">الدفع</h3>

                          <dl className="space-y-1.5 text-sm">
                            <div className="flex justify-between">
                              <dt className="text-stone-500">الإجمالي الفرعي</dt>
                              <dd className="font-bold">{egp(openOrder.subtotal)}</dd>
                            </div>
                            <div className="flex justify-between">
                              <dt className="text-stone-500">الشحن</dt>
                              <dd className="font-bold">{egp(openOrder.shipping)}</dd>
                            </div>
                            <div className="flex justify-between border-t border-stone-200 pt-2 font-extrabold">
                              <dt>الإجمالي</dt>
                              <dd>{egp(openOrder.total)}</dd>
                            </div>
                          </dl>

                          <div className="mt-3 space-y-2 rounded-xl bg-brand-50 p-3 text-xs">
                            <p className="flex justify-between">
                              <span className="text-stone-500">الأرقام المستلمة</span>
                              <span className="font-bold" dir="ltr">
                                {openOrder.paymentNumbers.join(' - ') || '—'}
                              </span>
                            </p>
                            <p className="flex justify-between">
                              <span className="text-stone-500">رقم عملية التحويل</span>
                              <span className="font-bold" dir="ltr">
                                {openOrder.paymentRef || '—'}
                              </span>
                            </p>
                          </div>

                          <div className="mt-4 grid gap-2 sm:grid-cols-3">
                            <button
                              type="button"
                              onClick={() => patch(order.code, { paymentStatus: 'paid' })}
                              disabled={busy || openOrder.paymentStatus === 'paid'}
                              className="btn-primary !bg-emerald-600 !py-2 hover:!bg-emerald-700"
                            >
                              {busy ? <Spinner className="h-4 w-4" /> : <Icon name="check" className="h-4 w-4" />}
                              تم الدفع
                            </button>
                            <button
                              type="button"
                              onClick={() => patch(order.code, { paymentStatus: 'pending' })}
                              disabled={busy || openOrder.paymentStatus === 'pending'}
                              className="btn-ghost !py-2"
                            >
                              منتظر التأكيد
                            </button>
                            <button
                              type="button"
                              onClick={() => patch(order.code, { paymentStatus: 'rejected' })}
                              disabled={busy || openOrder.paymentStatus === 'rejected'}
                              className="btn-danger !py-2"
                            >
                              <Icon name="x" className="h-4 w-4" />
                              رفض الدفع
                            </button>
                          </div>

                          <p className="mt-2 text-[11px] leading-5 text-stone-500">
                            {PAYMENT_STATUSES.includes(openOrder.paymentStatus)
                              ? 'الحالة دي بتظهر للعميل في صفحة تتبع الطلب فورًا.'
                              : ''}
                          </p>
                        </section>

                        <section className="rounded-xl border border-stone-200 bg-white p-4">
                          <h3 className="mb-3 text-xs font-extrabold uppercase text-stone-400">حالة التنفيذ</h3>
                          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                            {ORDER_STATUSES.map((value) => {
                              const active = openOrder.status === value
                              return (
                                <button
                                  key={value}
                                  type="button"
                                  disabled={busy}
                                  onClick={() => patch(order.code, { status: value })}
                                  className={`rounded-xl border px-3 py-2 text-xs font-bold transition ${
                                    active
                                      ? 'border-stone-950 bg-stone-950 text-white'
                                      : 'border-stone-300 bg-white text-stone-600 hover:border-stone-900'
                                  }`}
                                >
                                  {ORDER_META[value].label}
                                </button>
                              )
                            })}
                          </div>
                        </section>
                      </div>
                    </div>

                    <div className="mt-5">
                      <OrderChat mode="admin" code={order.code} onRead={() => markRead(order.code)} />
                    </div>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
