import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { api, type StoreInfo } from './api'

type StoreContextValue = {
  store: StoreInfo
  reload: () => void
}

const StoreContext = createContext<StoreContextValue | null>(null)

const FALLBACK: StoreInfo = { name: 'متجرنا', phone: '', announcement: '', shippingFee: 0 }

export function StoreProvider({ children }: { children: ReactNode }) {
  const [store, setStore] = useState<StoreInfo>(FALLBACK)
  const [version, setVersion] = useState(0)

  useEffect(() => {
    let alive = true
    api
      .get<{ store: StoreInfo }>('/api/store')
      .then((data) => {
        if (alive) setStore(data.store)
      })
      .catch(() => undefined)
    return () => {
      alive = false
    }
  }, [version])

  const reload = () => setVersion((value) => value + 1)

  return <StoreContext.Provider value={{ store, reload }}>{children}</StoreContext.Provider>
}

export function useStore(): StoreContextValue {
  const context = useContext(StoreContext)
  if (!context) throw new Error('useStore must be used inside StoreProvider')
  return context
}
