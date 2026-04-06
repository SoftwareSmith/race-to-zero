import { useState } from 'react'
import { endOfYear, format, formatDistanceToNowStrict } from 'date-fns'
import ChartCard from './components/ChartCard.jsx'
import SyncButton from './components/SyncButton.jsx'
import { useManualSync } from './hooks/useManualSync.js'
import { useMetrics } from './hooks/useMetrics.js'
import {
  buildBacklogChartData,
  buildFlowChartData,
  buildPriorityChartData,
  buildProjectionChartData,
  getDashboardMetrics,
  getSummaryMetrics,
} from './utils/metrics.js'
import './App.css'

const RANGE_OPTIONS = [
  { label: '7D', value: '7' },
  { label: '30D', value: '30' },
  { label: '90D', value: '90' },
  { label: 'All', value: 'all' },
]

function formatNumber(value, digits = 0) {
  if (!Number.isFinite(value)) {
    return '0'
  }

  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(value)
}

function App() {
  const { metrics, error, isLoading, refreshMetrics } = useMetrics()
  const [deadlineDate, setDeadlineDate] = useState(() => format(endOfYear(new Date()), 'yyyy-MM-dd'))
  const [rangeDays, setRangeDays] = useState('30')
  const dashboardMetrics = getDashboardMetrics(metrics, { deadlineDate, rangeDays })
  const summary = getSummaryMetrics(dashboardMetrics)
  const [syncMessage, setSyncMessage] = useState('')
  const metricsUrl = `${import.meta.env.BASE_URL}data/metrics.json`
  const todayDate = format(new Date(), 'yyyy-MM-dd')

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
      <header className="app-header app-header-dark">
        <div className="hero-copy">
          <p className="eyebrow">Coreplan CP bug command center</p>
          <h1>Race to Zero Bugs</h1>
          <p className="subtitle">
            Set a target date, inspect recent intake and fix velocity, and see whether the current trend can actually get the backlog to zero.
          </p>
        </div>

        <div className="header-actions header-actions-compact">
          <label className="control-panel">
            <span className="control-label">Deadline</span>
            <input
              className="control-input"
              min={todayDate}
              onChange={(event) => setDeadlineDate(event.target.value)}
              type="date"
              value={deadlineDate}
            />
          </label>

          <SyncButton
            isSyncing={isSyncing}
            onClick={triggerSync}
            statusMessage={syncMessage}
          />

          <div className="header-meta-row">
            <span className="header-meta-pill">Updated {lastUpdatedLabel}</span>
            <a className="header-link" href={metricsUrl} rel="noreferrer" target="_blank">
              Open data snapshot
            </a>
          </div>
        </div>
      </header>

      <main className="dashboard-grid">
        <section className="hero-grid">
          <article className={`hero-panel hero-panel-${dashboardMetrics.paceTone}`}>
            <div className="hero-panel-head">
              <div>
                <span className="section-kicker">Target outlook</span>
                <h2>{dashboardMetrics.paceHeadline}</h2>
                <p className="hero-panel-copy">{dashboardMetrics.paceBody}</p>
              </div>
              <span className={`signal-pill signal-pill-${dashboardMetrics.paceTone}`}>
                {summary.paceSignal}
              </span>
            </div>

            <div className="hero-highlight">
              <span className="hero-highlight-label">Fixes per day required</span>
              <strong>{formatNumber(summary.bugsPerDayRequired, 2)}</strong>
              <p>Based on current backlog and recent add rate over {dashboardMetrics.rangeLabel.toLowerCase()}.</p>
            </div>

            <div className="hero-metric-grid">
              <div className="hero-mini-metric">
                <span className="status-label">Current fix rate</span>
                <strong>{formatNumber(summary.currentFixRate, 2)}/day</strong>
              </div>
              <div className="hero-mini-metric">
                <span className="status-label">Current add rate</span>
                <strong>{formatNumber(summary.currentAddRate, 2)}/day</strong>
              </div>
              <div className="hero-mini-metric">
                <span className="status-label">Net burn</span>
                <strong>{formatNumber(summary.currentNetBurnRate, 2)}/day</strong>
              </div>
              <div className="hero-mini-metric">
                <span className="status-label">Deadline</span>
                <strong>{summary.deadlineLabel}</strong>
              </div>
            </div>

            <div className="likelihood-panel">
              <div className="likelihood-copy">
                <span className="status-label">Likelihood of success</span>
                <strong>{summary.likelihoodScore}%</strong>
                <p>Estimated from recent net burn versus the net burn required to hit the selected deadline.</p>
              </div>
              <div aria-hidden="true" className="likelihood-meter">
                <div className="likelihood-meter-track">
                  <div className={`likelihood-meter-fill likelihood-meter-fill-${dashboardMetrics.paceTone}`} style={{ width: `${summary.likelihoodScore}%` }} />
                </div>
              </div>
            </div>
          </article>

          <aside className="side-panel">
            <div>
              <span className="section-kicker">Time period</span>
              <h2>Drill into a range</h2>
              <p className="side-panel-copy">
                Use the window below to inspect recent intake and fix performance. Charts and activity counters update together.
              </p>
            </div>

            <div className="range-toggle-group" role="tablist" aria-label="Time period selector">
              {RANGE_OPTIONS.map((option) => (
                <button
                  aria-selected={rangeDays === option.value}
                  className={`range-toggle ${rangeDays === option.value ? 'range-toggle-active' : ''}`}
                  key={option.value}
                  onClick={() => setRangeDays(option.value)}
                  type="button"
                >
                  {option.label}
                </button>
              ))}
            </div>

            <details className="data-source-details">
              <summary>Data source and sync details</summary>
              <div className="details-copy">
                <p>Scope: CP team bugs from Linear.</p>
                <p>Sync status: {isSyncing ? syncMessage || 'Running' : 'Idle'}</p>
                <a href={metricsUrl} rel="noreferrer" target="_blank">Open current metrics.json</a>
              </div>
            </details>
          </aside>
        </section>

        <section className="kpi-grid">
          <article className="kpi-card">
            <span className="status-label">Open bug count</span>
            <strong>{formatNumber(summary.bugCount)}</strong>
          </article>
          <article className="kpi-card">
            <span className="status-label">Fixes/day required</span>
            <strong>{formatNumber(summary.bugsPerDayRequired, 2)}</strong>
          </article>
          <article className="kpi-card">
            <span className="status-label">New bugs since {dashboardMetrics.rangeStartLabel}</span>
            <strong>{formatNumber(dashboardMetrics.createdInRange)}</strong>
          </article>
          <article className="kpi-card">
            <span className="status-label">Bugs fixed since {dashboardMetrics.rangeStartLabel}</span>
            <strong>{formatNumber(dashboardMetrics.completedInRange)}</strong>
          </article>
        </section>

        <section className="chart-stack chart-stack-dark">
          <ChartCard
            title={`Bug Flow • ${dashboardMetrics.rangeLabel}`}
            description="Compare bug intake against fixes across the selected time window."
            data={buildFlowChartData(dashboardMetrics)}
          />
          <ChartCard
            title={`Backlog Trend • ${dashboardMetrics.rangeLabel}`}
            description="See how the open bug count moved through the selected period."
            data={buildBacklogChartData(dashboardMetrics)}
          />
          <ChartCard
            title="Projection To Deadline"
            description="Projected backlog versus the required glide path from today to the chosen deadline."
            data={buildProjectionChartData(dashboardMetrics)}
          />
          <ChartCard
            className="chart-card-priority"
            title="Open Bugs By Priority"
            description="Current open backlog split by Linear priority to show concentration at the top end."
            data={buildPriorityChartData(dashboardMetrics)}
            variant="bar"
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
