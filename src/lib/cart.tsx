import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

export type CartItem = {
  productId: string
  name: string
  price: number
  image: string | null
  stock: number
  qty: number
}

type CartContextValue = {
  items: CartItem[]
  count: number
  subtotal: number
  add: (item: Omit<CartItem, 'qty'>, qty?: number) => void
  setQty: (productId: string, qty: number) => void
  remove: (productId: string) => void
  clear: () => void
}

const STORAGE_KEY = 'store_cart_v1'
const CartContext = createContext<CartContextValue | null>(null)

function readStored(): CartItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (item): item is CartItem =>
        !!item && typeof item.productId === 'string' && typeof item.price === 'number' && typeof item.qty === 'number',
    )
  } catch {
    return []
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(() => readStored())

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
    } catch {
      /* ignore quota errors */
    }
  }, [items])

  const add = useCallback((item: Omit<CartItem, 'qty'>, qty = 1) => {
    setItems((current) => {
      const existing = current.find((entry) => entry.productId === item.productId)
      if (existing) {
        return current.map((entry) =>
          entry.productId === item.productId
            ? { ...entry, qty: Math.min(entry.qty + qty, item.stock || 20) }
            : entry,
        )
      }
      return [...current, { ...item, qty: Math.max(1, qty) }]
    })
  }, [])

  const setQty = useCallback((productId: string, qty: number) => {
    setItems((current) =>
      current
        .map((entry) => (entry.productId === productId ? { ...entry, qty: Math.min(Math.max(qty, 1), 20) } : entry))
        .filter((entry) => entry.qty > 0),
    )
  }, [])

  const remove = useCallback((productId: string) => {
    setItems((current) => current.filter((entry) => entry.productId !== productId))
  }, [])

  const clear = useCallback(() => setItems([]), [])

  const value = useMemo<CartContextValue>(() => {
    const count = items.reduce((sum, item) => sum + item.qty, 0)
    const subtotal = items.reduce((sum, item) => sum + item.price * item.qty, 0)
    return { items, count, subtotal, add, setQty, remove, clear }
  }, [items, add, setQty, remove, clear])

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart(): CartContextValue {
  const context = useContext(CartContext)
  if (!context) throw new Error('useCart must be used inside CartProvider')
  return context
}
