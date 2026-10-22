import { Link } from 'react-router-dom'
import ProductCard from '../components/ProductCard'
import { EmptyState, Icon, PageLoader, ErrorNote } from '../components/Bits'
import type { Product } from '../lib/api'
import { useApi } from '../lib/useApi'

type ProductsResponse = { products: Product[] }
type CategoriesResponse = { categories: { name: string; count: number }[] }

const FEATURES = [
  {
    icon: 'wallet',
    title: 'دفع بفودافون كاش',
    text: 'حوّل المبلغ على رقم فودافون كاش الخاص بالمنتج وأكّد الطلب برقم العملية.',
  },
  {
    icon: 'truck',
    title: 'توصيل لكل مصر',
    text: 'طلبك يوصلك لحد باب البيت وتشوف حالته أول بأول.',
  },
  {
    icon: 'lock',
    title: 'ضمان الجودة',
    text: 'منتجات مختارة بعناية وتم فحصها قبل الشحن.',
  },
]

export default function Home() {
  const { data, loading, error, reload } = useApi<ProductsResponse>('/api/products')
  const { data: categoriesData } = useApi<CategoriesResponse>('/api/categories')

  const products = data?.products ?? []
  const featured = products.filter((product) => product.featured)
  const categories = categoriesData?.categories ?? []

  return (
    <div>
      {/* ---------------------------------- hero --------------------------------- */}
      <section className="relative overflow-hidden bg-stone-950">
        <div className="pointer-events-none absolute -top-24 start-0 h-72 w-72 rounded-full bg-brand-500/20 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 end-0 h-80 w-80 rounded-full bg-brand-700/20 blur-3xl" />

        <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-14 lg:grid-cols-2 lg:py-20">
          <div className="space-y-6">
            <span className="inline-flex items-center gap-2 rounded-full border border-brand-500/40 bg-brand-500/10 px-4 py-1.5 text-xs font-bold text-brand-300">
              <Icon name="star" className="h-3.5 w-3.5" />
              جديدنا كل أسبوع
            </span>
            <h1 className="text-3xl font-extrabold leading-tight text-white sm:text-5xl">
              شنط وملابس <span className="text-brand-400">مختارة بعناية</span> لأناقتك
            </h1>
            <p className="max-w-lg text-sm leading-7 text-stone-300 sm:text-base">
              تسوّق من غير تعقيد: اختار منتجك، حوّل المبلغ عبر فودافون كاش، وتابع طلبك لحد ما يوصل لحد باب البيت.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link to="/products" className="btn-accent">
                تسوّق دلوقتي
                <Icon name="chevronLeft" className="h-4 w-4" />
              </Link>
              <Link to="/track" className="btn-ghost !border-stone-700 !bg-transparent !text-stone-200 hover:!bg-stone-900">
                تتبّع طلبك
              </Link>
            </div>

            <div className="flex flex-wrap gap-6 pt-2 text-stone-400">
              <div>
                <p className="text-xl font-extrabold text-white">{products.length}+</p>
                <p className="text-xs">منتج متاح</p>
              </div>
              <div>
                <p className="text-xl font-extrabold text-white">{categories.length}+</p>
                <p className="text-xs">قسم</p>
              </div>
              <div>
                <p className="text-xl font-extrabold text-white">24 ساعة</p>
                <p className="text-xs">تجهيز الطلبات</p>
              </div>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-md">
            <div className="rounded-[28px] bg-gradient-to-br from-brand-400 to-brand-600 p-6 text-stone-950 shadow-2xl shadow-brand-900/40">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-bold opacity-70">ادفع بأمان عبر</p>
                  <p className="text-2xl font-extrabold">فودافون كاش</p>
                </div>
                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-stone-950/90 text-brand-300">
                  <Icon name="wallet" className="h-6 w-6" />
                </span>
              </div>
              <div className="mt-8 space-y-2 rounded-2xl bg-stone-950/10 p-4 text-sm font-bold">
                <p className="flex items-center justify-between">
                  <span className="opacity-70">خطوة 1</span>
                  <span>اختر منتجاتك</span>
                </p>
                <p className="flex items-center justify-between">
                  <span className="opacity-70">خطوة 2</span>
                  <span>حوّل المبلغ على الرقم</span>
                </p>
                <p className="flex items-center justify-between">
                  <span className="opacity-70">خطوة 3</span>
                  <span>أكّد برقم العملية وتابع الطلب</span>
                </p>
              </div>
              <p className="mt-4 text-xs font-bold opacity-70">حالة الدفع بتظهر واضحة: تم الدفع أو منتظر التأكيد.</p>
            </div>
          </div>
        </div>
      </section>

      {/* -------------------------------- features ------------------------------- */}
      <section className="mx-auto -mt-8 max-w-7xl px-4">
        <div className="grid gap-4 sm:grid-cols-3">
          {FEATURES.map((feature) => (
            <div key={feature.title} className="card flex items-start gap-3 p-5">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-stone-950 text-brand-400">
                <Icon name={feature.icon} className="h-5 w-5" />
              </span>
              <div>
                <h3 className="text-sm font-extrabold">{feature.title}</h3>
                <p className="mt-1 text-xs leading-6 text-stone-500">{feature.text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ------------------------------- categories ------------------------------ */}
      {categories.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 pt-14">
          <div className="mb-5 flex items-end justify-between">
            <h2 className="text-xl font-extrabold sm:text-2xl">الأقسام</h2>
            <Link to="/products" className="text-sm font-bold text-brand-700 hover:text-brand-800">
              عرض الكل
            </Link>
          </div>
          <div className="flex flex-wrap gap-3">
            {categories.map((category) => (
              <Link
                key={category.name}
                to={`/products?category=${encodeURIComponent(category.name)}`}
                className="card px-5 py-3 text-sm font-bold transition hover:border-stone-900 hover:bg-stone-950 hover:text-white"
              >
                {category.name}
                <span className="ms-2 text-xs font-medium text-stone-400">({category.count})</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* -------------------------------- products ------------------------------- */}
      <section className="mx-auto max-w-7xl space-y-10 px-4 pt-12">
        {loading && <PageLoader />}

        {!loading && error && <ErrorNote message={error} onRetry={reload} />}

        {!loading && !error && products.length === 0 && (
          <EmptyState
            icon="bag"
            title="المتجر لسه بيتجهّز"
            description="مفيش منتجات متاحة دلوقتي. أول ما المسؤول يضيف منتجات هتظهر هنا."
            action={
              <Link to="/admin" className="btn-primary">
                ادخل لوحة التحكم
              </Link>
            }
          />
        )}

        {!loading && !error && featured.length > 0 && (
          <div>
            <div className="mb-5 flex items-end justify-between">
              <div>
                <h2 className="text-xl font-extrabold sm:text-2xl">منتجات مميزة</h2>
                <p className="mt-1 text-sm text-stone-500">اختيارات مميزة من المسؤول</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              {featured.slice(0, 4).map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </div>
        )}

        {!loading && !error && products.length > 0 && (
          <div>
            <div className="mb-5 flex items-end justify-between">
              <h2 className="text-xl font-extrabold sm:text-2xl">أحدث المنتجات</h2>
              <Link to="/products" className="text-sm font-bold text-brand-700 hover:text-brand-800">
                عرض الكل
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              {products.slice(0, 8).map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </div>
        )}
      </section>

      {/* --------------------------------- cta ---------------------------------- */}
      <section className="mx-auto mt-16 max-w-7xl px-4">
        <div className="card flex flex-col items-center gap-4 bg-stone-950 p-8 text-center sm:flex-row sm:justify-between sm:text-start">
          <div>
            <h3 className="text-lg font-extrabold text-white sm:text-xl">طلبك عندك أونلاين؟</h3>
            <p className="mt-1 text-sm text-stone-400">اكتب رقم موبايلك وشوف حالة الطلب والدفع فورًا.</p>
          </div>
          <Link to="/track" className="btn-accent shrink-0">
            تتبّع طلبي
          </Link>
        </div>
      </section>
    </div>
  )
}
