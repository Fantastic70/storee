import { useMemo, useState, type FormEvent } from 'react'
import { EmptyState, ErrorNote, Icon, PageLoader, ProductThumb, Spinner } from '../../components/Bits'
import type { Product } from '../../lib/api'
import { api, uploadImage } from '../../lib/api'
import { egp } from '../../lib/format'
import { useApi } from '../../lib/useApi'

type ProductsResponse = { products: Product[] }

type FormState = {
  id: string | null
  name: string
  description: string
  category: string
  price: string
  comparePrice: string
  stock: string
  vodafoneNumber: string
  imageKey: string
  imageUrl: string | null
  featured: boolean
  active: boolean
}

const EMPTY_FORM: FormState = {
  id: null,
  name: '',
  description: '',
  category: '',
  price: '',
  comparePrice: '',
  stock: '10',
  vodafoneNumber: '',
  imageKey: '',
  imageUrl: null,
  featured: false,
  active: true,
}

export default function AdminProducts() {
  const { data, loading, error, reload } = useApi<ProductsResponse>('/api/admin/products')
  const [form, setForm] = useState<FormState | null>(null)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [formError, setFormError] = useState('')
  const [query, setQuery] = useState('')

  const products = useMemo(() => {
    const list = data?.products ?? []
    const needle = query.trim()
    return needle ? list.filter((item) => `${item.name} ${item.category}`.includes(needle)) : list
  }, [data, query])

  const categories = useMemo(() => [...new Set((data?.products ?? []).map((item) => item.category).filter(Boolean))], [data])

  function openCreate() {
    setFormError('')
    setForm({ ...EMPTY_FORM })
  }

  function openEdit(product: Product) {
    setFormError('')
    setForm({
      id: product.id,
      name: product.name,
      description: product.description,
      category: product.category,
      price: String(product.price),
      comparePrice: product.comparePrice ? String(product.comparePrice) : '',
      stock: String(product.stock),
      vodafoneNumber: product.vodafoneNumber || '',
      imageKey: product.image ? (product.image.split('/').pop() ?? '') : '',
      imageUrl: product.image,
      featured: product.featured,
      active: product.active,
    })
  }

  async function handleImage(file: File | undefined) {
    if (!file || !form) return
    setFormError('')
    setUploading(true)
    try {
      const result = await uploadImage(file)
      setForm((current) => (current ? { ...current, imageKey: result.key, imageUrl: result.url } : current))
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'فشل رفع الصورة')
    } finally {
      setUploading(false)
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!form || saving) return
    setSaving(true)
    setFormError('')

    const payload = {
      name: form.name,
      description: form.description,
      category: form.category,
      price: Number(form.price || 0),
      comparePrice: Number(form.comparePrice || 0),
      stock: Number(form.stock || 0),
      vodafoneNumber: form.vodafoneNumber,
      imageKey: form.imageKey,
      featured: form.featured,
      active: form.active,
    }

    try {
      if (form.id) await api.put(`/api/admin/products/${form.id}`, payload)
      else await api.post('/api/admin/products', payload)
      setForm(null)
      reload()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'فشل حفظ المنتج')
    } finally {
      setSaving(false)
    }
  }

  async function remove(product: Product) {
    if (!window.confirm(`متأكد إنك عايز تحذف «${product.name}»؟`)) return
    try {
      await api.remove(`/api/admin/products/${product.id}`)
      reload()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'فشل الحذف')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">المنتجات</h1>
          <p className="mt-1 text-sm text-stone-500">
            {data ? `${data.products.length} منتج في المتجر` : '…'}
          </p>
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <Icon name="search" className="pointer-events-none absolute inset-y-0 end-3 my-auto h-4 w-4 text-stone-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="ابحث بالاسم أو القسم"
              className="input ps-4 pe-10 sm:w-64"
              aria-label="بحث في المنتجات"
            />
          </div>
          <button type="button" onClick={openCreate} className="btn-primary">
            <Icon name="plus" className="h-4 w-4" />
            إضافة منتج
          </button>
        </div>
      </div>

      {loading && <PageLoader />}
      {error && <ErrorNote message={error} onRetry={reload} />}

      {!loading && !error && products.length === 0 && (
        <EmptyState
          icon="bag"
          title={query ? 'مفيش نتائج' : 'مفيش منتجات لسه'}
          description={query ? 'جرّب كلمة تانية.' : 'أضف أول منتج للمتجر وحدّد رقم فودافون كاش الخاص بيه.'}
          action={
            !query ? (
              <button type="button" onClick={openCreate} className="btn-primary">
                <Icon name="plus" className="h-4 w-4" />
                إضافة منتج
              </button>
            ) : undefined
          }
        />
      )}

      {products.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {products.map((product) => (
            <article key={product.id} className="card overflow-hidden">
              <div className="flex gap-3 p-4">
                <span className="h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-stone-200">
                  <ProductThumb product={product} className="h-full w-full" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="truncate font-extrabold">{product.name}</h3>
                    {!product.active && <span className="badge bg-stone-200 text-stone-600">مخفي</span>}
                  </div>
                  <p className="mt-0.5 text-xs text-stone-500">{product.category || 'بدون قسم'}</p>
                  <p className="mt-1 text-lg font-extrabold">{egp(product.price)}</p>
                </div>
              </div>

              <dl className="space-y-1 border-t border-stone-100 px-4 py-3 text-xs">
                <div className="flex justify-between">
                  <dt className="text-stone-400">المخزون</dt>
                  <dd className={`font-bold ${product.stock <= 3 ? 'text-red-600' : 'text-stone-700'}`}>{product.stock}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-stone-400">رقم فودافون كاش</dt>
                  <dd className="font-bold text-stone-700" dir="ltr">
                    {product.vodafoneNumber || '—'}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-stone-400">مميز</dt>
                  <dd className="font-bold text-stone-700">{product.featured ? 'نعم' : 'لا'}</dd>
                </div>
              </dl>

              <div className="flex gap-2 border-t border-stone-100 p-3">
                <button type="button" onClick={() => openEdit(product)} className="btn-ghost flex-1 !py-2">
                  <Icon name="edit" className="h-4 w-4" />
                  تعديل
                </button>
                <button type="button" onClick={() => remove(product)} className="btn-danger !py-2">
                  <Icon name="trash" className="h-4 w-4" />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {form && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-stone-950/60 p-4 backdrop-blur-sm">
          <form onSubmit={submit} className="my-6 w-full max-w-2xl space-y-4 rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-extrabold">{form.id ? 'تعديل منتج' : 'إضافة منتج جديد'}</h2>
              <button
                type="button"
                onClick={() => setForm(null)}
                className="grid h-9 w-9 place-items-center rounded-xl border border-stone-200 text-stone-500 hover:bg-stone-100"
                aria-label="إغلاق"
              >
                <Icon name="x" className="h-4 w-4" />
              </button>
            </div>

            {formError && <ErrorNote message={formError} />}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="label" htmlFor="p-name">اسم المنتج *</label>
                <input id="p-name" className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </div>

              <div>
                <label className="label" htmlFor="p-category">القسم</label>
                <input
                  id="p-category"
                  className="input"
                  list="category-list"
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  placeholder="مثال: شنط / ملابس"
                />
                <datalist id="category-list">
                  {categories.map((category) => (
                    <option key={category} value={category} />
                  ))}
                </datalist>
              </div>

              <div>
                <label className="label" htmlFor="p-stock">الكمية المتوفرة</label>
                <input
                  id="p-stock"
                  className="input"
                  dir="ltr"
                  inputMode="numeric"
                  value={form.stock}
                  onChange={(e) => setForm({ ...form, stock: e.target.value.replace(/[^0-9]/g, '') })}
                />
              </div>

              <div>
                <label className="label" htmlFor="p-price">السعر (ج.م) *</label>
                <input
                  id="p-price"
                  className="input"
                  dir="ltr"
                  inputMode="numeric"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value.replace(/[^0-9]/g, '') })}
                  required
                />
              </div>

              <div>
                <label className="label" htmlFor="p-compare">السعر قبل الخصم (اختياري)</label>
                <input
                  id="p-compare"
                  className="input"
                  dir="ltr"
                  inputMode="numeric"
                  value={form.comparePrice}
                  onChange={(e) => setForm({ ...form, comparePrice: e.target.value.replace(/[^0-9]/g, '') })}
                  placeholder="0"
                />
              </div>

              <div className="sm:col-span-2 border border-brand-200 bg-brand-50/60 rounded-2xl p-4">
                <label className="label" htmlFor="p-vodafone">رقم فودافون كاش لاستلام الدفع</label>
                <input
                  id="p-vodafone"
                  className="input"
                  dir="ltr"
                  inputMode="numeric"
                  value={form.vodafoneNumber}
                  onChange={(e) => setForm({ ...form, vodafoneNumber: e.target.value.replace(/[^0-9]/g, '').slice(0, 11) })}
                  placeholder="01012345678"
                />
                <p className="mt-1.5 text-xs leading-5 text-stone-600">
                  الرقم ده هيظهر للعميل في صفحة الطلب عشان يحوّل عليه المبلغ. لو فاضل، الطلب هيتحط «منتظر تأكيد الدفع» لحد ما تأكّده.
                </p>
              </div>

              <div className="sm:col-span-2">
                <label className="label" htmlFor="p-description">وصف المنتج</label>
                <textarea
                  id="p-description"
                  className="input min-h-28 resize-y"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="الخامة، المقاسات، الألوان المتوفرة…"
                />
              </div>

              <div className="sm:col-span-2">
                <span className="label">صورة المنتج</span>
                <div className="flex items-center gap-4">
                  <span className="h-24 w-24 shrink-0 overflow-hidden rounded-2xl border border-stone-200 bg-stone-100">
                    {form.imageUrl ? (
                      <img src={form.imageUrl} alt="معاينة" className="h-full w-full object-cover" />
                    ) : (
                      <span className="grid h-full w-full place-items-center text-stone-300">
                        <Icon name="image" className="h-8 w-8" />
                      </span>
                    )}
                  </span>

                  <div className="flex flex-wrap gap-2">
                    <label className="btn-ghost cursor-pointer">
                      {uploading ? <Spinner className="h-4 w-4" /> : <Icon name="image" className="h-4 w-4" />}
                      {form.imageUrl ? 'تغيير الصورة' : 'رفع صورة'}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(event) => void handleImage(event.target.files?.[0])}
                        disabled={uploading}
                      />
                    </label>
                    {form.imageUrl && (
                      <button
                        type="button"
                        className="btn-danger !py-2"
                        onClick={() => setForm({ ...form, imageKey: '', imageUrl: null })}
                      >
                        إزالة الصورة
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm font-bold text-stone-700">
                <input
                  type="checkbox"
                  checked={form.featured}
                  onChange={(e) => setForm({ ...form, featured: e.target.checked })}
                  className="h-4 w-4 accent-amber-500"
                />
                منتج مميز (يظهر في الأعلى)
              </label>

              <label className="flex items-center gap-2 text-sm font-bold text-stone-700">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) => setForm({ ...form, active: e.target.checked })}
                  className="h-4 w-4 accent-amber-500"
                />
                ظاهر للعملاء
              </label>
            </div>

            <div className="flex gap-2 border-t border-stone-200 pt-4">
              <button type="submit" className="btn-primary flex-1" disabled={saving || uploading}>
                {saving ? <Spinner className="h-4 w-4" /> : <Icon name="check" className="h-4 w-4" />}
                {form.id ? 'حفظ التعديلات' : 'إضافة المنتج'}
              </button>
              <button type="button" onClick={() => setForm(null)} className="btn-ghost">
                إلغاء
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
