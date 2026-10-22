import { NavLink, Outlet, Link, useNavigate } from 'react-router-dom'
import { ErrorNote, Icon, PageLoader } from '../../components/Bits'
import type { Bootstrap } from '../../lib/api'
import { formatDate } from '../../lib/format'
import { adminSession, api } from '../../lib/api'
import { useApi } from '../../lib/useApi'
import AdminLogin from './AdminLogin'

const TABS = [
  { to: '/admin', label: 'نظرة عامة', icon: 'grid', end: true, ownerOnly: false },
  { to: '/admin/orders', label: 'الطلبات', icon: 'package', end: false, ownerOnly: false },
  { to: '/admin/products', label: 'المنتجات', icon: 'bag', end: false, ownerOnly: false },
  { to: '/admin/team', label: 'المسؤولين', icon: 'users', end: false, ownerOnly: true },
  { to: '/admin/settings', label: 'الإعدادات', icon: 'settings', end: false, ownerOnly: false },
]

export default function AdminShell() {
  const { data, loading, error, reload } = useApi<Bootstrap>('/api/admin/bootstrap')
  const navigate = useNavigate()

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-stone-100">
        <PageLoader label="جاري فتح لوحة التحكم…" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="mx-auto max-w-md px-4 py-20">
        <ErrorNote message={error} onRetry={reload} />
      </div>
    )
  }

  if (!data?.authenticated) {
    return (
      <AdminLogin
        needsSetup={data?.needsSetup ?? false}
        setupKeyRequired={data?.setupKeyRequired ?? false}
        onAuthenticated={reload}
      />
    )
  }

  async function logout() {
    try {
      await api.post('/api/admin/logout')
    } finally {
      adminSession.clear()
      navigate('/', { replace: true })
      reload()
    }
  }

  const me = data.admin
  const isOwner = me?.role === 'owner'
  const tabs = TABS.filter((tab) => !tab.ownerOnly || isOwner)

  return (
    <div className="min-h-screen bg-stone-100">
      <header className="bg-stone-950 text-white">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4">
          <div className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-500 text-stone-950">
              <Icon name="lock" className="h-5 w-5" />
            </span>
            <div className="leading-4">
              <p className="text-sm font-extrabold">لوحة التحكم</p>
              <p className="max-w-[11rem] truncate text-[11px] text-stone-400 sm:max-w-xs" dir="ltr">
                {me?.email}
                {isOwner ? ' · المالك' : ''}
              </p>
            </div>
          </div>

          <div className="ms-auto flex items-center gap-2">
            <Link to="/" className="btn-ghost !border-stone-700 !bg-transparent !text-stone-200 hover:!bg-stone-900 !py-2">
              عرض المتجر
            </Link>
            <button type="button" onClick={logout} className="btn-accent !py-2">
              <Icon name="logout" className="h-4 w-4" />
              <span className="hidden sm:inline">خروج</span>
            </button>
          </div>
        </div>

        <nav className="border-t border-stone-800">
          <div className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4">
            {tabs.map((tab) => (
              <NavLink
                key={tab.to}
                to={tab.to}
                end={tab.end}
                className={({ isActive }) =>
                  `flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 text-sm font-bold transition ${
                    isActive
                      ? 'border-brand-400 text-brand-300'
                      : 'border-transparent text-stone-400 hover:text-white'
                  }`
                }
              >
                <Icon name={tab.icon} className="h-4 w-4" />
                {tab.label}
              </NavLink>
            ))}
          </div>
        </nav>
      </header>

      {me && !isOwner && me.expiresAt && (
        <div className="bg-brand-100 px-4 py-2 text-center text-xs font-bold text-brand-900">
          صلاحية حسابك مؤقتة وتنتهي في {formatDate(me.expiresAt)}
        </div>
      )}

      <main className="mx-auto max-w-7xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  )
}
