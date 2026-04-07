import { useEffect, useState } from 'react'
import { endOfYear, format, formatDistanceToNowStrict, subDays } from 'date-fns'
import ChartCard from './components/ChartCard.jsx'
import CommandCenter from './components/CommandCenter.jsx'
import BackgroundField from './components/BackgroundField.jsx'
import MetricCard from './components/MetricCard.jsx'
import SettingsMenu from './components/SettingsMenu.jsx'
import SyncButton from './components/SyncButton.jsx'
import TopNav from './components/TopNav.jsx'
import { useManualSync } from './hooks/useManualSync.js'
import { useMetrics } from './hooks/useMetrics.js'
import {
  formatNumber,
  formatPercent,
  formatSignedNumber,
  getMetricTone,
  getNetChangeTone,
  readStoredDate,
  readStoredFlag,
} from './utils/dashboard.js'
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
const EXCLUDE_WEEKENDS_STORAGE_KEY = 'race-to-zero:exclude-weekends'
const EXCLUDE_HOLIDAYS_STORAGE_KEY = 'race-to-zero:exclude-holidays-awst'
const SHOW_PARTICLE_COUNT_STORAGE_KEY = 'race-to-zero:show-particle-count'

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

function OverviewView({ deadlineMetrics, summary, workdaySettings }) {
  const metricTone = deadlineMetrics.statusTone
  const isWorkdayMode = workdaySettings.excludeWeekends || workdaySettings.excludePublicHolidays

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
          hint={isWorkdayMode ? `Remaining working days to reach zero by ${summary.deadlineLabel}.` : `Days remaining to reach zero by ${summary.deadlineLabel}.`}
          label={isWorkdayMode ? 'Workdays left' : 'Days left'}
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
  const [excludeWeekends, setExcludeWeekends] = useState(() => readStoredFlag(EXCLUDE_WEEKENDS_STORAGE_KEY, false))
  const [excludePublicHolidays, setExcludePublicHolidays] = useState(() => readStoredFlag(EXCLUDE_HOLIDAYS_STORAGE_KEY, false))
  const [showParticleCount, setShowParticleCount] = useState(() => readStoredFlag(SHOW_PARTICLE_COUNT_STORAGE_KEY, true))
  const [compareRangeKey, setCompareRangeKey] = useState('30')
  const [customFromDate, setCustomFromDate] = useState(() => format(subDays(new Date(), 29), 'yyyy-MM-dd'))
  const [customToDate, setCustomToDate] = useState(() => format(new Date(), 'yyyy-MM-dd'))
  const [syncMessage, setSyncMessage] = useState('')

  const workdaySettings = {
    excludePublicHolidays,
    excludeWeekends,
  }

  const deadlineMetrics = getDeadlineMetrics(metrics, { deadlineDate, trackingStartDate: deadlineFromDate, workdaySettings })
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

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(EXCLUDE_WEEKENDS_STORAGE_KEY, String(excludeWeekends))
    }
  }, [excludeWeekends])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(EXCLUDE_HOLIDAYS_STORAGE_KEY, String(excludePublicHolidays))
    }
  }, [excludePublicHolidays])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(SHOW_PARTICLE_COUNT_STORAGE_KEY, String(showParticleCount))
    }
  }, [showParticleCount])

  const settings = {
    excludePublicHolidays,
    excludeWeekends,
    showParticleCount,
  }

  function handleToggleSetting(settingKey) {
    if (settingKey === 'excludeWeekends') {
      setExcludeWeekends((currentValue) => !currentValue)
    }

    if (settingKey === 'excludePublicHolidays') {
      setExcludePublicHolidays((currentValue) => !currentValue)
    }

    if (settingKey === 'showParticleCount') {
      setShowParticleCount((currentValue) => !currentValue)
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#050608]">
      <BackgroundField bugCount={summary.bugCount} showParticleCount={showParticleCount} tone={deadlineMetrics.statusTone} />

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

          <div className="flex items-start gap-3">
            <SettingsMenu onToggle={handleToggleSetting} settings={settings} />
            <SyncButton
              isSyncing={isSyncing}
              lastSyncedLabel={lastUpdatedTooltip}
              onClick={triggerSync}
              relativeLabel={lastUpdatedLabel}
              snapshotUrl={metricsUrl}
              statusMessage={syncMessage}
            />
          </div>
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
              workdaySettings={workdaySettings}
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
