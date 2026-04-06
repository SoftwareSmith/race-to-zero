import { useCallback, useEffect, useState } from 'react'

const METRICS_PATH = `${import.meta.env.BASE_URL}data/metrics.json`

export function useMetrics() {
  const [metrics, setMetrics] = useState(null)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(true)

  const refreshMetrics = useCallback(async ({ silent = false } = {}) => {
    if (!silent) {
      setIsLoading(true)
    }

    try {
      const response = await fetch(`${METRICS_PATH}?t=${Date.now()}`, {
        cache: 'no-store',
      })

      if (!response.ok) {
        throw new Error(`Failed to load metrics (${response.status})`)
      }

      const nextMetrics = await response.json()
      setMetrics(nextMetrics)
      setError('')
      return nextMetrics
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : 'Unknown metrics error'
      setError(message)
      throw caughtError
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    refreshMetrics().catch(() => {})
  }, [refreshMetrics])

  return {
    metrics,
    error,
    isLoading,
    refreshMetrics,
  }
}