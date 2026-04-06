import { useState } from 'react'
import { formatDistanceToNowStrict } from 'date-fns'
import ChartCard from './components/ChartCard.jsx'
import SummaryCard from './components/SummaryCard.jsx'
import SyncButton from './components/SyncButton.jsx'
import { useManualSync } from './hooks/useManualSync.js'
import { useMetrics } from './hooks/useMetrics.js'
import {
  buildBurndownChartData,
  buildDailyChartData,
  getDashboardMetrics,
  getSummaryMetrics,
} from './utils/metrics.js'
import './App.css'

function App() {
  const { metrics, error, isLoading, refreshMetrics } = useMetrics()
  const dashboardMetrics = getDashboardMetrics(metrics)
  const summary = getSummaryMetrics(dashboardMetrics)
  const [syncMessage, setSyncMessage] = useState('')

  const { isSyncing, syncError, triggerSync } = useManualSync({
    metrics,
    onStatusChange: setSyncMessage,
    refreshMetrics,
  })

  let lastUpdatedLabel = 'No sync timestamp yet'
  if (metrics?.lastUpdated) {
    const lastUpdated = new Date(metrics.lastUpdated)
    if (!Number.isNaN(lastUpdated.getTime())) {
      lastUpdatedLabel = formatDistanceToNowStrict(lastUpdated, {
        addSuffix: true,
      })
    }
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">GitHub Pages dashboard</p>
          <h1>Race to Zero Bugs</h1>
          <p className="subtitle">
            Track bug intake, bug completions, and whether the team is on pace
            to hit zero by the current deadline.
          </p>
        </div>

        <div className="header-actions">
          <div className="last-updated-card">
            <span className="last-updated-label">Last updated</span>
            <strong>{lastUpdatedLabel}</strong>
          </div>

          <SyncButton
            isSyncing={isSyncing}
            onClick={triggerSync}
            statusMessage={syncMessage}
          />
        </div>
      </header>

      <main className="dashboard-grid">
        <section className="dashboard-summary">
          <SummaryCard summary={summary} isLoading={isLoading} />

          <aside className="dashboard-status-panel">
            <div className="status-block">
              <span className="status-label">Data source</span>
              <strong>/public/data/metrics.json</strong>
            </div>
            <div className="status-block">
              <span className="status-label">Deadline</span>
              <strong>{summary.deadlineLabel}</strong>
            </div>
            <div className="status-block">
              <span className="status-label">Sync status</span>
              <strong>{isSyncing ? syncMessage || 'Syncing…' : 'Idle'}</strong>
            </div>
          </aside>
        </section>

        <section className="chart-stack">
          <ChartCard
            title="Bugs Created Per Day"
            description="Daily bug intake volume loaded from the sanitized metrics file."
            data={buildDailyChartData(dashboardMetrics.createdPerDay, 'Created', '#d9485f')}
          />
          <ChartCard
            title="Bugs Completed Per Day"
            description="Daily bug resolutions used to measure burn velocity."
            data={buildDailyChartData(dashboardMetrics.completedPerDay, 'Completed', '#178f63')}
          />
          <ChartCard
            title="Burndown"
            description="Remaining bugs versus the ideal glide path to zero by the deadline."
            data={buildBurndownChartData(dashboardMetrics)}
          />
        </section>
      </main>

      {(error || syncError) && (
        <div className="banner banner-error" role="alert">
          {syncError || error}
        </div>
      )}

      {!error && !syncError && syncMessage && isSyncing && (
        <div className="banner banner-info" role="status">
          {syncMessage}
        </div>
      )}
    </div>
  )
}

export default App
