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

function getDateInputBounds(min, max) {
  if (min && max && min > max) {
    return {}
  }

  return { min, max }
}

function CompactDateField({ label, value, onChange, min, max, disabled = false }) {
  const bounds = getDateInputBounds(min, max)

  return (
    <label
      className={cn(
        'flex h-10 min-w-[146px] items-center gap-2 rounded-full border border-white/6 bg-white/[0.02] px-3 text-sm shadow-[0_8px_18px_rgba(0,0,0,0.1)] transition duration-200 backdrop-blur-xl',
        disabled ? 'cursor-default opacity-38' : 'hover:border-white/10 hover:bg-white/[0.04]',
      )}
    >
      <span className="shrink-0 text-[0.66rem] font-semibold uppercase tracking-[0.18em] text-stone-500">{label}</span>
      <input
        className="min-w-0 flex-1 bg-transparent text-sm font-medium text-stone-100 outline-none disabled:cursor-default"
        disabled={disabled}
        max={bounds.max}
        min={bounds.min}
        onChange={onChange}
        type="date"
        value={value}
      />
    </label>
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
              'h-10 rounded-full border px-4 text-sm font-semibold transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/40',
              isActive
                ? 'border-sky-400/24 bg-sky-400/8 text-sky-100 shadow-[inset_0_0_0_1px_rgba(56,189,248,0.12)]'
                : 'border-white/6 bg-zinc-950/60 text-stone-400 hover:-translate-y-0.5 hover:border-white/10 hover:bg-zinc-900/88 hover:text-stone-100',
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

function Fireflies({ tone }) {
  const palette = {
    positive: ['rgba(16,185,129,0.6)', 'rgba(56,189,248,0.45)', 'rgba(167,243,208,0.36)'],
    negative: ['rgba(239,68,68,0.5)', 'rgba(56,189,248,0.35)', 'rgba(253,186,116,0.28)'],
    neutral: ['rgba(56,189,248,0.48)', 'rgba(20,184,166,0.38)', 'rgba(186,230,253,0.24)'],
  }[tone] ?? ['rgba(56,189,248,0.48)', 'rgba(20,184,166,0.38)', 'rgba(186,230,253,0.24)']

  const particles = [
    { x: '10%', y: '16%', size: '5px', duration: '10s', delay: '0s', driftX: '18px', color: palette[0] },
    { x: '24%', y: '34%', size: '4px', duration: '12s', delay: '2s', driftX: '-22px', color: palette[1] },
    { x: '72%', y: '12%', size: '6px', duration: '9s', delay: '1s', driftX: '14px', color: palette[0] },
    { x: '84%', y: '38%', size: '4px', duration: '13s', delay: '4s', driftX: '-18px', color: palette[2] },
    { x: '18%', y: '72%', size: '5px', duration: '11s', delay: '3s', driftX: '20px', color: palette[2] },
    { x: '68%', y: '76%', size: '5px', duration: '14s', delay: '5s', driftX: '-16px', color: palette[1] },
    { x: '33%', y: '18%', size: '4px', duration: '15s', delay: '6s', driftX: '12px', color: palette[2] },
    { x: '46%', y: '62%', size: '3px', duration: '9s', delay: '1.5s', driftX: '-14px', color: palette[0] },
    { x: '58%', y: '28%', size: '5px', duration: '12s', delay: '2.5s', driftX: '10px', color: palette[1] },
    { x: '78%', y: '58%', size: '4px', duration: '16s', delay: '7s', driftX: '-20px', color: palette[0] },
    { x: '8%', y: '48%', size: '3px', duration: '11s', delay: '2.2s', driftX: '16px', color: palette[1] },
    { x: '90%', y: '80%', size: '5px', duration: '13s', delay: '5.2s', driftX: '-12px', color: palette[2] },
    { x: '14%', y: '24%', size: '3px', duration: '14s', delay: '0.8s', driftX: '24px', color: palette[2] },
    { x: '29%', y: '56%', size: '5px', duration: '17s', delay: '3.5s', driftX: '-12px', color: palette[0] },
    { x: '41%', y: '10%', size: '4px', duration: '12.5s', delay: '1.8s', driftX: '18px', color: palette[1] },
    { x: '52%', y: '44%', size: '3px', duration: '15s', delay: '4.4s', driftX: '-24px', color: palette[2] },
    { x: '63%', y: '68%', size: '6px', duration: '18s', delay: '2.9s', driftX: '14px', color: palette[0] },
    { x: '74%', y: '22%', size: '3px', duration: '10.5s', delay: '5.6s', driftX: '-10px', color: palette[1] },
    { x: '86%', y: '52%', size: '4px', duration: '13.5s', delay: '6.1s', driftX: '22px', color: palette[2] },
    { x: '6%', y: '84%', size: '4px', duration: '16.5s', delay: '2.7s', driftX: '12px', color: palette[0] },
    { x: '37%', y: '80%', size: '3px', duration: '11.5s', delay: '7.3s', driftX: '-16px', color: palette[1] },
    { x: '57%', y: '16%', size: '5px', duration: '14.5s', delay: '3.2s', driftX: '20px', color: palette[2] },
    { x: '69%', y: '88%', size: '3px', duration: '12.8s', delay: '1.1s', driftX: '-18px', color: palette[0] },
    { x: '94%', y: '32%', size: '4px', duration: '15.8s', delay: '4.9s', driftX: '-14px', color: palette[1] },
  ]

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {particles.map((particle, index) => (
        <span
          key={index}
          className="app-firefly"
          style={{
            '--firefly-x': particle.x,
            '--firefly-y': particle.y,
            '--firefly-size': particle.size,
            '--firefly-duration': particle.duration,
            '--firefly-delay': particle.delay,
            '--firefly-drift-x': particle.driftX,
            '--firefly-color': particle.color,
          }}
        />
      ))}
    </div>
  )
}

function BugField({ bugCount, tone }) {
  const colors = {
    positive: {
      bug: 'rgba(167,243,208,0.2)',
      orbA: 'rgba(16,185,129,0.1)',
      orbB: 'rgba(56,189,248,0.08)',
    },
    negative: {
      bug: 'rgba(254,202,202,0.18)',
      orbA: 'rgba(239,68,68,0.1)',
      orbB: 'rgba(56,189,248,0.07)',
    },
    neutral: {
      bug: 'rgba(186,230,253,0.18)',
      orbA: 'rgba(56,189,248,0.09)',
      orbB: 'rgba(20,184,166,0.07)',
    },
  }[tone] ?? {
    bug: 'rgba(186,230,253,0.18)',
    orbA: 'rgba(56,189,248,0.09)',
    orbB: 'rgba(20,184,166,0.07)',
  }

  const totalBugs = Math.max(0, Math.floor(bugCount))
  const particles = Array.from({ length: totalBugs }, (_, index) => {
    const x = ((index * 37.17) % 100).toFixed(2)
    const y = ((index * 19.73 + Math.floor(index / 7) * 3.4) % 100).toFixed(2)
    const size = 9 + (index % 5)
    const duration = 18 + (index % 11)
    const delay = ((index % 17) * 0.37).toFixed(2)
    const driftX = ((index % 9) - 4) * 7
    const driftY = ((index % 7) - 3) * 6
    const rotate = (index * 29) % 360
    const opacity = (0.035 + (index % 4) * 0.012).toFixed(3)

    return {
      delay: `${delay}s`,
      driftX: `${driftX}px`,
      driftY: `${driftY}px`,
      duration: `${duration}s`,
      opacity,
      rotate: `${rotate}deg`,
      size: `${size}px`,
      x: `${x}%`,
      y: `${y}%`,
    }
  })

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <div className="absolute left-[-10rem] top-[8rem] h-72 w-72 rounded-full blur-3xl" style={{ backgroundColor: colors.orbA }} />
      <div className="absolute right-[-8rem] top-[24rem] h-80 w-80 rounded-full blur-3xl" style={{ backgroundColor: colors.orbB }} />
      <div className="absolute bottom-[-8rem] left-[18%] h-72 w-72 rounded-full blur-3xl" style={{ backgroundColor: colors.orbB }} />
      <Fireflies tone={tone} />
      {particles.map((particle, index) => (
        <span
          key={index}
          className="app-bug-particle"
          style={{
            '--bug-color': colors.bug,
            '--bug-delay': particle.delay,
            '--bug-drift-x': particle.driftX,
            '--bug-drift-y': particle.driftY,
            '--bug-duration': particle.duration,
            '--bug-opacity': particle.opacity,
            '--bug-rotate': particle.rotate,
            '--bug-size': particle.size,
            '--bug-x': particle.x,
            '--bug-y': particle.y,
          }}
        >
          <svg aria-hidden="true" className="app-bug-icon" viewBox="0 0 24 24">
            <circle cx="12" cy="7" r="2.3" fill="currentColor" />
            <ellipse cx="12" cy="14" rx="4.4" ry="6" fill="currentColor" />
            <path d="M9 10 5.8 7.8M15 10l3.2-2.2M8 13H4.8M16 13h3.2M9 16l-3.2 2.2M15 16l3.2 2.2" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.4" />
          </svg>
        </span>
      ))}
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
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <Tabs activeTab={activeTab} onChange={onTabChange} tabs={TAB_ITEMS} />

      {activeTab === 'overview' ? (
        <div className="flex flex-wrap gap-2 lg:justify-end">
          <CompactDateField
            label="From"
            max={deadlineDate}
            onChange={onDeadlineFromDateChange}
            value={deadlineFromDate}
          />
          <CompactDateField
            label="Deadline"
            min={todayDate}
            onChange={onDeadlineDateChange}
            value={deadlineDate}
          />
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
          <CompareRangePicker compareRangeKey={compareRangeKey} onChange={onCompareRangeChange} />
          {compareRangeKey === 'custom' ? (
            <>
              <CompactDateField
                label="From"
                max={customToDate}
                onChange={onCustomFromDateChange}
                value={customFromDate}
              />
              <CompactDateField
                label="To"
                min={customFromDate}
                onChange={onCustomToDateChange}
                value={customToDate}
              />
            </>
          ) : null}
        </div>
      )}
    </div>
  )
}

function CommandCenter({ deadlineMetrics, summary }) {
  const paceGap = summary.currentFixRate - summary.bugsPerDayRequired
  const paceTone = getDeltaTone(paceGap)
  const glowStyles = {
    positive: 'before:bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.14),transparent_42%)] after:bg-[radial-gradient(circle_at_bottom_right,rgba(56,189,248,0.1),transparent_38%)]',
    negative: 'before:bg-[radial-gradient(circle_at_top_left,rgba(239,68,68,0.14),transparent_42%)] after:bg-[radial-gradient(circle_at_bottom_right,rgba(56,189,248,0.08),transparent_38%)]',
    neutral: 'before:bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.14),transparent_42%)] after:bg-[radial-gradient(circle_at_bottom_right,rgba(20,184,166,0.08),transparent_38%)]',
  }[deadlineMetrics.statusTone] ?? 'before:bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.14),transparent_42%)] after:bg-[radial-gradient(circle_at_bottom_right,rgba(20,184,166,0.08),transparent_38%)]'

  return (
    <Surface className={cn('relative border-white/10 p-5 before:pointer-events-none before:absolute before:inset-0 before:rounded-[28px] before:opacity-100 after:pointer-events-none after:absolute after:inset-0 after:rounded-[28px] after:opacity-100', glowStyles)} tone="strong">
      <div className="relative">
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
      </div>
    </Surface>
  )
}

function OverviewView({ deadlineMetrics, summary }) {
  const metricTone = deadlineMetrics.statusTone

  return (
    <div className="grid gap-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard
          hint="Current open backlog size. This same number drives the animated bug field in the background."
          label="Open bugs"
          tone={metricTone}
          value={formatNumber(summary.bugCount)}
        />
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
          title="Burndown to zero"
        />
        <ChartCard
          className="min-h-[420px]"
          data={buildPriorityChartData(deadlineMetrics)}
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
    <div className="grid gap-6">
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
          title="Created vs completed over time"
        />
        <ChartCard
          className="min-h-[420px]"
          data={buildComparisonSummaryChartData(comparisonMetrics)}
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

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#050608]">
      <BugField bugCount={summary.bugCount} tone={deadlineMetrics.statusTone} />

      <div className="relative mx-auto flex min-h-screen w-full max-w-[1380px] flex-col gap-8 px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.28em] text-stone-500">Operations dashboard</p>
            <h1 className="mt-2 font-[family-name:var(--font-display)] text-4xl leading-[0.94] tracking-[-0.06em] text-stone-50 sm:text-5xl xl:text-6xl">
              Race to Zero Bugs
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-stone-400 sm:text-base">
              One question first: are we on pace to hit zero bugs by the deadline?
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
