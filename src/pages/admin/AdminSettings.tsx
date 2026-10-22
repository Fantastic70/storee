import { useEffect, useState, type FormEvent } from 'react'
import { ErrorNote, Icon, Spinner } from '../../components/Bits'
import { adminSession, api } from '../../lib/api'
import { useStore } from '../../lib/store'
import { useApi } from '../../lib/useApi'

type SettingsData = {
  storeName: string
  storePhone: string
  announcement: string
  shippingFee: number
}

type SettingsResponse = { settings: SettingsData }

export default function AdminSettings() {
  const { reload: reloadStore } = useStore()
  const { data, loading, error, reload } = useApi<SettingsResponse>('/api/admin/settings')

  const [storeName, setStoreName] = useState('')
  const [storePhone, setStorePhone] = useState('')
  const [announcement, setAnnouncement] = useState('')
  const [shippingFee, setShippingFee] = useState('0')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState('')
  const [formError, setFormError] = useState('')

  const [currentPassword, setCurrentPassword] = useState('')
  const [nextPassword, setNextPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)
  const [passwordMessage, setPasswordMessage] = useState('')
  const [passwordError, setPasswordError] = useState('')

  useEffect(() => {
    if (!data) return
    setStoreName(data.settings.storeName)
    setStorePhone(data.settings.storePhone)
    setAnnouncement(data.settings.announcement)
    setShippingFee(String(data.settings.shippingFee))
  }, [data])

  async function saveSettings(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setSaved('')
    setFormError('')
    try {
      await api.put('/api/admin/settings', {
        storeName,
        storePhone,
        announcement,
        shippingFee: Number(shippingFee || 0),
      })
      setSaved('تم حفظ الإعدادات ✓')
      reloadStore()
      setTimeout(() => setSaved(''), 3000)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'حصل خطأ')
    } finally {
      setSaving(false)
    }
  }

  async function savePassword(event: FormEvent) {
    event.preventDefault()
    setPasswordError('')
    setPasswordMessage('')
    if (nextPassword !== confirmPassword) {
      setPasswordError('كلمتا السر غير متطابقتين')
      return
    }
    setSavingPassword(true)
    try {
      const result = await api.put<{ message: string; token?: string }>('/api/admin/password', {
        current: currentPassword,
        next: nextPassword,
      })
      if (result.token) adminSession.set(result.token)
      setPasswordMessage(result.message)
      setCurrentPassword('')
      setNextPassword('')
      setConfirmPassword('')
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : 'حصل خطأ')
    } finally {
      setSavingPassword(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner className="h-8 w-8 text-stone-900" />
      </div>
    )
  }

  if (error) return <ErrorNote message={error} onRetry={reload} />

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-extrabold">الإعدادات</h1>
        <p className="mt-1 text-sm text-stone-500">بيانات المتجر ورسوم الشحن وكلمة سر حسابك.</p>
      </div>

      <form onSubmit={saveSettings} className="card space-y-4 p-6">
        <h2 className="flex items-center gap-2 text-lg font-extrabold">
          <Icon name="settings" className="h-5 w-5 text-brand-600" />
          بيانات المتجر
        </h2>

        {formError && <ErrorNote message={formError} />}
        {saved && (
          <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">{saved}</p>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="store-name">اسم المتجر</label>
            <input id="store-name" className="input" value={storeName} onChange={(e) => setStoreName(e.target.value)} required />
          </div>
          <div>
            <label className="label" htmlFor="store-phone">رقم تواصل (يظهر للعملاء)</label>
            <input
              id="store-phone"
              className="input"
              dir="ltr"
              value={storePhone}
              onChange={(e) => setStorePhone(e.target.value.replace(/[^0-9]/g, '').slice(0, 11))}
              placeholder="01012345678"
            />
          </div>
        </div>

        <div>
          <label className="label" htmlFor="announcement">شريط الإعلان أعلى الموقع</label>
          <input
            id="announcement"
            className="input"
            value={announcement}
            onChange={(e) => setAnnouncement(e.target.value)}
            placeholder="مثال: شحن لكل المحافظات — الدفع عبر فودافون كاش"
            maxLength={160}
          />
        </div>

        <div className="sm:w-64">
          <label className="label" htmlFor="shipping-fee">رسوم الشحن (ج.م)</label>
          <input
            id="shipping-fee"
            className="input"
            dir="ltr"
            inputMode="numeric"
            value={shippingFee}
            onChange={(e) => setShippingFee(e.target.value.replace(/[^0-9]/g, ''))}
          />
          <p className="mt-1 text-xs text-stone-400">اكتب 0 لو الشحن مجاني.</p>
        </div>

        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? <Spinner className="h-4 w-4" /> : <Icon name="check" className="h-4 w-4" />}
          حفظ الإعدادات
        </button>
      </form>

      <form onSubmit={savePassword} className="card max-w-xl space-y-4 p-6">
        <h2 className="flex items-center gap-2 text-lg font-extrabold">
          <Icon name="lock" className="h-5 w-5 text-brand-600" />
          تغيير كلمة سر حسابك
        </h2>

        {passwordError && <ErrorNote message={passwordError} />}
        {passwordMessage && (
          <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">{passwordMessage}</p>
        )}

        <div>
          <label className="label" htmlFor="current-password">كلمة السر الحالية</label>
          <input
            id="current-password"
            type="password"
            className="input"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="new-password">كلمة السر الجديدة</label>
            <input
              id="new-password"
              type="password"
              className="input"
              value={nextPassword}
              onChange={(e) => setNextPassword(e.target.value)}
              required
              minLength={8}
            />
          </div>
          <div>
            <label className="label" htmlFor="confirm-new-password">تأكيد الجديدة</label>
            <input
              id="confirm-new-password"
              type="password"
              className="input"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={8}
            />
          </div>
        </div>

        <button type="submit" className="btn-accent" disabled={savingPassword}>
          {savingPassword ? <Spinner className="h-4 w-4" /> : <Icon name="check" className="h-4 w-4" />}
          تغيير كلمة السر
        </button>
      </form>
    </div>
  )
}
