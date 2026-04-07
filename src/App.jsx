import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { endOfYear, format, subDays } from 'date-fns'
import ChartCard from './components/ChartCard.jsx'
import BugSettingsMenu from './components/BugSettingsMenu.jsx'
import CommandCenter from './components/CommandCenter.jsx'
import BackgroundField from './components/BackgroundField.jsx'
import MetricCard from './components/MetricCard.jsx'
import SettingsMenu from './components/SettingsMenu.jsx'
import TopNav from './components/TopNav.jsx'
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
const BUG_SIZE_STORAGE_KEY = 'race-to-zero:bug-size-multiplier'
const BUG_CHAOS_STORAGE_KEY = 'race-to-zero:bug-chaos-multiplier'

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

const OverviewView = memo(function OverviewView({ deadlineMetrics, summary, workdaySettings }) {
  const metricTone = deadlineMetrics.statusTone
  const isWorkdayMode = workdaySettings.excludeWeekends || workdaySettings.excludePublicHolidays
  const backlogSummary = summary.currentNetBurnRate > 0
    ? `The backlog is trending downward, but current net burn of ${formatNumber(summary.currentNetBurnRate, 2)}/day is ${summary.currentNetBurnRate >= deadlineMetrics.neededNetBurnRate ? 'holding ahead of' : `still below the ${formatNumber(deadlineMetrics.neededNetBurnRate, 2)}/day needed to close the gap to`} the target path.`
    : `The backlog is not trending downward right now. Current net burn is ${formatNumber(summary.currentNetBurnRate, 2)}/day against ${formatNumber(deadlineMetrics.neededNetBurnRate, 2)}/day needed.`
  const deadlineBurndownData = useMemo(() => buildDeadlineBurndownChartData(deadlineMetrics), [deadlineMetrics])
  const priorityChartData = useMemo(() => buildPriorityChartData(deadlineMetrics), [deadlineMetrics])

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
          chartKey="bug-burndown"
          className="min-h-[420px]"
          data={deadlineBurndownData}
          summary={backlogSummary}
          title="Bug burndown"
        />
        <ChartCard
          chartKey="priority-breakdown"
          className="min-h-[420px]"
          data={priorityChartData}
          description="Breakdown of the open backlog by priority so the biggest risk pockets are visible without hovering."
          title="Open bugs by priority"
          variant="bar"
        />
      </div>
    </div>
  )
})

const PeriodsView = memo(function PeriodsView({ comparisonMetrics }) {
  const createdTone = getMetricTone(comparisonMetrics.currentWindow.created, comparisonMetrics.previousWindow?.created ?? null, false)
  const completedTone = comparisonMetrics.currentWindow.fixed > comparisonMetrics.currentWindow.created
    ? 'positive'
    : comparisonMetrics.currentWindow.fixed === comparisonMetrics.currentWindow.created
      ? 'neutral'
      : getMetricTone(comparisonMetrics.currentWindow.fixed, comparisonMetrics.previousWindow?.fixed ?? null, true)
  const netChangeTone = getNetChangeTone(comparisonMetrics.currentWindow.netChange)
  const completionRateTone = comparisonMetrics.currentWindow.completionRate > 100
    ? 'positive'
    : Math.abs(comparisonMetrics.currentWindow.completionRate - 100) < 0.01
      ? 'neutral'
      : getMetricTone(comparisonMetrics.currentWindow.completionRate, comparisonMetrics.previousWindow?.completionRate ?? null, true)
  const comparisonTimelineData = useMemo(() => buildComparisonTimelineChartData(comparisonMetrics), [comparisonMetrics])
  const comparisonSummaryData = useMemo(() => buildComparisonSummaryChartData(comparisonMetrics), [comparisonMetrics])

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
          chartKey="comparison-timeline"
          className="min-h-[420px]"
          data={comparisonTimelineData}
          summary="Compare daily intake against completions to see whether recent periods are relieving pressure or letting backlog build."
          title="Created vs completed over time"
        />
        <ChartCard
          chartKey="comparison-summary"
          className="min-h-[420px]"
          data={comparisonSummaryData}
          description="Each x-axis group is one metric type, with current and previous period bars paired so the change is easy to read."
          summary="These bars compare the current period with the previous one across intake, completions, net movement, and completion rate."
          title="Current vs previous window"
          variant="bar"
        />
      </div>
    </div>
  )
})

function App() {
  const { metrics, error } = useMetrics()
  const [activeTab, setActiveTab] = useState('overview')
  const [deadlineDate, setDeadlineDate] = useState(() => readStoredDate(DEADLINE_STORAGE_KEY, format(endOfYear(new Date()), 'yyyy-MM-dd')))
  const [deadlineFromDate, setDeadlineFromDate] = useState(() => readStoredDate(DEADLINE_FROM_STORAGE_KEY, format(subDays(new Date(), 29), 'yyyy-MM-dd')))
  const [excludeWeekends, setExcludeWeekends] = useState(() => readStoredFlag(EXCLUDE_WEEKENDS_STORAGE_KEY, false))
  const [excludePublicHolidays, setExcludePublicHolidays] = useState(() => readStoredFlag(EXCLUDE_HOLIDAYS_STORAGE_KEY, false))
  const [showParticleCount, setShowParticleCount] = useState(() => readStoredFlag(SHOW_PARTICLE_COUNT_STORAGE_KEY, true))
  const [openTopMenu, setOpenTopMenu] = useState(null)
  const [bugSizeMultiplier, setBugSizeMultiplier] = useState(() => {
    const storedValue = typeof window !== 'undefined' ? window.localStorage.getItem(BUG_SIZE_STORAGE_KEY) : null
    const numericValue = Number(storedValue)
    return Number.isFinite(numericValue) && numericValue > 0 ? numericValue : 3.5
  })
  const [bugChaosMultiplier, setBugChaosMultiplier] = useState(() => {
    const storedValue = typeof window !== 'undefined' ? window.localStorage.getItem(BUG_CHAOS_STORAGE_KEY) : null
    const numericValue = Number(storedValue)
    return Number.isFinite(numericValue) && numericValue > 0 ? numericValue : 2.5
  })
  const [compareRangeKey, setCompareRangeKey] = useState('30')
  const [customFromDate, setCustomFromDate] = useState(() => format(subDays(new Date(), 29), 'yyyy-MM-dd'))
  const [customToDate, setCustomToDate] = useState(() => format(new Date(), 'yyyy-MM-dd'))
  const settingsMenuRef = useRef(null)
  const bugSettingsMenuRef = useRef(null)

  const workdaySettings = useMemo(() => ({
    excludePublicHolidays,
    excludeWeekends,
  }), [excludePublicHolidays, excludeWeekends])

  const deadlineMetrics = useMemo(
    () => getDeadlineMetrics(metrics, { deadlineDate, trackingStartDate: deadlineFromDate, workdaySettings }),
    [deadlineDate, deadlineFromDate, metrics, workdaySettings],
  )
  const comparisonMetrics = useMemo(
    () => getComparisonMetrics(metrics, { rangeKey: compareRangeKey, customFromDate, customToDate }),
    [compareRangeKey, customFromDate, customToDate, metrics],
  )
  const summary = useMemo(() => getSummaryMetrics(deadlineMetrics), [deadlineMetrics])
  const todayDate = format(new Date(), 'yyyy-MM-dd')

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

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(BUG_SIZE_STORAGE_KEY, String(bugSizeMultiplier))
    }
  }, [bugSizeMultiplier])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(BUG_CHAOS_STORAGE_KEY, String(bugChaosMultiplier))
    }
  }, [bugChaosMultiplier])

  const settings = useMemo(() => ({
    excludePublicHolidays,
    excludeWeekends,
    showParticleCount,
  }), [excludePublicHolidays, excludeWeekends, showParticleCount])
  const bugVisualSettings = useMemo(() => ({
    chaosMultiplier: bugChaosMultiplier,
    sizeMultiplier: bugSizeMultiplier,
  }), [bugChaosMultiplier, bugSizeMultiplier])

  const handleToggleSetting = useCallback((settingKey) => {
    if (settingKey === 'excludeWeekends') {
      setExcludeWeekends((currentValue) => !currentValue)
    }

    if (settingKey === 'excludePublicHolidays') {
      setExcludePublicHolidays((currentValue) => !currentValue)
    }

    if (settingKey === 'showParticleCount') {
      setShowParticleCount((currentValue) => !currentValue)
    }
  }, [])

  const handleBugVisualSetting = useCallback((settingKey, value) => {
    if (settingKey === 'sizeMultiplier') {
      setBugSizeMultiplier(value)
    }

    if (settingKey === 'chaosMultiplier') {
      setBugChaosMultiplier(value)
    }
  }, [])

  const handleTopMenuToggle = useCallback((menuKey) => {
    setOpenTopMenu((currentValue) => (currentValue === menuKey ? null : menuKey))
  }, [])

  const handleTopNavInteract = useCallback(() => {
    setOpenTopMenu(null)
  }, [])

  const handleCompareRangeChange = useCallback((value) => {
    setOpenTopMenu(null)
    setCompareRangeKey(value)
  }, [])

  const handleCustomFromDateChange = useCallback((event) => {
    setOpenTopMenu(null)
    setCustomFromDate(event.target.value)
  }, [])

  const handleCustomToDateChange = useCallback((event) => {
    setOpenTopMenu(null)
    setCustomToDate(event.target.value)
  }, [])

  const handleDeadlineDateChange = useCallback((event) => {
    setOpenTopMenu(null)
    setDeadlineDate(event.target.value)
  }, [])

  const handleDeadlineFromDateChange = useCallback((event) => {
    setOpenTopMenu(null)
    setDeadlineFromDate(event.target.value)
  }, [])

  const handleTabChange = useCallback((tabId) => {
    setOpenTopMenu(null)
    setActiveTab(tabId)
  }, [])

  useEffect(() => {
    if (!openTopMenu) {
      return undefined
    }

    const menuRefs = {
      bugs: bugSettingsMenuRef,
      settings: settingsMenuRef,
    }

    const handlePointerDown = (event) => {
      const activeMenuRef = menuRefs[openTopMenu]
      const targetNode = event.target

      if (!(targetNode instanceof Node)) {
        return
      }

      if (activeMenuRef?.current && !activeMenuRef.current.contains(targetNode)) {
        setOpenTopMenu(null)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('touchstart', handlePointerDown)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('touchstart', handlePointerDown)
    }
  }, [openTopMenu])

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#050608]">
      <BackgroundField bugCount={summary.bugCount} bugVisualSettings={bugVisualSettings} showParticleCount={showParticleCount} tone={deadlineMetrics.statusTone} />

      <div className="relative mx-auto flex min-h-screen w-full max-w-[1380px] flex-col gap-8 px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.28em] text-stone-500">Operations dashboard</p>
            <h1 className="mt-2 font-[family-name:var(--font-display)] text-4xl leading-[0.94] tracking-[-0.06em] text-stone-50 sm:text-5xl xl:text-6xl">
              Race to Zero Bugs
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-stone-400 sm:text-base">
              Current pace against the zero-bug deadline.
            </p>
          </div>

          <div className="flex items-center gap-2 self-end lg:self-auto">
            <SettingsMenu containerRef={settingsMenuRef} onMenuToggle={() => handleTopMenuToggle('settings')} onToggle={handleToggleSetting} open={openTopMenu === 'settings'} settings={settings} />
            <BugSettingsMenu bugVisualSettings={bugVisualSettings} containerRef={bugSettingsMenuRef} onChange={handleBugVisualSetting} onMenuToggle={() => handleTopMenuToggle('bugs')} onToggle={handleToggleSetting} open={openTopMenu === 'bugs'} showParticleCount={showParticleCount} />
          </div>
        </header>

        <TopNav
          activeTab={activeTab}
          compareRangeKey={compareRangeKey}
          customFromDate={customFromDate}
          customToDate={customToDate}
          deadlineDate={deadlineDate}
          deadlineFromDate={deadlineFromDate}
          onInteract={handleTopNavInteract}
          onCompareRangeChange={handleCompareRangeChange}
          onCustomFromDateChange={handleCustomFromDateChange}
          onCustomToDateChange={handleCustomToDateChange}
          onDeadlineDateChange={handleDeadlineDateChange}
          onDeadlineFromDateChange={handleDeadlineFromDateChange}
          onTabChange={handleTabChange}
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

          {error ? <StatusBanner kind="error">{error}</StatusBanner> : null}
        </main>
      </div>
    </div>
  )
}

export default App
