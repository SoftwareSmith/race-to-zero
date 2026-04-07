import { useEffect, useState } from 'react'
import { endOfYear, format, formatDistanceToNowStrict, subDays } from 'date-fns'
import ChartCard from './components/ChartCard.jsx'
import MetricCard from './components/MetricCard.jsx'
import Surface from './components/Surface.jsx'
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
import { cn } from './utils/cn.js'

const DEADLINE_STORAGE_KEY = 'race-to-zero:deadline-date'
const DEADLINE_FROM_STORAGE_KEY = 'race-to-zero:deadline-from-date'

const TAB_ITEMS = [
  { id: 'overview', label: 'Overview' },
  { id: 'periods', label: 'Periods' },
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

function getDeltaTone(value) {
  if (Math.abs(value) < 0.01) {
    return 'neutral'
  }

  return value > 0 ? 'positive' : 'negative'
}

function getStatusTagText(tone) {
  if (tone === 'positive') {
    return 'Ahead'
  }

  if (tone === 'negative') {
    return 'Behind'
  }

  return 'Flat'
}

function FieldShell({ children, className = '' }) {
  return (
    <label
      className={cn(
        'grid gap-2 rounded-[18px] border border-white/10 bg-zinc-950/74 p-4 shadow-[0_14px_30px_rgba(0,0,0,0.26)] backdrop-blur-xl',
        className,
      )}
    >
      {children}
    </label>
  )
}

function DateField({ label, value, onChange, min, max }) {
  return (
    <FieldShell className="min-w-[180px]">
      <span className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-stone-400">{label}</span>
      <input
        className="rounded-2xl border border-white/10 bg-black/28 px-3 py-3 text-sm font-medium text-stone-100 outline-none transition focus:border-sky-400/70 focus:ring-2 focus:ring-sky-300/20"
        max={max}
        min={min}
        onChange={onChange}
        type="date"
        value={value}
      />
    </FieldShell>
  )
}

function StatusBanner({ kind = 'info', children }) {
  const styles = {
    error: 'border-red-500/30 bg-red-950/30 text-red-100',
    info: 'border-sky-500/30 bg-sky-950/20 text-sky-100',
  }

  return (
    <div
      className={cn(
        'rounded-[22px] border px-4 py-3 text-sm font-medium shadow-[0_12px_30px_rgba(68,50,30,0.06)]',
        styles[kind] ?? styles.info,
      )}
      role={kind === 'error' ? 'alert' : 'status'}
    >
      {children}
    </div>
  )
}

function CompareRangePicker({ compareRangeKey, onChange }) {
  return (
    <div className="flex flex-wrap gap-2" role="tablist" aria-label="Comparison period selector">
      {COMPARE_RANGE_OPTIONS.map((option) => {
        const isActive = compareRangeKey === option.value

        return (
          <button
            key={option.value}
            aria-selected={isActive}
            className={cn(
              'rounded-full border px-4 py-2.5 text-sm font-semibold transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/40',
              isActive
                ? 'border-sky-400/35 bg-sky-400/10 text-sky-100 shadow-[inset_0_0_0_1px_rgba(56,189,248,0.18)]'
                : 'border-white/10 bg-zinc-950/72 text-stone-400 hover:-translate-y-0.5 hover:border-white/14 hover:bg-zinc-900 hover:text-stone-100',
            )}
            onClick={() => onChange(option.value)}
            type="button"
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

function StatusTag({ tone, children }) {
  const styles = {
    positive: 'border-emerald-400/28 bg-emerald-500/12 text-emerald-200 shadow-[0_0_22px_rgba(16,185,129,0.12)]',
    negative: 'border-red-400/28 bg-red-500/12 text-red-200 shadow-[0_0_22px_rgba(239,68,68,0.12)]',
    neutral: 'border-sky-400/28 bg-sky-500/10 text-sky-100 shadow-[0_0_22px_rgba(56,189,248,0.1)]',
  }

  return (
    <span className={cn('inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.22em]', styles[tone] ?? styles.neutral)}>
      {children}
    </span>
  )
}

function TopNav({
  activeTab,
  compareRangeKey,
  customFromDate,
  customToDate,
  deadlineDate,
  deadlineFromDate,
  onCompareRangeChange,
  onCustomFromDateChange,
  onCustomToDateChange,
  onDeadlineDateChange,
  onDeadlineFromDateChange,
  onTabChange,
  todayDate,
}) {
  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
      <Tabs activeTab={activeTab} onChange={onTabChange} tabs={TAB_ITEMS} />

      {activeTab === 'overview' ? (
        <div className="grid gap-3 md:grid-cols-2">
          <DateField
            label="From"
            max={deadlineDate}
            onChange={onDeadlineFromDateChange}
            value={deadlineFromDate}
          />
          <DateField
            label="Deadline"
            min={todayDate}
            onChange={onDeadlineDateChange}
            value={deadlineDate}
          />
        </div>
      ) : (
        <div className="grid gap-3 justify-items-start lg:justify-items-end">
          <CompareRangePicker compareRangeKey={compareRangeKey} onChange={onCompareRangeChange} />
          {compareRangeKey === 'custom' ? (
            <div className="grid gap-3 md:grid-cols-2">
              <DateField
                label="From"
                max={customToDate}
                onChange={onCustomFromDateChange}
                value={customFromDate}
              />
              <DateField
                label="To"
                min={customFromDate}
                onChange={onCustomToDateChange}
                value={customToDate}
              />
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}

function CommandCenter({ deadlineMetrics, summary }) {
  const paceGap = summary.currentFixRate - summary.bugsPerDayRequired
  const paceTone = getDeltaTone(paceGap)

  return (
    <Surface className="border-white/10 p-5 sm:p-6" tone="strong">
      <div className="border-b border-white/8 pb-5">
        <div className="w-full">
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.28em] text-stone-500">Delivery outlook</p>
            <StatusTag tone={deadlineMetrics.statusTone}>{getStatusTagText(deadlineMetrics.statusTone)}</StatusTag>
          </div>
          <h2 className="mt-3 font-[family-name:var(--font-display)] text-3xl leading-tight tracking-[-0.04em] text-stone-50 sm:text-[2.8rem]">
            Are we clearing bugs fast enough to reach zero?
          </h2>
          <p className="mt-3 w-full text-sm leading-6 text-stone-300 sm:text-base">
            {paceGap >= 0 ? 'Ahead of' : 'Behind'} required pace for {summary.deadlineLabel}.
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-3">
        <MetricCard
          hint="Average bugs completed per day across the active deadline tracking window."
          label="Fix velocity"
          tone={paceTone}
          value={`${formatNumber(summary.currentFixRate, 2)}/day`}
        />
        <MetricCard
          hint="Target daily completion pace needed to reach zero if current intake continues."
          label="Required pace"
          tone="neutral"
          value={`${formatNumber(summary.bugsPerDayRequired, 2)}/day`}
        />
        <MetricCard
          hint="Fix velocity minus required pace. Positive means delivery is ahead of the current target."
          label="Net difference"
          tone={paceTone}
          value={`${formatSignedNumber(paceGap, 2)}/day`}
        />
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Surface className="p-5 sm:p-6" tone="subtle">
          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-stone-500">Open bugs</p>
          <div className="mt-4 font-[family-name:var(--font-display)] text-5xl leading-none tracking-[-0.06em] text-stone-50 sm:text-6xl">
            {formatNumber(summary.bugCount)}
          </div>
          <p className="mt-3 text-sm leading-6 text-stone-400">Remaining bugs still open in the queue right now.</p>
        </Surface>

        <Surface className="p-5 sm:p-6" tone="subtle">
          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-stone-500">Days left</p>
          <div className="mt-4 font-[family-name:var(--font-display)] text-5xl leading-none tracking-[-0.06em] text-stone-50 sm:text-6xl">
            {formatNumber(summary.daysUntilDeadline)}
          </div>
          <p className="mt-3 text-sm leading-6 text-stone-400">Runway remaining before the selected deadline.</p>
        </Surface>
      </div>
    </Surface>
  )
}

function AnalysisLead({ description, eyebrow, meta, tag, title, tone = 'default' }) {
  return (
    <Surface className="p-5 sm:p-6" tone={tone}>
      <div className="flex flex-col gap-5">
        <div className="w-full">
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.28em] text-stone-400">{eyebrow}</p>
            {tag ? <StatusTag tone={tone}>{tag}</StatusTag> : null}
          </div>
          <h3 className="mt-3 font-[family-name:var(--font-display)] text-3xl leading-tight tracking-[-0.04em] text-stone-50 sm:text-[2.3rem]">
            {title}
          </h3>
          <p className="mt-3 w-full text-sm leading-7 text-stone-200 sm:text-base">{description}</p>
          {meta ? <p className="mt-4 text-sm leading-6 text-stone-400">{meta}</p> : null}
        </div>
      </div>
    </Surface>
  )
}

function OverviewView({ deadlineMetrics, summary }) {
  const metricTone = deadlineMetrics.statusTone

  return (
    <div className="grid gap-8">
      <AnalysisLead
        description={`${formatNumber(summary.currentNetBurnRate, 2)}/day current burn against ${formatNumber(deadlineMetrics.neededNetBurnRate, 2)}/day required.`}
        eyebrow="Overview"
        meta={null}
        tag={getStatusTagText(metricTone)}
        title={deadlineMetrics.statusHeadline}
        tone={metricTone}
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          hint={`Days remaining to reach zero by ${summary.deadlineLabel}.`}
          label="Days left"
          tone={metricTone}
          value={formatNumber(summary.daysUntilDeadline)}
        />
        <MetricCard
          hint="Recent fixes per day minus recent created bugs per day."
          label="Current net burn"
          tone={metricTone}
          value={`${formatNumber(summary.currentNetBurnRate, 2)}/day`}
        />
        <MetricCard
          hint="Required daily net backlog reduction to hit zero by the selected deadline."
          label="Required net burn"
          tone={metricTone}
          value={`${formatNumber(deadlineMetrics.neededNetBurnRate, 2)}/day`}
        />
        <MetricCard
          hint="Confidence rises when current net burn stays above the required burn."
          label="Confidence"
          tone={metricTone}
          value={formatPercent(summary.likelihoodScore)}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(340px,0.85fr)]">
        <ChartCard
          className="min-h-[420px]"
          data={buildDeadlineBurndownChartData(deadlineMetrics)}
          description={`Stay on or under the ideal path to reach zero by ${summary.deadlineLabel}.`}
          title="Burndown to zero"
        />
        <ChartCard
          className="min-h-[420px]"
          data={buildPriorityChartData(deadlineMetrics)}
          description="Urgent and high-priority share of the remaining queue."
          title="Open bugs by priority"
          variant="bar"
        />
      </div>
    </div>
  )
}

function PeriodsView({ comparisonMetrics }) {
  const createdTone = getMetricTone(comparisonMetrics.currentWindow.created, comparisonMetrics.previousWindow?.created ?? null, false)
  const completedTone = getMetricTone(comparisonMetrics.currentWindow.fixed, comparisonMetrics.previousWindow?.fixed ?? null, true)
  const netChangeTone = getNetChangeTone(comparisonMetrics.currentWindow.netChange)
  const completionRateTone = getMetricTone(comparisonMetrics.currentWindow.completionRate, comparisonMetrics.previousWindow?.completionRate ?? null, true)

  return (
    <div className="grid gap-8">
      <AnalysisLead
        description={comparisonMetrics.body}
        eyebrow="Periods"
        meta={`Current window ${comparisonMetrics.rangeLabel}${comparisonMetrics.previousWindow ? ` · Previous window ${comparisonMetrics.previousWindow.label}` : ''}.`}
        tag={getStatusTagText(comparisonMetrics.tone)}
        title={comparisonMetrics.headline}
        tone={comparisonMetrics.tone}
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          hint="New bugs added during the selected period. Lower is better."
          label="Bugs created"
          tone={createdTone}
          value={formatNumber(comparisonMetrics.currentWindow.created)}
        />
        <MetricCard
          hint="Bugs completed during the selected period. Higher is better."
          label="Bugs completed"
          tone={completedTone}
          value={formatNumber(comparisonMetrics.currentWindow.fixed)}
        />
        <MetricCard
          hint="Created minus completed during the selected period."
          label="Net change"
          tone={netChangeTone}
          value={formatSignedNumber(comparisonMetrics.currentWindow.netChange)}
        />
        <MetricCard
          hint="Completion rate helps normalize periods with different intake volume."
          label="Completion rate"
          tone={completionRateTone}
          value={formatPercent(comparisonMetrics.currentWindow.completionRate, 1)}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(340px,0.85fr)]">
        <ChartCard
          className="min-h-[420px]"
          data={buildComparisonTimelineChartData(comparisonMetrics)}
          description="Created and completed lines show raw volume, while the moving averages reveal whether intake is structurally running above output or if a single spike is distorting the read."
          title="Created vs completed over time"
        />
        <ChartCard
          className="min-h-[420px]"
          data={buildComparisonSummaryChartData(comparisonMetrics)}
          description="This stacked comparison makes the current period legible against the previous one. Look for falling created volume, rising completed volume, and a more negative net change if the process is improving."
          title="Current vs previous window"
          variant="bar"
        />
      </div>
    </div>
  )
}

function App() {
  const { metrics, error, refreshMetrics } = useMetrics()
  const [activeTab, setActiveTab] = useState('overview')
  const [deadlineDate, setDeadlineDate] = useState(() => readStoredDate(DEADLINE_STORAGE_KEY, format(endOfYear(new Date()), 'yyyy-MM-dd')))
  const [deadlineFromDate, setDeadlineFromDate] = useState(() => readStoredDate(DEADLINE_FROM_STORAGE_KEY, format(subDays(new Date(), 29), 'yyyy-MM-dd')))
  const [compareRangeKey, setCompareRangeKey] = useState('30')
  const [customFromDate, setCustomFromDate] = useState(() => format(subDays(new Date(), 29), 'yyyy-MM-dd'))
  const [customToDate, setCustomToDate] = useState(() => format(new Date(), 'yyyy-MM-dd'))
  const [syncMessage, setSyncMessage] = useState('')

  const deadlineMetrics = getDeadlineMetrics(metrics, { deadlineDate, trackingStartDate: deadlineFromDate })
  const comparisonMetrics = getComparisonMetrics(metrics, { rangeKey: compareRangeKey, customFromDate, customToDate })
  const summary = getSummaryMetrics(deadlineMetrics)
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

  const backgroundStyle = {
    positive: {
      top: 'bg-[radial-gradient(circle_at_16%_14%,rgba(16,185,129,0.12),transparent_28%),radial-gradient(circle_at_82%_10%,rgba(56,189,248,0.1),transparent_22%)]',
      left: 'bg-emerald-500/8',
      right: 'bg-sky-500/8',
    },
    negative: {
      top: 'bg-[radial-gradient(circle_at_16%_14%,rgba(239,68,68,0.12),transparent_28%),radial-gradient(circle_at_82%_10%,rgba(56,189,248,0.06),transparent_22%)]',
      left: 'bg-red-500/8',
      right: 'bg-sky-500/6',
    },
    neutral: {
      top: 'bg-[radial-gradient(circle_at_16%_14%,rgba(56,189,248,0.1),transparent_28%),radial-gradient(circle_at_82%_10%,rgba(20,184,166,0.06),transparent_22%)]',
      left: 'bg-sky-500/7',
      right: 'bg-teal-500/6',
    },
  }[deadlineMetrics.statusTone] ?? {
    top: 'bg-[radial-gradient(circle_at_16%_14%,rgba(56,189,248,0.1),transparent_28%),radial-gradient(circle_at_82%_10%,rgba(20,184,166,0.06),transparent_22%)]',
    left: 'bg-sky-500/7',
    right: 'bg-teal-500/6',
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#050608]">
      <div className={cn('pointer-events-none absolute inset-x-0 top-0 h-[26rem]', backgroundStyle.top)} />
      <div className={cn('pointer-events-none absolute left-[-7rem] top-[20rem] h-72 w-72 rounded-full blur-3xl', backgroundStyle.left)} />
      <div className={cn('pointer-events-none absolute bottom-[-2rem] right-[-5rem] h-80 w-80 rounded-full blur-3xl', backgroundStyle.right)} />

      <div className="relative mx-auto flex min-h-screen w-full max-w-[1380px] flex-col gap-8 px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.28em] text-stone-500">Operations dashboard</p>
            <h1 className="mt-3 font-[family-name:var(--font-display)] text-5xl leading-[0.92] tracking-[-0.06em] text-stone-50 sm:text-6xl xl:text-7xl">
              Race to Zero Bugs
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-stone-400 sm:text-lg">
              Keep the backlog read fast, make trend changes obvious, and turn the numbers into decisions the team can act on.
            </p>
          </div>

          <SyncButton
            isSyncing={isSyncing}
            lastSyncedLabel={lastUpdatedTooltip}
            onClick={triggerSync}
            relativeLabel={lastUpdatedLabel}
            snapshotUrl={metricsUrl}
            statusMessage={syncMessage}
          />
        </header>

        <TopNav
          activeTab={activeTab}
          compareRangeKey={compareRangeKey}
          customFromDate={customFromDate}
          customToDate={customToDate}
          deadlineDate={deadlineDate}
          deadlineFromDate={deadlineFromDate}
          onCompareRangeChange={setCompareRangeKey}
          onCustomFromDateChange={(event) => setCustomFromDate(event.target.value)}
          onCustomToDateChange={(event) => setCustomToDate(event.target.value)}
          onDeadlineDateChange={(event) => setDeadlineDate(event.target.value)}
          onDeadlineFromDateChange={(event) => setDeadlineFromDate(event.target.value)}
          onTabChange={setActiveTab}
          todayDate={todayDate}
        />

        <CommandCenter deadlineMetrics={deadlineMetrics} summary={summary} />

        <main className="grid gap-8 pb-10">
          {activeTab === 'overview' ? (
            <OverviewView
              deadlineMetrics={deadlineMetrics}
              summary={summary}
            />
          ) : null}

          {activeTab === 'periods' ? (
            <PeriodsView
              comparisonMetrics={comparisonMetrics}
            />
          ) : null}

          {(error || syncError) ? <StatusBanner kind="error">{syncError || error}</StatusBanner> : null}
          {!error && !syncError && syncMessage && isSyncing ? <StatusBanner>{syncMessage}</StatusBanner> : null}
        </main>
      </div>
    </div>
  )
}

export default App
