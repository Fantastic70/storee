import { Link } from 'react-router-dom'
import type { Product } from '../lib/api'
import { egp } from '../lib/format'
import { useCart } from '../lib/cart'
import { Icon, ProductThumb } from './Bits'

export default function ProductCard({ product }: { product: Product }) {
  const { add } = useCart()
  const discount =
    product.comparePrice > product.price && product.comparePrice > 0
      ? Math.round(((product.comparePrice - product.price) / product.comparePrice) * 100)
      : 0
  const out = product.stock <= 0

  return (
    <article className="group card overflow-hidden transition hover:-translate-y-0.5 hover:shadow-lg">
      <Link to={`/product/${product.id}`} className="relative block aspect-[4/5] overflow-hidden bg-stone-100">
        <ProductThumb product={product} className="h-full w-full transition duration-500 group-hover:scale-105" />
        {discount > 0 && (
          <span className="absolute top-3 start-3 rounded-full bg-red-600 px-2.5 py-1 text-[11px] font-extrabold text-white">
            خصم {discount}%
          </span>
        )}
        {product.featured && (
          <span className="absolute top-3 end-3 rounded-full bg-brand-400 px-2.5 py-1 text-[11px] font-extrabold text-stone-950">
            مميز
          </span>
        )}
        {out && (
          <span className="absolute inset-x-0 bottom-0 bg-stone-950/80 py-2 text-center text-xs font-bold text-white">
            نفد المخزون
          </span>
        )}
      </Link>

      <div className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase text-stone-400">{product.category || 'عام'}</p>
            <h3 className="truncate text-base font-extrabold leading-6">
              <Link to={`/product/${product.id}`} className="hover:text-brand-700">
                {product.name}
              </Link>
            </h3>
          </div>
        </div>

        <div className="flex items-end justify-between gap-2">
          <div>
            <p className="text-lg font-extrabold text-stone-950">{egp(product.price)}</p>
            {discount > 0 && <p className="text-xs text-stone-400 line-through">{egp(product.comparePrice)}</p>}
          </div>
          <button
            type="button"
            disabled={out}
            onClick={() =>
              add({
                productId: product.id,
                name: product.name,
                price: product.price,
                image: product.image,
                stock: product.stock,
              })
            }
            className="btn-primary h-10 w-10 !px-0"
            aria-label={`أضف ${product.name} للسلة`}
            title="أضف للسلة"
          >
            <Icon name="plus" className="h-5 w-5" />
          </button>
        </div>
      </div>
    </article>
  )
}
