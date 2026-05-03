import { useEffect, useState, useCallback } from 'react'
import { LOAD_TIMEOUT_MS } from './constants'

interface LoadState {
  loading: boolean
  error: string | null
  retry: () => void
}

/**
 * Hook that calls a loader function on mount with a timeout safety net.
 * If the loader doesn't finish within `timeoutMs` (default 8s), shows
 * an error with a retry button instead of spinning forever.
 */
export function useLoadData(loader: () => Promise<void>, deps: any[] = [], timeoutMs = LOAD_TIMEOUT_MS): LoadState {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  // Serialize deps to a stable string to avoid spread in dependency array
  const depsKey = JSON.stringify(deps)

  const retry = useCallback(() => {
    setLoading(true)
    setError(null)
    setAttempt(a => a + 1)
  }, [])

  useEffect(() => {
    let mounted = true
    let settled = false

    const timeout = setTimeout(() => {
      if (mounted && !settled) {
        settled = true
        setLoading(false)
        setError('Request timed out. Click retry to try again.')
      }
    }, timeoutMs)

    loader()
      .then(() => {
        if (mounted && !settled) {
          settled = true
          setLoading(false)
        }
      })
      .catch((err) => {
        if (mounted && !settled) {
          settled = true
          setLoading(false)
          setError(err?.message ?? 'Failed to load data.')
        }
      })

    return () => {
      mounted = false
      clearTimeout(timeout)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt, depsKey])

  return { loading, error, retry }
}
