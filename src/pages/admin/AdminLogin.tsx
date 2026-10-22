import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ErrorNote, Icon, Spinner } from '../../components/Bits'
import { adminSession, api } from '../../lib/api'
import { useStore } from '../../lib/store'

export default function AdminLogin({
  needsSetup,
  setupKeyRequired,
  onAuthenticated,
}: {
  needsSetup: boolean
  setupKeyRequired: boolean
  onAuthenticated: () => void
}) {
  const { store } = useStore()
  const [setupMode, setSetupMode] = useState(needsSetup)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [setupKey, setSetupKey] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    setError('')

    const cleanEmail = email.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(cleanEmail)) {
      setError('اكتب الإيميل بشكل صحيح')
      return
    }

    if (setupMode) {
      if (password.length < 8) {
        setError('كلمة السر لازم تكون 8 خانات على الأقل')
        return
      }
      if (password !== confirm) {
        setError('كلمتا السر غير متطابقتين')
        return
      }
    } else if (!password) {
      setError('اكتب كلمة السر')
      return
    }

    setBusy(true)
    try {
      const result = await api.post<{ message: string; token?: string }>(
        setupMode ? '/api/admin/setup' : '/api/admin/login',
        setupMode ? { email: cleanEmail, password, setupKey } : { email: cleanEmail, password },
      )
      if (result.token) adminSession.set(result.token)
      setPassword('')
      setConfirm('')
      onAuthenticated()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'حصل خطأ، حاول تاني')
      if (setupMode && err instanceof Error && err.message.includes('من قبل')) setSetupMode(false)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid min-h-screen bg-stone-950 lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between overflow-hidden p-10 lg:flex">
        <div className="pointer-events-none absolute -start-24 -top-24 h-80 w-80 rounded-full bg-brand-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 end-0 h-96 w-96 rounded-full bg-brand-600/10 blur-3xl" />

        <div className="relative flex items-center gap-2.5 text-white">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-500 text-stone-950">
            <Icon name="bag" className="h-5 w-5" />
          </span>
          <span className="text-lg font-extrabold">{store.name}</span>
        </div>

        <div className="relative space-y-5">
          <h1 className="text-4xl font-extrabold leading-tight text-white">لوحة تحكم المتجر</h1>
          <p className="max-w-md text-sm leading-7 text-stone-400">
            من هنا ترفع منتجاتك وتحدد رقم فودافون كاش لكل منتج، وتتابع الطلبات وتأكد الدفع أول ما التحويل يوصل.
          </p>
          <ul className="space-y-2.5 text-sm text-stone-300">
            <li className="flex items-center gap-2">
              <Icon name="package" className="h-4 w-4 text-brand-400" /> إضافة وتعديل وحذف المنتجات
            </li>
            <li className="flex items-center gap-2">
              <Icon name="wallet" className="h-4 w-4 text-brand-400" /> تأكيد الدفع أو رفضه لكل طلب
            </li>
            <li className="flex items-center gap-2">
              <Icon name="users" className="h-4 w-4 text-brand-400" /> إضافة مسؤولين بصلاحية مؤقتة أو دائمة
            </li>
          </ul>
        </div>

        <p className="relative text-xs text-stone-500">الدخول للوحة التحكم مقصور على الحسابات المصرّح لها فقط.</p>
      </div>

      <div className="flex items-center justify-center bg-stone-50 p-6">
        <form onSubmit={submit} className="w-full max-w-sm space-y-4">
          <div className="mb-2 lg:hidden">
            <div className="flex items-center gap-2.5">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-500 text-stone-950">
                <Icon name="bag" className="h-5 w-5" />
              </span>
              <span className="text-lg font-extrabold text-stone-950">{store.name}</span>
            </div>
          </div>

          <div>
            <span className="mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-stone-950 text-brand-400">
              <Icon name="lock" className="h-6 w-6" />
            </span>
            <h2 className="text-2xl font-extrabold text-stone-950">
              {setupMode ? 'تفعيل حساب مالك الموقع' : 'تسجيل دخول المسؤول'}
            </h2>
            <p className="mt-1 text-sm text-stone-500">
              {setupMode
                ? 'أول مرة؟ اكتب إيميل المالك واختار كلمة سر قوية (8 خانات على الأقل).'
                : 'ادخل بالإيميل وكلمة السر المصرّح بيهم للوحة التحكم.'}
            </p>
          </div>

          {error && <ErrorNote message={error} />}

          <div>
            <label className="label" htmlFor="admin-email">الإيميل</label>
            <input
              id="admin-email"
              type="email"
              inputMode="email"
              autoComplete="username"
              dir="ltr"
              className="input"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="name@gmail.com"
              autoFocus
            />
          </div>

          <div>
            <label className="label" htmlFor="admin-password">كلمة السر</label>
            <div className="relative">
              <input
                id="admin-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete={setupMode ? 'new-password' : 'current-password'}
                dir="ltr"
                className="input !pe-20"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                className="absolute end-3 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1 text-xs font-bold text-stone-500 hover:bg-stone-100"
              >
                {showPassword ? 'إخفاء' : 'إظهار'}
              </button>
            </div>
          </div>

          {setupMode && (
            <>
              <div>
                <label className="label" htmlFor="admin-confirm">تأكيد كلمة السر</label>
                <input
                  id="admin-confirm"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  dir="ltr"
                  className="input"
                  value={confirm}
                  onChange={(event) => setConfirm(event.target.value)}
                  placeholder="••••••••"
                />
              </div>

              {setupKeyRequired && (
                <div>
                  <label className="label" htmlFor="admin-setup-key">مفتاح التفعيل (SETUP_KEY)</label>
                  <input
                    id="admin-setup-key"
                    type="password"
                    dir="ltr"
                    className="input"
                    value={setupKey}
                    onChange={(event) => setSetupKey(event.target.value)}
                  />
                </div>
              )}
            </>
          )}

          <button type="submit" className="btn-accent w-full" disabled={busy}>
            {busy ? <Spinner className="h-4 w-4" /> : <Icon name="lock" className="h-4 w-4" />}
            {setupMode ? 'تفعيل الحساب والدخول' : 'دخول'}
          </button>

          <div className="text-xs text-stone-400">
            <Link to="/" className="font-bold hover:text-stone-700">← رجوع للمتجر</Link>
          </div>
        </form>
      </div>
    </div>
  )
}
