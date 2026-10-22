import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ErrorNote, EmptyState, Icon, PageLoader } from '../components/Bits'
import ProductCard from '../components/ProductCard'
import type { Product } from '../lib/api'
import { useApi } from '../lib/useApi'

type ProductsResponse = { products: Product[] }
type CategoriesResponse = { categories: { name: string; count: number }[] }

type SortKey = 'newest' | 'price-asc' | 'price-desc'

const SORTS: { key: SortKey; label: string }[] = [
  { key: 'newest', label: 'الأحدث' },
  { key: 'price-asc', label: 'السعر: من الأقل' },
  { key: 'price-desc', label: 'السعر: من الأعلى' },
]

export default function ProductsPage() {
  const [params, setParams] = useSearchParams()
  const category = params.get('category') || ''
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<SortKey>('newest')

  const path = useMemo(() => {
    const search = new URLSearchParams()
    if (category) search.set('category', category)
    return `/api/products${search.toString() ? `?${search.toString()}` : ''}`
  }, [category])

  const { data, loading, error, reload } = useApi<ProductsResponse>(path)
  const { data: categoriesData } = useApi<CategoriesResponse>('/api/categories')

  const categories = categoriesData?.categories ?? []

  const products = useMemo(() => {
    const list = [...(data?.products ?? [])]
    const needle = query.trim()
    const filtered = needle ? list.filter((item) => `${item.name} ${item.description}`.includes(needle)) : list
    if (sort === 'price-asc') filtered.sort((a, b) => a.price - b.price)
    if (sort === 'price-desc') filtered.sort((a, b) => b.price - a.price)
    return filtered
  }, [data, query, sort])

  function pickCategory(name: string) {
    const next = new URLSearchParams(params)
    if (name) next.set('category', name)
    else next.delete('category')
    setParams(next, { replace: true })
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <div className="mb-6">
        <nav className="mb-2 flex items-center gap-1.5 text-xs font-bold text-stone-400">
          <Link to="/" className="hover:text-stone-700">
            الرئيسية
          </Link>
          <span>/</span>
          <span className="text-stone-700">كل المنتجات</span>
        </nav>
        <h1 className="text-2xl font-extrabold sm:text-3xl">{category || 'كل المنتجات'}</h1>
        <p className="mt-1 text-sm text-stone-500">اختار من تشكيلتنا وادفع بفودافون كاش بسهولة.</p>
      </div>

      <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => pickCategory('')}
            className={`rounded-full px-4 py-2 text-sm font-bold transition ${
              !category ? 'bg-stone-950 text-white' : 'border border-stone-300 bg-white text-stone-600 hover:border-stone-900'
            }`}
          >
            الكل
          </button>
          {categories.map((item) => (
            <button
              key={item.name}
              type="button"
              onClick={() => pickCategory(item.name)}
              className={`rounded-full px-4 py-2 text-sm font-bold transition ${
                category === item.name
                  ? 'bg-stone-950 text-white'
                  : 'border border-stone-300 bg-white text-stone-600 hover:border-stone-900'
              }`}
            >
              {item.name}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <div className="relative flex-1 lg:w-64">
            <Icon name="search" className="pointer-events-none absolute inset-y-0 end-3 my-auto h-4 w-4 text-stone-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="ابحث عن منتج…"
              className="input pe-10"
              aria-label="بحث"
            />
          </div>
          <select value={sort} onChange={(event) => setSort(event.target.value as SortKey)} className="input !w-auto" aria-label="ترتيب">
            {SORTS.map((item) => (
              <option key={item.key} value={item.key}>
                {item.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading && <PageLoader />}
      {!loading && error && <ErrorNote message={error} onRetry={reload} />}
      {!loading && !error && products.length === 0 && (
        <EmptyState
          title="مفيش منتجات هنا"
          description="جرّب قسم تاني أو ابحث بكلمة مختلفة."
          action={
            <button type="button" onClick={() => pickCategory('')} className="btn-ghost">
              عرض كل المنتجات
            </button>
          }
        />
      )}

      {!loading && !error && products.length > 0 && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  )
}
