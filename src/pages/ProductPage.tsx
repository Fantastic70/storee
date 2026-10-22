import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ErrorNote, Icon, PageLoader, ProductThumb } from '../components/Bits'
import ProductCard from '../components/ProductCard'
import { useCart } from '../lib/cart'
import type { Product } from '../lib/api'
import { egp } from '../lib/format'
import { useApi } from '../lib/useApi'

type ProductResponse = { product: Product }
type ProductsResponse = { products: Product[] }

export default function ProductPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { add, count } = useCart()
  const [qty, setQty] = useState(1)
  const [added, setAdded] = useState(false)

  const { data, loading, error, reload } = useApi<ProductResponse>(id ? `/api/products/${encodeURIComponent(id)}` : null)
  const { data: relatedData } = useApi<ProductsResponse>('/api/products')

  const product = data?.product ?? null

  useEffect(() => {
    setQty(1)
    setAdded(false)
  }, [id])

  useEffect(() => {
    if (!added) return
    const timer = setTimeout(() => setAdded(false), 2500)
    return () => clearTimeout(timer)
  }, [added])

  if (loading) return <div className="mx-auto max-w-7xl px-4 py-10"><PageLoader /></div>

  if (error || !product) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 px-4 py-16">
        <ErrorNote message={error || 'المنتج غير موجود'} onRetry={reload} />
        <Link to="/products" className="btn-ghost mx-auto flex w-fit">
          رجوع لكل المنتجات
        </Link>
      </div>
    )
  }

  const related = (relatedData?.products ?? [])
    .filter((item) => item.id !== product.id && (item.category === product.category || item.featured))
    .slice(0, 4)

  const discount =
    product.comparePrice > product.price && product.comparePrice > 0
      ? Math.round(((product.comparePrice - product.price) / product.comparePrice) * 100)
      : 0
  const out = product.stock <= 0
  const low = !out && product.stock <= 3

  function addToCart(openCart: boolean) {
    if (out) return
    add(
      {
        productId: product!.id,
        name: product!.name,
        price: product!.price,
        image: product!.image,
        stock: product!.stock,
      },
      qty,
    )
    setAdded(true)
    if (openCart) navigate('/cart')
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <nav className="mb-6 flex items-center gap-1.5 text-xs font-bold text-stone-400">
        <Link to="/" className="hover:text-stone-700">
          الرئيسية
        </Link>
        <span>/</span>
        <Link to="/products" className="hover:text-stone-700">
          المنتجات
        </Link>
        <span>/</span>
        <span className="text-stone-700">{product.name}</span>
      </nav>

      <div className="grid gap-8 lg:grid-cols-2">
        <div className="relative overflow-hidden rounded-3xl border border-stone-200 bg-stone-100">
          <ProductThumb product={product} className="aspect-[4/5] w-full" />
          {discount > 0 && (
            <span className="absolute top-4 start-4 rounded-full bg-red-600 px-3 py-1.5 text-xs font-extrabold text-white">
              خصم {discount}%
            </span>
          )}
        </div>

        <div className="space-y-6">
          <div>
            <p className="text-xs font-bold uppercase text-stone-400">{product.category || 'عام'}</p>
            <h1 className="mt-1 text-2xl font-extrabold leading-9 sm:text-3xl">{product.name}</h1>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <span className="text-3xl font-extrabold text-stone-950">{egp(product.price)}</span>
              {discount > 0 && <span className="text-lg text-stone-400 line-through">{egp(product.comparePrice)}</span>}
              <span className={`badge ${out ? 'bg-red-100 text-red-700' : low ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
                {out ? 'نفد المخزون' : low ? `آخر ${product.stock} قطع` : `متوفر (${product.stock})`}
              </span>
            </div>
          </div>

          {product.description && (
            <div className="card p-5">
              <h2 className="mb-2 text-sm font-extrabold">الوصف</h2>
              <p className="whitespace-pre-line text-sm leading-7 text-stone-600">{product.description}</p>
            </div>
          )}

          <div className="card space-y-4 border-brand-200 bg-brand-50/50 p-5">
            <div className="flex items-center gap-2 text-stone-900">
              <Icon name="wallet" className="h-5 w-5 text-brand-700" />
              <h2 className="text-sm font-extrabold">الدفع عبر فودافون كاش</h2>
            </div>
            <ul className="space-y-1.5 text-xs leading-6 text-stone-600">
              <li>• أضف المنتج للسلة وأكمل بياناتك.</li>
              <li>• حوّل قيمة الطلب على رقم فودافون كاش اللي هيظهر لك.</li>
              <li>• اكتب رقم العملية عشان نأكّد دفعتك بسرعة.</li>
            </ul>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center rounded-xl border border-stone-300 bg-white">
              <button
                type="button"
                onClick={() => setQty((value) => Math.max(1, value - 1))}
                disabled={qty <= 1 || out}
                className="grid h-12 w-12 place-items-center text-stone-600 disabled:opacity-40"
                aria-label="تقليل الكمية"
              >
                <Icon name="minus" className="h-4 w-4" />
              </button>
              <span className="w-10 text-center text-sm font-extrabold">{qty}</span>
              <button
                type="button"
                onClick={() => setQty((value) => Math.min(product.stock, value + 1))}
                disabled={out || qty >= product.stock}
                className="grid h-12 w-12 place-items-center text-stone-600 disabled:opacity-40"
                aria-label="زيادة الكمية"
              >
                <Icon name="plus" className="h-4 w-4" />
              </button>
            </div>

            <button type="button" onClick={() => addToCart(false)} disabled={out} className="btn-primary flex-1">
              <Icon name="cart" className="h-4.5 w-4.5" />
              {added ? 'تمت الإضافة ✓' : 'أضف للسلة'}
            </button>

            <button type="button" onClick={() => addToCart(true)} disabled={out} className="btn-accent flex-1">
             اشترِ الآن
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {[
              { icon: 'truck', label: 'توصيل لكل المحافظات' },
              { icon: 'check', label: 'تأكيد الدفع من المتجر' },
              { icon: 'lock', label: 'بياناتك محفوظة' },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-2 rounded-xl border border-stone-200 bg-white p-3 text-xs font-bold text-stone-600">
                <Icon name={item.icon} className="h-4 w-4 text-brand-600" />
                {item.label}
              </div>
            ))}
          </div>
        </div>
      </div>

      {related.length > 0 && (
        <section className="mt-14">
          <h2 className="mb-5 text-xl font-extrabold">منتجات ليها علاقة</h2>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {related.map((item) => (
              <ProductCard key={item.id} product={item} />
            ))}
          </div>
        </section>
      )}

      <div className="mt-10 flex items-center justify-between rounded-2xl border border-stone-200 bg-white p-4 text-sm">
        <span className="text-stone-500">حاجات في السلة؟</span>
        <Link to="/cart" className="font-extrabold text-brand-700 hover:text-brand-800">
          راجع السلة ({count})
        </Link>
      </div>
    </div>
  )
}
