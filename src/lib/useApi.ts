import { useCallback, useEffect, useState } from 'react'
import { api } from './api'

export function useApi<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(path !== null)
  const [error, setError] = useState('')
  const [version, setVersion] = useState(0)

  useEffect(() => {
    if (path === null) {
      setLoading(false)
      return
    }
    let alive = true
    setLoading(true)
    setError('')
    api
      .get<T>(path)
      .then((result) => {
        if (alive) setData(result)
      })
      .catch((err: unknown) => {
        if (alive) setError(err instanceof Error ? err.message : 'حصل خطأ، حاول مرة أخرى')
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [path, version])

  const reload = useCallback(() => setVersion((value) => value + 1), [])
  const setDataNow = useCallback((next: T) => setData(next), [])

  return { data, loading, error, reload, setData: setDataNow }
}
