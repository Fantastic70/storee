import { useState, type FormEvent } from 'react'
import { EmptyState, ErrorNote, Icon, PageLoader, Spinner } from '../../components/Bits'
import type { TeamMember } from '../../lib/api'
import { api } from '../../lib/api'
import { formatDate } from '../../lib/format'
import { useApi } from '../../lib/useApi'

type TeamResponse = { members: TeamMember[] }

/* ------------------------------- مدة الصلاحية ------------------------------- */

type Duration = { preset: string; amount: string; unit: 'hours' | 'days' }

const PRESETS: { value: string; label: string; hours: number | null }[] = [
  { value: '1', label: 'ساعة واحدة', hours: 1 },
  { value: '6', label: '6 ساعات', hours: 6 },
  { value: '24', label: 'يوم واحد', hours: 24 },
  { value: '72', label: '3 أيام', hours: 72 },
  { value: '168', label: 'أسبوع', hours: 168 },
  { value: '720', label: 'شهر (30 يوم)', hours: 720 },
  { value: '2160', label: '3 شهور', hours: 2160 },
  { value: '8760', label: 'سنة', hours: 8760 },
  { value: 'unlimited', label: 'غير محدودة', hours: null },
]

const DEFAULT_DURATION: Duration = { preset: '168', amount: '1', unit: 'days' }

/** undefined = مدخل غير صالح، null = غير محدودة، رقم = عدد الساعات */
function durationToHours(duration: Duration): number | null | undefined {
  if (duration.preset === 'custom') {
    const amount = Math.floor(Number(duration.amount))
    if (!Number.isFinite(amount) || amount < 1) return undefined
    const hours = duration.unit === 'days' ? amount * 24 : amount
    return hours <= 24 * 365 * 5 ? hours : undefined
  }
  return PRESETS.find((preset) => preset.value === duration.preset)?.hours
}

function DurationPicker({
  value,
  onChange,
  idPrefix,
}: {
  value: Duration
  onChange: (next: Duration) => void
  idPrefix: string
}) {
  return (
    <div className="space-y-2">
      <select
        id={`${idPrefix}-preset`}
        className="input"
        value={value.preset}
        onChange={(event) => onChange({ ...value, preset: event.target.value })}
      >
        {PRESETS.map((preset) => (
          <option key={preset.value} value={preset.value}>
            {preset.label}
          </option>
        ))}
        <option value="custom">مدة مخصصة…</option>
      </select>

      {value.preset === 'custom' && (
        <div className="flex gap-2">
          <input
            className="input"
            dir="ltr"
            inputMode="numeric"
            value={value.amount}
            onChange={(event) => onChange({ ...value, amount: event.target.value.replace(/[^0-9]/g, '').slice(0, 5) })}
            aria-label="عدد"
          />
          <select
            className="input !w-32 shrink-0"
            value={value.unit}
            onChange={(event) => onChange({ ...value, unit: event.target.value === 'hours' ? 'hours' : 'days' })}
            aria-label="الوحدة"
          >
            <option value="hours">ساعة</option>
            <option value="days">يوم</option>
          </select>
        </div>
      )}
    </div>
  )
}

/* --------------------------------- مساعدات --------------------------------- */

const ALPHABET = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function generatePassword(length = 12): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length))
  return Array.from(bytes, (byte) => ALPHABET[byte % ALPHABET.length]).join('')
}

function describeRemaining(expiresAt: string): string {
  const diff = Date.parse(expiresAt) - Date.now()
  if (diff <= 0) return 'منتهية'
  const hours = Math.floor(diff / 3_600_000)
  if (hours < 1) return `باقي ${Math.max(1, Math.floor(diff / 60_000))} دقيقة`
  if (hours < 48) return `باقي ${hours} ساعة`
  return `باقي ${Math.floor(hours / 24)} يوم`
}

function StatusBadge({ member }: { member: TeamMember }) {
  if (member.role === 'owner') {
    return <span className="badge bg-stone-900 text-brand-300">المالك</span>
  }
  if (member.expired) return <span className="badge bg-red-100 text-red-700">منتهي</span>
  if (!member.expiresAt) return <span className="badge bg-emerald-100 text-emerald-800">دائم</span>
  return <span className="badge bg-amber-100 text-amber-800">مؤقت</span>
}

/* ----------------------------------- الصفحة --------------------------------- */

export default function AdminTeam() {
  const { data, loading, error, reload } = useApi<TeamResponse>('/api/admin/team')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState(() => generatePassword())
  const [duration, setDuration] = useState<Duration>(DEFAULT_DURATION)
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState('')
  const [created, setCreated] = useState<{ email: string; password: string } | null>(null)
  const [copied, setCopied] = useState(false)

  const [editing, setEditing] = useState('')
  const [editDuration, setEditDuration] = useState<Duration>(DEFAULT_DURATION)
  const [editPassword, setEditPassword] = useState('')
  const [busyEmail, setBusyEmail] = useState('')
  const [rowError, setRowError] = useState('')
  const [rowMessage, setRowMessage] = useState('')

  async function addMember(event: FormEvent) {
    event.preventDefault()
    if (adding) return
    setAddError('')
    setCreated(null)

    const hours = durationToHours(duration)
    if (hours === undefined) {
      setAddError('اكتب مدة صلاحية صحيحة')
      return
    }

    setAdding(true)
    try {
      const cleanEmail = email.trim().toLowerCase()
      await api.post('/api/admin/team', { email: cleanEmail, password, expiresInHours: hours })
      setCreated({ email: cleanEmail, password })
      setEmail('')
      setPassword(generatePassword())
      setDuration(DEFAULT_DURATION)
      reload()
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'حصل خطأ، حاول تاني')
    } finally {
      setAdding(false)
    }
  }

  async function copyCredentials() {
    if (!created) return
    try {
      await navigator.clipboard.writeText(`الإيميل: ${created.email}\nكلمة السر: ${created.password}`)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* ignore */
    }
  }

  function startEdit(member: TeamMember) {
    setEditing(member.email)
    setEditDuration(DEFAULT_DURATION)
    setEditPassword('')
    setRowError('')
    setRowMessage('')
  }

  async function saveEdit(member: TeamMember, changeDuration: boolean) {
    setRowError('')
    setRowMessage('')
    const body: { expiresInHours?: number | null; password?: string } = {}

    if (changeDuration) {
      const hours = durationToHours(editDuration)
      if (hours === undefined) {
        setRowError('اكتب مدة صلاحية صحيحة')
        return
      }
      body.expiresInHours = hours
    }
    if (editPassword.trim()) body.password = editPassword.trim()
    if (!changeDuration && !body.password) {
      setRowError('اكتب كلمة السر الجديدة الأول')
      return
    }

    setBusyEmail(member.email)
    try {
      await api.patch(`/api/admin/team/${encodeURIComponent(member.email)}`, body)
      setRowMessage(`تم تحديث ${member.email}`)
      setEditing('')
      setEditPassword('')
      reload()
    } catch (err) {
      setRowError(err instanceof Error ? err.message : 'حصل خطأ')
    } finally {
      setBusyEmail('')
    }
  }

  async function removeMember(member: TeamMember) {
    if (!window.confirm(`سحب صلاحية ${member.email} نهائيًا؟ هيتم تسجيل خروجه فورًا.`)) return
    setRowError('')
    setRowMessage('')
    setBusyEmail(member.email)
    try {
      await api.remove(`/api/admin/team/${encodeURIComponent(member.email)}`)
      setRowMessage(`تم سحب صلاحية ${member.email}`)
      reload()
    } catch (err) {
      setRowError(err instanceof Error ? err.message : 'حصل خطأ')
    } finally {
      setBusyEmail('')
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-extrabold">المسؤولين</h1>
        <p className="mt-1 text-sm text-stone-500">
          ضيف إيميلات تتحكم في لوحة التحكم لمدة محددة أو بدون حد، وتقدر تسحب الصلاحية في أي وقت.
        </p>
      </div>

      <form onSubmit={addMember} className="card space-y-4 p-6">
        <h2 className="flex items-center gap-2 text-lg font-extrabold">
          <Icon name="plus" className="h-5 w-5 text-brand-600" />
          إضافة مسؤول جديد
        </h2>

        {addError && <ErrorNote message={addError} />}

        {created && (
          <div className="space-y-2 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">
            <p className="font-extrabold">تمت الإضافة ✓ — ابعت البيانات دي للمسؤول (كلمة السر مش هتظهر تاني):</p>
            <p dir="ltr" className="break-all rounded-lg bg-white px-3 py-2 text-start font-mono text-xs text-stone-800">
              {created.email}
              <br />
              {created.password}
            </p>
            <button type="button" onClick={copyCredentials} className="btn-ghost !py-2">
              <Icon name="check" className="h-4 w-4" />
              {copied ? 'تم النسخ' : 'نسخ البيانات'}
            </button>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <label className="label" htmlFor="team-email">إيميل المسؤول</label>
            <input
              id="team-email"
              type="email"
              dir="ltr"
              className="input"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="name@gmail.com"
              required
            />
          </div>

          <div>
            <label className="label" htmlFor="team-password">كلمة السر المبدئية</label>
            <div className="flex gap-2">
              <input
                id="team-password"
                dir="ltr"
                className="input font-mono"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                minLength={8}
                required
              />
              <button
                type="button"
                className="btn-ghost shrink-0 !px-3"
                onClick={() => setPassword(generatePassword())}
                title="توليد كلمة سر جديدة"
                aria-label="توليد كلمة سر جديدة"
              >
                <Icon name="refresh" className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div>
            <label className="label" htmlFor="team-duration-preset">مدة الصلاحية</label>
            <DurationPicker value={duration} onChange={setDuration} idPrefix="team-duration" />
          </div>
        </div>

        <button type="submit" className="btn-primary" disabled={adding}>
          {adding ? <Spinner className="h-4 w-4" /> : <Icon name="users" className="h-4 w-4" />}
          إضافة المسؤول
        </button>
      </form>

      {rowError && <ErrorNote message={rowError} />}
      {rowMessage && <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">{rowMessage}</p>}

      {loading && !data ? (
        <PageLoader />
      ) : error ? (
        <ErrorNote message={error} onRetry={reload} />
      ) : !data || data.members.length === 0 ? (
        <EmptyState icon="users" title="مفيش مسؤولين لسه" />
      ) : (
        <div className="space-y-3">
          {data.members.map((member) => {
            const isOwner = member.role === 'owner'
            const busy = busyEmail === member.email
            return (
              <div key={member.email} className="card p-5">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-stone-100 text-stone-500">
                    <Icon name={isOwner ? 'lock' : 'mail'} className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-extrabold text-stone-900" dir="ltr">
                      {member.email}
                    </p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-stone-500">
                      {isOwner ? (
                        <span>صلاحية كاملة وغير قابلة للإلغاء</span>
                      ) : (
                        <span className="inline-flex items-center gap-1">
                          <Icon name="clock" className="h-3.5 w-3.5" />
                          {member.expiresAt
                            ? `تنتهي ${formatDate(member.expiresAt)} (${describeRemaining(member.expiresAt)})`
                            : 'بدون تاريخ انتهاء'}
                        </span>
                      )}
                      <span>آخر دخول: {member.lastLoginAt ? formatDate(member.lastLoginAt) : 'لم يدخل بعد'}</span>
                    </p>
                  </div>
                  <StatusBadge member={member} />

                  {!isOwner && (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="btn-ghost !py-2"
                        onClick={() => (editing === member.email ? setEditing('') : startEdit(member))}
                        disabled={busy}
                      >
                        <Icon name="edit" className="h-4 w-4" />
                        تعديل
                      </button>
                      <button type="button" className="btn-danger !py-2" onClick={() => removeMember(member)} disabled={busy}>
                        {busy ? <Spinner className="h-4 w-4" /> : <Icon name="trash" className="h-4 w-4" />}
                        سحب
                      </button>
                    </div>
                  )}
                </div>

                {editing === member.email && !isOwner && (
                  <div className="mt-4 grid gap-4 border-t border-stone-100 pt-4 md:grid-cols-2">
                    <div className="space-y-3">
                      <p className="label !mb-0">تحديد مدة جديدة (تبدأ من دلوقتي)</p>
                      <DurationPicker value={editDuration} onChange={setEditDuration} idPrefix={`edit-${member.email}`} />
                      <button type="button" className="btn-primary !py-2" onClick={() => saveEdit(member, true)} disabled={busy}>
                        <Icon name="check" className="h-4 w-4" />
                        حفظ المدة
                      </button>
                    </div>
                    <div className="space-y-3">
                      <p className="label !mb-0">إعادة تعيين كلمة السر</p>
                      <div className="flex gap-2">
                        <input
                          className="input font-mono"
                          dir="ltr"
                          value={editPassword}
                          onChange={(event) => setEditPassword(event.target.value)}
                          placeholder="8 خانات على الأقل"
                        />
                        <button
                          type="button"
                          className="btn-ghost shrink-0 !px-3"
                          onClick={() => setEditPassword(generatePassword())}
                          aria-label="توليد كلمة سر"
                        >
                          <Icon name="refresh" className="h-4 w-4" />
                        </button>
                      </div>
                      <button type="button" className="btn-accent !py-2" onClick={() => saveEdit(member, false)} disabled={busy}>
                        <Icon name="lock" className="h-4 w-4" />
                        حفظ كلمة السر
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
