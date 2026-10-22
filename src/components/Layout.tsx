import { useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useCart } from '../lib/cart'
import { useStore } from '../lib/store'
import { Icon } from './Bits'

const NAV_LINKS = [
  { to: '/', label: 'الرئيسية' },
  { to: '/products', label: 'كل المنتجات' },
  { to: '/track', label: 'تتبع طلبك' },
]

function Logo({ name }: { name: string }) {
  return (
    <Link to="/" className="flex items-center gap-2.5">
      <span className="grid h-10 w-10 place-items-center rounded-2xl bg-brand-500 text-stone-950">
        <Icon name="bag" className="h-5 w-5" />
      </span>
      <span className="text-lg font-extrabold tracking-tight text-stone-950">{name}</span>
    </Link>
  )
}

export default function Layout() {
  const { count } = useCart()
  const { store } = useStore()
  const location = useLocation()
  const [open, setOpen] = useState(false)

  return (
    <div className="flex min-h-screen flex-col">
      {store.announcement && (
        <div className="bg-stone-950">
          <div className="mx-auto max-w-7xl px-4 py-2 text-center text-xs font-bold text-brand-200 sm:text-sm">
            {store.announcement}
          </div>
        </div>
      )}

      <header className="sticky top-0 z-40 border-b border-stone-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4">
          <Logo name={store.name} />

          <div className="ms-auto flex items-center gap-2">
            <nav className="hidden items-center gap-1 md:flex">
              {NAV_LINKS.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  end={link.to === '/'}
                  className={({ isActive }) =>
                    `rounded-xl px-3.5 py-2 text-sm font-bold transition ${
                      isActive ? 'bg-stone-900 text-white' : 'text-stone-600 hover:bg-stone-100 hover:text-stone-950'
                    }`
                  }
                >
                  {link.label}
                </NavLink>
              ))}
            </nav>

            <Link
              to="/cart"
              className="btn-ghost relative !px-3"
              aria-label={`السلة (${count})`}
            >
              <Icon name="cart" className="h-5 w-5" />
              <span className="hidden sm:inline">السلة</span>
              {count > 0 && (
                <span className="absolute -top-2 -start-2 grid h-5 min-w-5 place-items-center rounded-full bg-brand-500 px-1 text-[11px] font-extrabold text-stone-950">
                  {count}
                </span>
              )}
            </Link>

            <Link
              to="/admin"
              className="hidden h-10 w-10 place-items-center rounded-xl border border-stone-300 text-stone-500 transition hover:border-stone-900 hover:text-stone-950 sm:grid"
              title="لوحة التحكم"
              aria-label="لوحة التحكم"
            >
              <Icon name="lock" className="h-4.5 w-4.5" />
            </Link>

            <button
              type="button"
              onClick={() => setOpen((value) => !value)}
              className="grid h-10 w-10 place-items-center rounded-xl border border-stone-300 text-stone-700 md:hidden"
              aria-label="القائمة"
              aria-expanded={open}
            >
              <Icon name={open ? 'x' : 'menu'} className="h-5 w-5" />
            </button>
          </div>
        </div>

        {open && (
          <nav className="border-t border-stone-200 bg-white px-4 py-3 md:hidden">
            <div className="flex flex-col gap-1">
              {NAV_LINKS.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  end={link.to === '/'}
                  onClick={() => setOpen(false)}
                  className={({ isActive }) =>
                    `rounded-xl px-3 py-2.5 text-sm font-bold ${
                      isActive ? 'bg-stone-900 text-white' : 'text-stone-700 hover:bg-stone-100'
                    }`
                  }
                >
                  {link.label}
                </NavLink>
              ))}
              <NavLink
                to="/admin"
                onClick={() => setOpen(false)}
                className="rounded-xl px-3 py-2.5 text-sm font-bold text-stone-500 hover:bg-stone-100"
              >
                لوحة التحكم
              </NavLink>
            </div>
          </nav>
        )}
      </header>

      <main className="flex-1" key={location.pathname}>
        <Outlet />
      </main>

      <footer className="mt-16 bg-stone-950 text-stone-300">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-3">
            <div className="flex items-center gap-2.5 text-white">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-500 text-stone-950">
                <Icon name="bag" className="h-5 w-5" />
              </span>
              <span className="text-lg font-extrabold">{store.name}</span>
            </div>
            <p className="text-sm leading-6 text-stone-400">
              متجرك لكل اللي محتاجه من شنط وملابس أصلية بجودة عالية وتوصيل لحد باب البيت.
            </p>
          </div>

          <div>
            <h4 className="mb-3 text-sm font-extrabold text-white">روابط سريعة</h4>
            <ul className="space-y-2 text-sm">
              {NAV_LINKS.map((link) => (
                <li key={link.to}>
                  <Link to={link.to} className="transition hover:text-brand-300">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="mb-3 text-sm font-extrabold text-white">طرق الدفع</h4>
            <ul className="space-y-2 text-sm text-stone-400">
              <li className="flex items-center gap-2">
                <Icon name="wallet" className="h-4 w-4 text-brand-400" /> فودافون كاش
              </li>
              <li className="flex items-center gap-2">
                <Icon name="truck" className="h-4 w-4 text-brand-400" /> توصيل لكل محافظات مصر
              </li>
            </ul>
          </div>

          <div>
            <h4 className="mb-3 text-sm font-extrabold text-white">تواصل معنا</h4>
            {store.phone && (
              <a href={`tel:${store.phone}`} className="mb-2 flex items-center gap-2 text-sm transition hover:text-brand-300">
                <Icon name="phone" className="h-4 w-4 text-brand-400" />
                <span dir="ltr">{store.phone}</span>
              </a>
            )}
            <Link to="/track" className="flex items-center gap-2 text-sm transition hover:text-brand-300">
              <Icon name="search" className="h-4 w-4 text-brand-400" />
              تتبّع حالة طلبك
            </Link>
          </div>
        </div>

        <div className="border-t border-stone-800">
          <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 py-4 text-xs text-stone-500 sm:flex-row">
            <p>© {new Date().getFullYear()} {store.name} — جميع الحقوق محفوظة.</p>
            <p>الدفع يتم عبر تحويل فودافون كاش وتأكيد الطلب من المتجر.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
