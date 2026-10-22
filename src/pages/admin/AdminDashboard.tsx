import { useState } from 'react'
import { Link } from 'react-router-dom'
import { EmptyState, ErrorNote, Icon, PageLoader, PaymentBadge } from '../../components/Bits'
import type { AdminStats, Order } from '../../lib/api'
import { api } from '../../lib/api'
import { egp, formatDate } from '../../lib/format'
import { useApi } from '../../lib/useApi'

type StatsResponse = { stats: AdminStats }
type OrdersResponse = { orders: Order[] }

function StatCard({
  icon,
  label,
  value,
  hint,
}: {
  icon: 'package' | 'wallet' | 'grid' | 'truck'
  label: string
  value: string
  hint?: string
}) {
  return (
    <div className="card flex items-start gap-3 p-5">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-stone-950 text-brand-400">
        <Icon name={icon} className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-bold text-stone-500">{label}</p>
        <p className="mt-1 truncate text-xl font-extrabold text-stone-950">{value}</p>
        {hint && <p className="mt-0.5 text-[11px] text-stone-400">{hint}</p>}
      </div>
    </div>
  )
}

export default function AdminDashboard() {
  const stats = useApi<StatsResponse>('/api/admin/stats')
  const pending = useApi<OrdersResponse>('/api/admin/orders?payment=pending')
  const [busyCode, setBusyCode] = useState('')

  const data = stats.data?.stats

  async function confirmPayment(code: string) {
    setBusyCode(code)
    try {
      await api.patch(`/api/admin/orders/${code}`, { paymentStatus: 'paid' })
      stats.reload()
      pending.reload()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'حصل خطأ')
    } finally {
      setBusyCode('')
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">نظرة عامة</h1>
          <p className="mt-1 text-sm text-stone-500">ملخّص سريع لحالة المتجر دلوقتي.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/admin/products" className="btn-primary">
            <Icon name="plus" className="h-4 w-4" />
            إضافة منتج
          </Link>
          <Link to="/admin/orders" className="btn-ghost">
            كل الطلبات
          </Link>
        </div>
      </div>

      {stats.loading && <PageLoader />}
      {stats.error && <ErrorNote message={stats.error} onRetry={stats.reload} />}

      {data && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard icon="package" label="إجمالي الطلبات" value={String(data.totalOrders)} hint="كل الوقت" />
          <StatCard
            icon="wallet"
            label="منتظر تأكيد الدفع"
            value={String(data.pendingPayments)}
            hint="محتاجة مراجعة"
          />
          <StatCard icon="grid" label="مبيعات مؤكدة" value={egp(data.paidRevenue)} hint="الطلبات المدفوعة" />
          <StatCard icon="truck" label="طلبات النهارده" value={String(data.todayOrders)} />
          <StatCard icon="package" label="منتجات نشطة" value={String(data.activeProducts)} />
          <StatCard icon="grid" label="مخزون منخفض" value={String(data.lowStock)} hint="3 قطع أو أقل" />
        </div>
      )}

      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-extrabold">طلبات تستنى تأكيد الدفع</h2>
          <Link to="/admin/orders?payment=pending" className="text-sm font-bold text-brand-700 hover:text-brand-800">
            عرض الكل
          </Link>
        </div>

        {pending.loading && <PageLoader label="جاري التحميل…" />}
        {pending.error && <ErrorNote message={pending.error} onRetry={pending.reload} />}

        {!pending.loading && (pending.data?.orders.length ?? 0) === 0 && (
          <EmptyState icon="check" title="مفيش طلبات منتظر تأكيد الدفع" description="كل الطلبات تم مراجعتها." />
        )}

        {(pending.data?.orders.length ?? 0) > 0 && (
          <ul className="space-y-3">
            {pending.data!.orders.slice(0, 6).map((order) => (
              <li key={order.code} className="card flex flex-wrap items-center gap-4 p-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono font-extrabold" dir="ltr">
                      #{order.code}
                    </span>
                    <PaymentBadge status={order.paymentStatus} />
                  </div>
                  <p className="mt-1 text-sm text-stone-600">
                    {order.customerName} — <span dir="ltr">{order.phone}</span>
                  </p>
                  <p className="text-xs text-stone-400">
                    {formatDate(order.createdAt)} • {order.items.length} منتج
                    {order.paymentRef && <> • رقم العملية: <b dir="ltr">{order.paymentRef}</b></>}
                  </p>
                </div>

                <p className="text-lg font-extrabold">{egp(order.total)}</p>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => confirmPayment(order.code)}
                    disabled={busyCode === order.code}
                    className="btn-primary !bg-emerald-600 hover:!bg-emerald-700 !py-2"
                  >
                    <Icon name="check" className="h-4 w-4" />
                    تأكيد الدفع
                  </button>
                  <Link to={`/admin/orders?code=${order.code}`} className="btn-ghost !py-2">
                    تفاصيل
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
