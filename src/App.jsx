import { useEffect, useState } from 'react'
import { endOfYear, format, formatDistanceToNowStrict, subDays } from 'date-fns'
import ChartCard from './components/ChartCard.jsx'
import SyncButton from './components/SyncButton.jsx'
import Tabs from './components/Tabs.jsx'
import { useManualSync } from './hooks/useManualSync.js'
import { useMetrics } from './hooks/useMetrics.js'
import {
  buildComparisonSummaryChartData,
  buildComparisonTimelineChartData,
  buildDeadlineBurndownChartData,
  buildPriorityChartData,
  getComparisonMetrics,
  getDeadlineMetrics,
  getSummaryMetrics,
} from './utils/metrics.js'
import './App.css'

const DEADLINE_STORAGE_KEY = 'race-to-zero:deadline-date'
const DEADLINE_FROM_STORAGE_KEY = 'race-to-zero:deadline-from-date'

const TAB_ITEMS = [
  { id: 'deadline', label: 'Deadline' },
  { id: 'compare', label: 'Compare Periods' },
]

const COMPARE_RANGE_OPTIONS = [
  { label: '7D', value: '7' },
  { label: '30D', value: '30' },
  { label: '90D', value: '90' },
  { label: 'All time', value: 'all' },
  { label: 'Custom', value: 'custom' },
]

function readStoredDate(key, fallbackValue) {
  if (typeof window === 'undefined') {
    return fallbackValue
  }

  const storedValue = window.localStorage.getItem(key)
  return storedValue || fallbackValue
}

function formatNumber(value, digits = 0) {
  if (!Number.isFinite(value)) {
    return '0'
  }

  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(value)
}

function formatSignedNumber(value, digits = 0) {
  const prefix = value > 0 ? '+' : ''
  return `${prefix}${formatNumber(value, digits)}`
}

function formatPercent(value, digits = 0) {
  return `${formatNumber(value, digits)}%`
}

function getNetChangeTone(netChange) {
  if (netChange > 0) {
    return 'negative'
  }

  if (netChange < 0) {
    return 'positive'
  }

  return 'neutral'
}

function getMetricTone(currentValue, previousValue, higherIsBetter) {
  if (previousValue == null) {
    return 'neutral'
  }

  if (Math.abs(currentValue - previousValue) < 0.01) {
    return 'neutral'
  }

  const improved = higherIsBetter ? currentValue > previousValue : currentValue < previousValue
  return improved ? 'positive' : 'negative'
}

function App() {
  const { metrics, error, refreshMetrics } = useMetrics()
  const [deadlineDate, setDeadlineDate] = useState(() => readStoredDate(DEADLINE_STORAGE_KEY, format(endOfYear(new Date()), 'yyyy-MM-dd')))
  const [deadlineFromDate, setDeadlineFromDate] = useState(() => readStoredDate(DEADLINE_FROM_STORAGE_KEY, format(subDays(new Date(), 29), 'yyyy-MM-dd')))
  const [activeTab, setActiveTab] = useState('deadline')
  const [compareRangeKey, setCompareRangeKey] = useState('30')
  const [customFromDate, setCustomFromDate] = useState(() => format(subDays(new Date(), 29), 'yyyy-MM-dd'))
  const [customToDate, setCustomToDate] = useState(() => format(new Date(), 'yyyy-MM-dd'))
  const deadlineMetrics = getDeadlineMetrics(metrics, { deadlineDate, trackingStartDate: deadlineFromDate })
  const comparisonMetrics = getComparisonMetrics(metrics, { rangeKey: compareRangeKey, customFromDate, customToDate })
  const summary = getSummaryMetrics(deadlineMetrics)
  const [syncMessage, setSyncMessage] = useState('')
  const metricsUrl = `${import.meta.env.BASE_URL}data/metrics.json`
  const todayDate = format(new Date(), 'yyyy-MM-dd')

  const { isSyncing, syncError, triggerSync } = useManualSync({
    metrics,
    onStatusChange: setSyncMessage,
    refreshMetrics,
  })

  let lastUpdatedLabel = 'No sync timestamp yet'
  let lastUpdatedTooltip = 'Not synced yet'
  if (metrics?.lastUpdated) {
    const lastUpdated = new Date(metrics.lastUpdated)
    if (!Number.isNaN(lastUpdated.getTime())) {
      lastUpdatedLabel = formatDistanceToNowStrict(lastUpdated, {
        addSuffix: true,
      })
      lastUpdatedTooltip = format(lastUpdated, 'MMM d, yyyy h:mm a')
    }
  }

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(DEADLINE_STORAGE_KEY, deadlineDate)
    }
  }, [deadlineDate])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(DEADLINE_FROM_STORAGE_KEY, deadlineFromDate)
    }
  }, [deadlineFromDate])

  const createdTone = getMetricTone(comparisonMetrics.currentWindow.created, comparisonMetrics.previousWindow?.created ?? null, false)
  const completedTone = getMetricTone(comparisonMetrics.currentWindow.fixed, comparisonMetrics.previousWindow?.fixed ?? null, true)
  const netChangeTone = getNetChangeTone(comparisonMetrics.currentWindow.netChange)
  const completionRateTone = getMetricTone(comparisonMetrics.currentWindow.completionRate, comparisonMetrics.previousWindow?.completionRate ?? null, true)

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="hero-copy hero-copy-wide">
          <p className="eyebrow">Coreplan CP bug command center</p>
          <h1>Race to Zero Bugs</h1>
          <p className="subtitle">
            Track the bug backlog against a single deadline, then switch to period comparisons when you need trend analysis.
          </p>
        </div>

        <div className="header-actions">
          <SyncButton
            isSyncing={isSyncing}
            onClick={triggerSync}
            lastSyncedLabel={lastUpdatedTooltip}
            snapshotUrl={metricsUrl}
            statusMessage={syncMessage}
            relativeLabel={lastUpdatedLabel}
          />
        </div>
      </header>

      <Tabs activeTab={activeTab} onChange={setActiveTab} tabs={TAB_ITEMS} />

      <main className="dashboard-grid">
        {activeTab === 'deadline' ? (
          <>
            <section className="deadline-toolbar">
              <div>
                <span className="section-kicker">Deadline focus</span>
                <h2>Track the path to zero</h2>
                <p className="subtitle compact-copy">Choose where to start measuring the burndown, then see whether today’s pace can carry the backlog to zero by the deadline.</p>
              </div>

              <div className="deadline-date-controls">
                <label className="control-panel control-panel-compact control-panel-inline">
                  <span className="control-label">From</span>
                  <input
                    className="control-input"
                    max={deadlineDate}
                    onChange={(event) => setDeadlineFromDate(event.target.value)}
                    type="date"
                    value={deadlineFromDate}
                  />
                </label>

                <label className="control-panel control-panel-compact control-panel-inline">
                  <span className="control-label">Deadline</span>
                  <input
                    className="control-input"
                    min={todayDate}
                    onChange={(event) => setDeadlineDate(event.target.value)}
                    type="date"
                    value={deadlineDate}
                  />
                </label>
              </div>
            </section>

            <section className="deadline-summary-grid">
              <article className={`spotlight-card spotlight-card-${deadlineMetrics.statusTone}`}>
                <div className="spotlight-head">
                  <div>
                    <span className="section-kicker">Status</span>
                    <h2>{deadlineMetrics.statusHeadline}</h2>
                    <p className="hero-panel-copy">{deadlineMetrics.statusBody}</p>
                  </div>
                  <span className={`status-pill status-pill-${deadlineMetrics.statusTone}`}>
                    {deadlineMetrics.statusSignal} · {summary.daysUntilDeadline}d left
                  </span>
                </div>

                <div className="spotlight-metrics">
                  <div className={`spotlight-metric-card spotlight-metric-card-${deadlineMetrics.statusTone}`}>
                    <span className="status-label">Remaining bugs</span>
                    <strong>{formatNumber(summary.bugCount)}</strong>
                    <span className="mini-metric-footnote">Open bugs still in the queue today.</span>
                  </div>

                  <div className={`spotlight-metric-card spotlight-metric-card-${deadlineMetrics.statusTone}`}>
                    <span className="status-label">Bugs / day required</span>
                    <strong>{formatNumber(summary.bugsPerDayRequired, 2)}</strong>
                    <span className="mini-metric-footnote">Daily completions needed if intake stays at its current pace.</span>
                  </div>
                </div>

                <p className="spotlight-footnote">Measured from {summary.trackingStartLabel} through today, using the live Linear bug snapshot.</p>
              </article>

              <section className="metric-grid metric-grid-compact">
                  <article className={`metric-card metric-card-${deadlineMetrics.statusTone}`}>
                    <span className="status-label">Days left</span>
                    <strong>{formatNumber(summary.daysUntilDeadline)}</strong>
                    <span className="mini-metric-footnote">Runway remaining to hit zero by {summary.deadlineLabel}.</span>
                  </article>
                  <article className={`metric-card metric-card-${deadlineMetrics.statusTone}`}>
                    <span className="status-label">Current net burn</span>
                    <strong>{formatNumber(summary.currentNetBurnRate, 2)}/day</strong>
                    <span className="mini-metric-footnote">Negative means backlog is growing; positive means it is shrinking.</span>
                  </article>
                  <article className={`metric-card metric-card-${deadlineMetrics.statusTone}`}>
                    <span className="status-label">Fixes / day</span>
                    <strong>{formatNumber(summary.currentFixRate, 2)}</strong>
                    <span className="mini-metric-footnote">Average completions per day since the selected start date.</span>
                  </article>
                  <article className={`metric-card metric-card-${deadlineMetrics.statusTone}`}>
                    <span className="status-label">Created / day</span>
                    <strong>{formatNumber(summary.currentAddRate, 2)}</strong>
                    <span className="mini-metric-footnote">Average new bugs arriving per day in the same window.</span>
                  </article>
                  <article className={`metric-card metric-card-${deadlineMetrics.statusTone}`}>
                    <span className="status-label">Confidence</span>
                    <strong>{formatPercent(summary.likelihoodScore)}</strong>
                    <span className="mini-metric-footnote">A trend score comparing your current burn to the burn required.</span>
                  </article>
                  <article className={`metric-card metric-card-${deadlineMetrics.statusTone}`}>
                    <span className="status-label">Required net burn</span>
                    <strong>{formatNumber(deadlineMetrics.neededNetBurnRate, 2)}/day</strong>
                    <span className="mini-metric-footnote">Minimum daily backlog reduction needed from here forward.</span>
                  </article>
              </section>
            </section>

            <section className="chart-grid chart-grid-deadline">
              <ChartCard
                className="chart-card chart-card-wide"
                title="Burndown To Zero"
                description={`If the actual line stays above the ideal line, the team needs more daily net burn to reach zero by ${summary.deadlineLabel}.`}
                data={buildDeadlineBurndownChartData(deadlineMetrics)}
              />
              <ChartCard
                title="Open Bugs By Priority"
                description="Shows whether the remaining backlog is concentrated in urgent work or mostly sitting in lower-priority cleanup."
                data={buildPriorityChartData(deadlineMetrics)}
                variant="bar"
              />
            </section>
          </>
        ) : (
          <>
            <section className="compare-toolbar">
              <div>
                <span className="section-kicker">Compare periods</span>
                <h2>{comparisonMetrics.rangeLabel}</h2>
                <p className="subtitle compact-copy">Choose one range mode at a time. Custom range replaces the presets so the comparison stays unambiguous.</p>
              </div>

              <div className="compare-controls-stack">
                <div className="range-toggle-group range-toggle-group-compare" role="tablist" aria-label="Comparison period selector">
                  {COMPARE_RANGE_OPTIONS.map((option) => (
                    <button
                      aria-selected={compareRangeKey === option.value}
                      className={`range-toggle ${compareRangeKey === option.value ? 'range-toggle-active' : ''}`}
                      key={option.value}
                      onClick={() => setCompareRangeKey(option.value)}
                      type="button"
                    >
                      {option.label}
                    </button>
                  ))}
                </div>

                {compareRangeKey === 'custom' && (
                  <div className="custom-range-grid">
                    <label className="control-panel control-panel-compact control-panel-inline">
                      <span className="control-label">From</span>
                      <input
                        className="control-input"
                        max={customToDate}
                        onChange={(event) => setCustomFromDate(event.target.value)}
                        type="date"
                        value={customFromDate}
                      />
                    </label>

                    <label className="control-panel control-panel-compact control-panel-inline">
                      <span className="control-label">To</span>
                      <input
                        className="control-input"
                        min={customFromDate}
                        onChange={(event) => setCustomToDate(event.target.value)}
                        type="date"
                        value={customToDate}
                      />
                    </label>
                  </div>
                )}
              </div>
            </section>

            <section className="comparison-summary">
              <article className={`comparison-banner comparison-banner-${comparisonMetrics.tone}`}>
                  <div>
                    <span className="section-kicker">Trend reading</span>
                    <h2>{comparisonMetrics.headline}</h2>
                    <p className="hero-panel-copy">{comparisonMetrics.body}</p>
                  </div>
              </article>

              <section className="metric-grid">
                  <article className={`metric-card metric-card-${createdTone}`}>
                    <span className="status-label">Bugs created</span>
                    <strong>{formatNumber(comparisonMetrics.currentWindow.created)}</strong>
                    <span className="mini-metric-footnote">
                      {comparisonMetrics.previousWindow
                        ? `${formatSignedNumber(comparisonMetrics.currentWindow.created - comparisonMetrics.previousWindow.created)} vs previous window`
                        : 'Created in the current selected range'}
                    </span>
                  </article>
                  <article className={`metric-card metric-card-${completedTone}`}>
                    <span className="status-label">Bugs completed</span>
                    <strong>{formatNumber(comparisonMetrics.currentWindow.fixed)}</strong>
                    <span className="mini-metric-footnote">
                      {comparisonMetrics.previousWindow
                        ? `${formatSignedNumber(comparisonMetrics.currentWindow.fixed - comparisonMetrics.previousWindow.fixed)} vs previous window`
                        : 'Completed in the current selected range'}
                    </span>
                  </article>
                  <article className={`metric-card metric-card-${netChangeTone}`}>
                    <span className="status-label">Net change</span>
                    <strong>{formatSignedNumber(comparisonMetrics.currentWindow.netChange)}</strong>
                    <span className="mini-metric-footnote">
                      {comparisonMetrics.currentWindow.netChange <= 0 ? 'Negative means completions outpaced new bugs.' : 'Positive means backlog grew in this period.'}
                    </span>
                  </article>
                  <article className={`metric-card metric-card-${completionRateTone}`}>
                    <span className="status-label">Completion rate</span>
                    <strong>{formatPercent(comparisonMetrics.currentWindow.completionRate, 1)}</strong>
                    <span className="mini-metric-footnote">
                      {comparisonMetrics.previousWindow
                        ? `${formatSignedNumber(comparisonMetrics.currentWindow.completionRate - comparisonMetrics.previousWindow.completionRate, 1)} pts vs previous`
                        : 'Completed divided by created for the selected range'}
                    </span>
                  </article>
              </section>
            </section>

            <section className="chart-grid">
              <ChartCard
                className="chart-card chart-card-wide"
                title="Created vs Completed Over Time"
                description="Use the moving averages to see whether incoming bug pressure is trending above or below completion output."
                data={buildComparisonTimelineChartData(comparisonMetrics)}
              />
              <ChartCard
                title="Current vs Previous Window"
                description="A positive net change bar means backlog grew in that period; a higher completion-rate bar means the team cleared work more efficiently."
                data={buildComparisonSummaryChartData(comparisonMetrics)}
                variant="bar"
              />
            </section>
          </>
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
