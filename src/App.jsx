import { useEffect, useState } from 'react'
import { endOfYear, format, formatDistanceToNowStrict } from 'date-fns'
import ChartCard from './components/ChartCard.jsx'
import SyncButton from './components/SyncButton.jsx'
import { useManualSync } from './hooks/useManualSync.js'
import { useMetrics } from './hooks/useMetrics.js'
import {
  buildBacklogChartData,
  buildComparisonChartData,
  buildFlowChartData,
  buildPriorityChartData,
  buildProjectionChartData,
  getComparisonMetrics,
  getDashboardMetrics,
  getSummaryMetrics,
} from './utils/metrics.js'
import './App.css'

const TARGET_FROM_STORAGE_KEY = 'race-to-zero:target-from'
const TARGET_TO_STORAGE_KEY = 'race-to-zero:target-to'

function readStoredDate(key, fallbackValue) {
  if (typeof window === 'undefined') {
    return fallbackValue
  }

  const storedValue = window.localStorage.getItem(key)
  return storedValue || fallbackValue
}

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

function formatDelta(value, digits = 2, invert = false) {
  const normalizedValue = invert ? value * -1 : value
  const prefix = normalizedValue > 0 ? '+' : ''
  return `${prefix}${formatNumber(normalizedValue, digits)}`
}

function App() {
  const { metrics, error, isLoading, refreshMetrics } = useMetrics()
  const [targetFromDate, setTargetFromDate] = useState(() => readStoredDate(TARGET_FROM_STORAGE_KEY, format(new Date(), 'yyyy-MM-dd')))
  const [targetToDate, setTargetToDate] = useState(() => readStoredDate(TARGET_TO_STORAGE_KEY, format(endOfYear(new Date()), 'yyyy-MM-dd')))
  const [rangeDays, setRangeDays] = useState('30')
  const [activeTab, setActiveTab] = useState('dashboard')
  const dashboardMetrics = getDashboardMetrics(metrics, { targetFromDate, targetToDate, rangeDays })
  const comparisonMetrics = getComparisonMetrics(metrics, { rangeDays })
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

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(TARGET_FROM_STORAGE_KEY, targetFromDate)
    }
  }, [targetFromDate])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(TARGET_TO_STORAGE_KEY, targetToDate)
    }
  }, [targetToDate])

  const handleTargetFromChange = (nextValue) => {
    setTargetFromDate(nextValue)

    if (nextValue > targetToDate) {
      setTargetToDate(nextValue)
    }
  }

  const handleTargetToChange = (nextValue) => {
    setTargetToDate(nextValue)

    if (nextValue < targetFromDate) {
      setTargetFromDate(nextValue)
    }
  }

  return (
    <div className="app-shell">
      <header className="app-header app-header-dark">
        <div className="hero-copy hero-copy-wide">
          <p className="eyebrow">Coreplan CP bug command center</p>
          <h1>Race to Zero Bugs</h1>
          <p className="subtitle">
            Inspect current bug pressure, tighten the target window, and compare recent periods without leaving the dashboard.
          </p>
        </div>

        <div className="header-toolbar">
          <label className="control-panel control-panel-compact">
            <span className="control-label">From</span>
            <input
              className="control-input"
              onChange={(event) => handleTargetFromChange(event.target.value)}
              type="date"
              value={targetFromDate}
            />
          </label>

          <label className="control-panel control-panel-compact">
            <span className="control-label">To</span>
            <input
              className="control-input"
              min={targetFromDate || todayDate}
              onChange={(event) => handleTargetToChange(event.target.value)}
              type="date"
              value={targetToDate}
            />
          </label>

          <div className="toolbar-inline-meta">
            <span className="header-meta-pill">Updated {lastUpdatedLabel}</span>
          </div>

          <SyncButton
            isSyncing={isSyncing}
            onClick={triggerSync}
            statusMessage={syncMessage}
          />

          <div className="toolbar-inline-meta">
            <a className="header-link" href={metricsUrl} rel="noreferrer" target="_blank">
              Open data snapshot
            </a>
          </div>
        </div>

        <div className="view-switcher" role="tablist" aria-label="Dashboard view selector">
          <button
            aria-selected={activeTab === 'dashboard'}
            className={`view-toggle ${activeTab === 'dashboard' ? 'view-toggle-active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
            type="button"
          >
            Dashboard
          </button>
          <button
            aria-selected={activeTab === 'comparison'}
            className={`view-toggle ${activeTab === 'comparison' ? 'view-toggle-active' : ''}`}
            onClick={() => setActiveTab('comparison')}
            type="button"
          >
            Compare Periods
          </button>
        </div>
      </header>

      <main className="dashboard-grid">
        <section className="range-banner">
          <div>
            <span className="section-kicker">Time period</span>
            <h2>{dashboardMetrics.rangeLabel}</h2>
            <p className="side-panel-copy">Controls recent activity metrics, charts, and the comparison tab.</p>
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
        </section>

        {activeTab === 'dashboard' ? (
          <>
            <section className="hero-grid hero-grid-single">
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

                <div className="hero-highlight-grid">
                  <div className="hero-highlight">
                    <span className="hero-highlight-label">Fixes per day required</span>
                    <strong>{formatNumber(summary.bugsPerDayRequired, 2)}</strong>
                    <p>Based on current backlog and recent add rate over {dashboardMetrics.rangeLabel.toLowerCase()}.</p>
                  </div>

                  <div className="likelihood-panel">
                    <div className="likelihood-copy">
                      <span className="status-label">Likelihood of success</span>
                      <strong>{summary.likelihoodScore}%</strong>
                      <p>Estimated from recent net burn versus the net burn required for the selected target window.</p>
                    </div>
                    <div aria-hidden="true" className="likelihood-meter">
                      <div className="likelihood-meter-track">
                        <div className={`likelihood-meter-fill likelihood-meter-fill-${dashboardMetrics.paceTone}`} style={{ width: `${summary.likelihoodScore}%` }} />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="hero-metric-grid">
                  <div className="hero-mini-metric">
                    <span className="status-label">Target window</span>
                    <strong>{summary.targetFromLabel}</strong>
                    <span className="mini-metric-footnote">to {summary.targetToLabel}</span>
                  </div>
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
                </div>
              </article>
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
                title="Projection To Target"
                description="Projected backlog versus the required glide path across the selected target window."
                data={buildProjectionChartData(dashboardMetrics)}
              />
              <ChartCard
                title="Open Bugs By Priority"
                description="Current open backlog split by Linear priority to show concentration at the top end."
                data={buildPriorityChartData(dashboardMetrics)}
                variant="bar"
              />
            </section>
          </>
        ) : (
          <section className="comparison-layout">
            <article className={`comparison-hero comparison-hero-${comparisonMetrics.tone}`}>
              <div className="hero-panel-head">
                <div>
                  <span className="section-kicker">Period comparison</span>
                  <h2>{comparisonMetrics.headline}</h2>
                  <p className="hero-panel-copy">
                    {comparisonMetrics.body}
                    {comparisonMetrics.usedFallbackRange ? ' All-time cannot be compared as an equal prior period, so this view uses 30-day windows.' : ''}
                  </p>
                </div>
                <span className={`signal-pill signal-pill-${comparisonMetrics.tone}`}>
                  {comparisonMetrics.comparisonRangeDays}D
                </span>
              </div>

              <div className="comparison-window-grid">
                <div className="hero-mini-metric">
                  <span className="status-label">Current window</span>
                  <strong>{comparisonMetrics.currentWindow.label}</strong>
                </div>
                <div className="hero-mini-metric">
                  <span className="status-label">Previous window</span>
                  <strong>{comparisonMetrics.previousWindow.label}</strong>
                </div>
                <div className="hero-mini-metric">
                  <span className="status-label">Net burn delta</span>
                  <strong>{formatDelta(comparisonMetrics.netBurnDelta)}</strong>
                  <span className="mini-metric-footnote">positive is better</span>
                </div>
              </div>
            </article>

            <section className="comparison-kpi-grid">
              <article className="kpi-card">
                <span className="status-label">Created / day</span>
                <strong>{formatNumber(comparisonMetrics.currentWindow.addRate, 2)}</strong>
                <span className="mini-metric-footnote">vs {formatNumber(comparisonMetrics.previousWindow.addRate, 2)} previous</span>
              </article>
              <article className="kpi-card">
                <span className="status-label">Fixed / day</span>
                <strong>{formatNumber(comparisonMetrics.currentWindow.fixRate, 2)}</strong>
                <span className="mini-metric-footnote">vs {formatNumber(comparisonMetrics.previousWindow.fixRate, 2)} previous</span>
              </article>
              <article className="kpi-card">
                <span className="status-label">Change in intake</span>
                <strong>{formatDelta(comparisonMetrics.addRateDelta, 2, true)}</strong>
                <span className="mini-metric-footnote">positive is lower intake</span>
              </article>
              <article className="kpi-card">
                <span className="status-label">Change in net burn</span>
                <strong>{formatDelta(comparisonMetrics.netBurnDelta)}</strong>
                <span className="mini-metric-footnote">positive is better</span>
              </article>
            </section>

            <section className="chart-stack chart-stack-dark">
              <ChartCard
                title="Current vs Previous"
                description="Grouped comparison of intake, fixes, and net burn rate for the current and prior periods."
                data={buildComparisonChartData(comparisonMetrics)}
                variant="bar"
              />
            </section>
          </section>
        )}
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
