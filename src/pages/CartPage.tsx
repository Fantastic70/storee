import { Link } from 'react-router-dom'
import { EmptyState, Icon, ProductThumb } from '../components/Bits'
import { useCart } from '../lib/cart'
import { useStore } from '../lib/store'
import { egp } from '../lib/format'

export default function CartPage() {
  const { items, subtotal, setQty, remove, count } = useCart()
  const { store } = useStore()
  const shipping = items.length > 0 ? store.shippingFee : 0
  const total = subtotal + shipping

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold sm:text-3xl">سلة التسوق</h1>
        <p className="mt-1 text-sm text-stone-500">
          {count > 0 ? `عندك ${count} قطعة في السلة` : 'سلتك فاضية لسه'}
        </p>
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon="cart"
          title="السلة فاضية"
          description="ابدأ بتصفح المنتجات واختار اللي يعجبك."
          action={
            <Link to="/products" className="btn-primary">
              تسوّق الآن
            </Link>
          }
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          <div className="space-y-3">
            {items.map((item) => (
              <div key={item.productId} className="card flex items-center gap-4 p-4">
                <Link to={`/product/${item.productId}`} className="h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-stone-200">
                  <ProductThumb
                    product={{ name: item.name, category: '', image: item.image }}
                    className="h-full w-full"
                  />
                </Link>

                <div className="min-w-0 flex-1">
                  <Link to={`/product/${item.productId}`} className="block truncate font-extrabold hover:text-brand-700">
                    {item.name}
                  </Link>
                  <p className="mt-0.5 text-sm font-bold text-stone-500">{egp(item.price)}</p>
                  {item.qty >= item.stock && (
                    <p className="mt-1 text-xs font-bold text-amber-700">وصلت لأقصى كمية متوفرة</p>
                  )}
                </div>

                <div className="flex flex-col items-end gap-2">
                  <div className="flex items-center rounded-lg border border-stone-300">
                    <button
                      type="button"
                      onClick={() => setQty(item.productId, item.qty - 1)}
                      className="grid h-9 w-9 place-items-center text-stone-600"
                      aria-label="تقليل"
                    >
                      <Icon name="minus" className="h-3.5 w-3.5" />
                    </button>
                    <span className="w-8 text-center text-sm font-extrabold">{item.qty}</span>
                    <button
                      type="button"
                      onClick={() => setQty(item.productId, item.qty + 1)}
                      disabled={item.qty >= item.stock}
                      className="grid h-9 w-9 place-items-center text-stone-600 disabled:opacity-30"
                      aria-label="زيادة"
                    >
                      <Icon name="plus" className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-extrabold">{egp(item.price * item.qty)}</span>
                    <button
                      type="button"
                      onClick={() => remove(item.productId)}
                      className="text-stone-400 transition hover:text-red-600"
                      aria-label="حذف من السلة"
                    >
                      <Icon name="trash" className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}

            <Link to="/products" className="inline-flex items-center gap-2 text-sm font-bold text-stone-600 hover:text-stone-950">
              <Icon name="arrowLeft" className="h-4 w-4" />
              كمّل تسوّق
            </Link>
          </div>

          <aside className="card h-fit space-y-4 p-5">
            <h2 className="text-base font-extrabold">ملخّص الطلب</h2>

            <dl className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <dt className="text-stone-500">الإجمالي الفرعي</dt>
                <dd className="font-bold">{egp(subtotal)}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-stone-500">الشحن</dt>
                <dd className="font-bold">{shipping > 0 ? egp(shipping) : 'مجاني'}</dd>
              </div>
              <div className="border-t border-dashed border-stone-300 pt-3">
                <div className="flex items-center justify-between text-base">
                  <dt className="font-extrabold">الإجمالي</dt>
                  <dd className="font-extrabold text-stone-950">{egp(total)}</dd>
                </div>
              </div>
            </dl>

            <div className="flex items-start gap-2 rounded-xl bg-brand-50 p-3 text-xs leading-6 text-stone-700">
              <Icon name="wallet" className="mt-0.5 h-4 w-4 shrink-0 text-brand-700" />
              الدفع يتم بتحويل المبلغ على رقم فودافون كاش اللي هيبان لك في صفحة تأكيد الطلب.
            </div>

            <Link to="/checkout" className="btn-accent w-full">
              إتمام الطلب
            </Link>
            <Link to="/products" className="btn-ghost w-full">
              مواصلة التسوق
            </Link>
          </aside>
        </div>
      )}
    </div>
  )
}
