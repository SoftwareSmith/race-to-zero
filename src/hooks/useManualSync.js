import { useCallback, useState } from 'react'
import {
  dispatchWorkflow,
  getLatestWorkflowRun,
  wait,
} from '../utils/github.js'

const RUN_POLL_INTERVAL_MS = 6000
const METRICS_POLL_INTERVAL_MS = 5000
const METRICS_POLL_TIMEOUT_MS = 120000

export function useManualSync({ metrics, onStatusChange, refreshMetrics }) {
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncError, setSyncError] = useState('')

  const triggerSync = useCallback(async () => {
    const previousTimestamp = metrics?.lastUpdated ?? null
    setIsSyncing(true)
    setSyncError('')

    try {
      onStatusChange('Dispatching GitHub Actions workflow…')

      const triggerTimestamp = new Date().toISOString()
      await dispatchWorkflow()

      onStatusChange('Waiting for the workflow run to start…')

      let run = null
      while (!run) {
        run = await getLatestWorkflowRun(triggerTimestamp)
        if (!run) {
          await wait(RUN_POLL_INTERVAL_MS)
        }
      }

      while (run.status !== 'completed') {
        onStatusChange(`Workflow ${run.status}…`)
        await wait(RUN_POLL_INTERVAL_MS)
        run = await getLatestWorkflowRun(triggerTimestamp)
      }

      if (run.conclusion !== 'success') {
        throw new Error(`Workflow completed with conclusion: ${run.conclusion}`)
      }

      onStatusChange('Workflow completed. Refreshing metrics file…')

      const startedAt = Date.now()
      let refreshed = false

      while (!refreshed && Date.now() - startedAt < METRICS_POLL_TIMEOUT_MS) {
        const nextMetrics = await refreshMetrics({ silent: true })
        if (nextMetrics?.lastUpdated && nextMetrics.lastUpdated !== previousTimestamp) {
          refreshed = true
          break
        }

        onStatusChange('Waiting for updated metrics.json to publish…')
        await wait(METRICS_POLL_INTERVAL_MS)
      }

      if (!refreshed) {
        throw new Error('Workflow finished, but the metrics file did not update before timeout')
      }

      onStatusChange('Metrics updated successfully.')
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : 'Manual sync failed'
      setSyncError(message)
      onStatusChange('')
    } finally {
      setIsSyncing(false)
    }
  }, [metrics?.lastUpdated, onStatusChange, refreshMetrics])

  return {
    isSyncing,
    syncError,
    triggerSync,
  }
}