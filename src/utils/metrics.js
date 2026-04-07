import {
  addDays,
  compareAsc,
  differenceInCalendarDays,
  eachDayOfInterval,
  endOfYear,
  format,
  isBefore,
  isValid,
  parseISO,
  startOfDay,
  subDays,
} from 'date-fns'

const DEADLINE_TREND_WINDOW_DAYS = 30

function normalizeBugRecords(source) {
  return [...(source?.bugs ?? [])]
    .map((entry) => ({
      createdAt: entry.createdAt,
      completedAt: entry.completedAt || null,
      priority: Number(entry.priority ?? 0),
      stateName: entry.stateName ?? null,
      stateType: entry.stateType ?? null,
    }))
    .filter((entry) => Boolean(entry.createdAt))
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
}

function getPriorityLabel(priority) {
  switch (priority) {
    case 1:
      return 'Urgent'
    case 2:
      return 'High'
    case 3:
      return 'Normal'
    case 4:
      return 'Low'
    default:
      return 'Unspecified'
  }
}

function buildPriorityDistribution(bugs) {
  const openBugs = bugs.filter((bug) => !bug.completedAt)
  const counts = new Map()

  for (const bug of openBugs) {
    const label = getPriorityLabel(bug.priority)
    counts.set(label, (counts.get(label) ?? 0) + 1)
  }

  return ['Urgent', 'High', 'Normal', 'Low', 'Unspecified'].map((label) => ({
    label,
    count: counts.get(label) ?? 0,
  }))
}

function formatLabel(dateValue) {
  return format(parseISO(dateValue), 'MMM d')
}

function getDisplayRangeLabel(startDate, endDate) {
  return `${format(startDate, 'MMM d')} - ${format(endDate, 'MMM d')}`
}

function buildSeriesFromField(bugs, fieldName) {
  const countsByDay = new Map()

  for (const bug of bugs) {
    const value = bug[fieldName]
    if (!value) {
      continue
    }

    countsByDay.set(value, (countsByDay.get(value) ?? 0) + 1)
  }

  return [...countsByDay.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, count]) => ({ date, count }))
}

function buildRemainingSeries(createdPerDay, completedPerDay) {
  const orderedDates = [...new Set([
    ...createdPerDay.map((entry) => entry.date),
    ...completedPerDay.map((entry) => entry.date),
  ])].sort((left, right) => left.localeCompare(right))

  const createdLookup = new Map(createdPerDay.map((entry) => [entry.date, entry.count]))
  const completedLookup = new Map(completedPerDay.map((entry) => [entry.date, entry.count]))
  const remainingPerDay = []
  let runningRemaining = 0

  for (const date of orderedDates) {
    runningRemaining += createdLookup.get(date) ?? 0
    runningRemaining -= completedLookup.get(date) ?? 0
    remainingPerDay.push({ date, count: Math.max(runningRemaining, 0) })
  }

  return remainingPerDay
}

function getOpenBugsAtDate(bugs, date) {
  const dateKey = format(date, 'yyyy-MM-dd')

  return bugs.filter((bug) => {
    if (bug.createdAt > dateKey) {
      return false
    }

    return !bug.completedAt || bug.completedAt > dateKey
  }).length
}

function getDeadlineDate(referenceDate = new Date()) {
  return endOfYear(referenceDate)
}

function getValidDate(dateValue, fallbackDate) {
  if (!dateValue) {
    return fallbackDate
  }

  const parsedDate = parseISO(dateValue)
  return isValid(parsedDate) ? parsedDate : fallbackDate
}

function getNumericRangeDays(rangeDays, fallbackDays = 30) {
  const numericRange = Number(rangeDays)
  return Number.isFinite(numericRange) && numericRange > 0 ? numericRange : fallbackDays
}

function filterSeriesByDateRange(series, startDate, endDate) {
  const startDateKey = format(startDate, 'yyyy-MM-dd')
  const endDateKey = format(endDate, 'yyyy-MM-dd')
  return series.filter((entry) => entry.date >= startDateKey && entry.date <= endDateKey)
}

function getWindowStats(bugs, startDate, endDate) {
  const startKey = format(startDate, 'yyyy-MM-dd')
  const endKey = format(endDate, 'yyyy-MM-dd')
  const dayCount = Math.max(differenceInCalendarDays(endDate, startDate) + 1, 1)
  let created = 0
  let fixed = 0

  for (const bug of bugs) {
    if (bug.createdAt >= startKey && bug.createdAt <= endKey) {
      created += 1
    }

    if (bug.completedAt && bug.completedAt >= startKey && bug.completedAt <= endKey) {
      fixed += 1
    }
  }

  const addRate = created / dayCount
  const fixRate = fixed / dayCount
  const netBurnRate = fixRate - addRate
  const netChange = created - fixed
  const completionRate = created > 0 ? Math.min((fixed / created) * 100, 999) : 0

  return {
    startDate,
    endDate,
    dayCount,
    created,
    fixed,
    addRate,
    fixRate,
    netBurnRate,
    netChange,
    completionRate,
    label: getDisplayRangeLabel(startDate, endDate),
  }
}

function getDeadlineStatus({ remainingBugs, currentNetBurnRate, neededNetBurnRate, daysUntilDeadline }) {
  if (remainingBugs === 0) {
    return {
      tone: 'positive',
      signal: 'On track',
      headline: 'Backlog cleared',
      body: 'The current snapshot shows no remaining bugs in scope.',
    }
  }

  if (daysUntilDeadline === 0) {
    return {
      tone: 'negative',
      signal: 'Behind',
      headline: 'Deadline is today',
      body: 'There is no remaining runway to burn down the current backlog.',
    }
  }

  if (currentNetBurnRate >= neededNetBurnRate) {
    return {
      tone: 'positive',
      signal: 'On track',
      headline: 'Likely to hit the target',
      body: 'Recent fix velocity is strong enough to offset new bugs and still reduce the backlog at the required pace.',
    }
  }

  return {
    tone: 'negative',
    signal: 'Behind',
    headline: 'Off track at current trend',
    body: 'Recent intake is matching or exceeding fixes, so the backlog is not burning down fast enough.',
  }
}

function getLikelihoodScore({ remainingBugs, currentNetBurnRate, neededNetBurnRate, daysUntilDeadline }) {
  if (remainingBugs === 0) {
    return 100
  }

  if (daysUntilDeadline === 0) {
    return 0
  }

  if (neededNetBurnRate <= 0) {
    return currentNetBurnRate > 0 ? 100 : 0
  }

  const ratio = currentNetBurnRate / neededNetBurnRate
  return Math.max(0, Math.min(100, Math.round(ratio * 100)))
}

function createLabelSeries(primarySeries, secondarySeries = []) {
  return [...new Set([
    ...primarySeries.map((entry) => entry.date),
    ...secondarySeries.map((entry) => entry.date),
  ])].sort((left, right) => left.localeCompare(right))
}

function buildMovingAverage(values, windowSize) {
  return values.map((_, index) => {
    const slice = values.slice(Math.max(0, index - windowSize + 1), index + 1)
    const total = slice.reduce((sum, value) => sum + value, 0)
    return Number((total / slice.length).toFixed(2))
  })
}

function getCustomRangeDates(customFromDate, customToDate, today) {
  const startDate = getValidDate(customFromDate, subDays(today, 29))
  const endDate = getValidDate(customToDate, today)

  if (compareAsc(startDate, endDate) === 1) {
    return {
      startDate: endDate,
      endDate,
    }
  }

  return { startDate, endDate }
}

export function getDeadlineMetrics(source, { deadlineDate, trackingStartDate } = {}) {
  const bugs = normalizeBugRecords(source)
  const allCreatedPerDay = buildSeriesFromField(bugs, 'createdAt')
  const allCompletedPerDay = buildSeriesFromField(bugs, 'completedAt')
  const allRemainingPerDay = buildRemainingSeries(allCreatedPerDay, allCompletedPerDay)
  const remainingBugs = bugs.filter((bug) => !bug.completedAt).length
  const today = startOfDay(new Date())
  const defaultDeadline = getDeadlineDate(today)
  const deadline = getValidDate(deadlineDate, defaultDeadline)
  const firstBugDate = bugs[0]?.createdAt ? parseISO(bugs[0].createdAt) : today
  const requestedTrackingStartDate = getValidDate(trackingStartDate, subDays(today, DEADLINE_TREND_WINDOW_DAYS - 1))
  const trackingStart = isBefore(requestedTrackingStartDate, firstBugDate) ? firstBugDate : requestedTrackingStartDate
  const recentCreatedPerDay = filterSeriesByDateRange(allCreatedPerDay, trackingStart, today)
  const recentCompletedPerDay = filterSeriesByDateRange(allCompletedPerDay, trackingStart, today)
  const trendDayCount = Math.max(differenceInCalendarDays(today, trackingStart) + 1, 1)
  const currentAddRate = recentCreatedPerDay.reduce((sum, entry) => sum + entry.count, 0) / trendDayCount
  const currentFixRate = recentCompletedPerDay.reduce((sum, entry) => sum + entry.count, 0) / trendDayCount
  const currentNetBurnRate = currentFixRate - currentAddRate
  const daysUntilDeadline = Math.max(differenceInCalendarDays(deadline, today), 0)
  const neededNetBurnRate = daysUntilDeadline > 0 ? remainingBugs / daysUntilDeadline : remainingBugs
  const bugsPerDayRequired = daysUntilDeadline > 0 ? currentAddRate + neededNetBurnRate : remainingBugs
  const status = getDeadlineStatus({
    remainingBugs,
    currentNetBurnRate,
    neededNetBurnRate,
    daysUntilDeadline,
  })

  return {
    bugs,
    allRemainingPerDay,
    remainingBugs,
    trackingStartDate: trackingStart,
    trackingStartLabel: format(trackingStart, 'MMM d, yyyy'),
    trackingStartBacklog: getOpenBugsAtDate(bugs, trackingStart),
    currentAddRate,
    currentFixRate,
    currentNetBurnRate,
    neededNetBurnRate,
    bugsPerDayRequired,
    daysUntilDeadline,
    deadline,
    deadlineLabel: format(deadline, 'MMM d, yyyy'),
    trendWindowLabel: getDisplayRangeLabel(trackingStart, today),
    statusTone: status.tone,
    statusSignal: status.signal,
    statusHeadline: status.headline,
    statusBody: status.body,
    onTrack: status.tone === 'positive',
    likelihoodScore: getLikelihoodScore({
      remainingBugs,
      currentNetBurnRate,
      neededNetBurnRate,
      daysUntilDeadline,
    }),
    priorityDistribution: buildPriorityDistribution(bugs),
    today,
  }
}

export function buildDeadlineBurndownChartData(deadlineMetrics) {
  const actualHistory = deadlineMetrics.allRemainingPerDay.filter(
    (entry) => entry.date >= format(deadlineMetrics.trackingStartDate, 'yyyy-MM-dd'),
  )
  const historyDates = actualHistory.map((entry) => entry.date)
  const futureDates = compareAsc(deadlineMetrics.today, deadlineMetrics.deadline) === -1
    ? eachDayOfInterval({
        start: addDays(deadlineMetrics.today, 1),
        end: deadlineMetrics.deadline,
      }).map((entry) => format(entry, 'yyyy-MM-dd'))
    : []
  const labels = [...new Set([...historyDates, ...futureDates])]
  const todayKey = format(deadlineMetrics.today, 'yyyy-MM-dd')
  const actualLookup = new Map(actualHistory.map((entry) => [entry.date, entry.count]))
  const idealStartDate = deadlineMetrics.trackingStartDate
  const idealStartCount = deadlineMetrics.trackingStartBacklog
  const idealDuration = Math.max(differenceInCalendarDays(deadlineMetrics.deadline, idealStartDate), 1)

  return {
    labels: labels.map((entry) => formatLabel(entry)),
    datasets: [
      {
        label: 'Actual remaining bugs',
        data: labels.map((entry) => (entry <= todayKey ? actualLookup.get(entry) ?? null : null)),
        borderColor: '#60a5fa',
        backgroundColor: 'rgba(96, 165, 250, 0.14)',
        fill: false,
        tension: 0.22,
        borderWidth: 3,
        pointRadius: 2,
        pointHoverRadius: 4,
      },
      {
        label: 'Ideal line',
        data: labels.map((entry) => {
          const currentDate = parseISO(entry)
          const elapsed = Math.max(differenceInCalendarDays(currentDate, idealStartDate), 0)
          return Math.max(0, Number((idealStartCount - (idealStartCount / idealDuration) * elapsed).toFixed(2)))
        }),
        borderColor: '#22c55e',
        backgroundColor: 'rgba(34, 197, 94, 0.06)',
        borderDash: [6, 6],
        tension: 0,
        borderWidth: 2,
        pointRadius: 0,
      },
    ],
  }
}

export function buildPriorityChartData(metricsWithPriority) {
  return {
    labels: metricsWithPriority.priorityDistribution.map((entry) => entry.label),
    datasets: [
      {
        label: 'Open bugs',
        data: metricsWithPriority.priorityDistribution.map((entry) => entry.count),
        backgroundColor: [
          'rgba(248, 113, 113, 0.78)',
          'rgba(251, 146, 60, 0.78)',
          'rgba(96, 165, 250, 0.78)',
          'rgba(52, 211, 153, 0.78)',
          'rgba(148, 163, 184, 0.72)',
        ],
        borderColor: [
          '#f87171',
          '#fb923c',
          '#60a5fa',
          '#34d399',
          '#94a3b8',
        ],
        borderWidth: 1,
        borderRadius: 8,
      },
    ],
  }
}

export function getComparisonMetrics(source, { rangeKey = '30', customFromDate, customToDate } = {}) {
  const bugs = normalizeBugRecords(source)
  const today = startOfDay(new Date())
  const earliestDate = bugs[0]?.createdAt ? parseISO(bugs[0].createdAt) : today
  const allCreatedPerDay = buildSeriesFromField(bugs, 'createdAt')
  const allCompletedPerDay = buildSeriesFromField(bugs, 'completedAt')
  const isAllTime = rangeKey === 'all'
  const isCustom = rangeKey === 'custom'

  let currentStartDate = earliestDate
  let currentEndDate = today

  if (isCustom) {
    const customDates = getCustomRangeDates(customFromDate, customToDate, today)
    currentStartDate = customDates.startDate
    currentEndDate = customDates.endDate
  } else if (!isAllTime) {
    const selectedDays = getNumericRangeDays(rangeKey, 30)
    currentStartDate = subDays(today, selectedDays - 1)
    currentEndDate = today
  }

  const currentWindow = getWindowStats(bugs, currentStartDate, currentEndDate)
  const hasComparisonWindow = !isAllTime
  const previousWindow = hasComparisonWindow
    ? getWindowStats(
        bugs,
        subDays(currentStartDate, currentWindow.dayCount),
        subDays(currentStartDate, 1),
      )
    : null
  const createdSeries = filterSeriesByDateRange(allCreatedPerDay, currentStartDate, currentEndDate)
  const completedSeries = filterSeriesByDateRange(allCompletedPerDay, currentStartDate, currentEndDate)

  let tone = currentWindow.netChange > 0 ? 'negative' : currentWindow.netChange < 0 ? 'positive' : 'neutral'
  let headline = currentWindow.netChange > 0
    ? 'Backlog grew in the selected period'
    : currentWindow.netChange < 0
      ? 'Backlog shrank in the selected period'
      : 'Created and completed stayed balanced'
  let body = currentWindow.netChange > 0
    ? 'More bugs were created than completed in the selected window, so backlog pressure increased.'
    : currentWindow.netChange < 0
      ? 'More bugs were completed than created in the selected window, so the backlog reduced.'
      : 'Creation and completion were evenly matched in the selected window.'

  if (!hasComparisonWindow) {
    tone = 'neutral'
    headline = 'All-time trend view'
    body = 'All time shows the full bug history for the CP scope. Switch to a fixed or custom range to compare against a previous window.'
  } else if (currentWindow.netChange < previousWindow.netChange) {
    body += ' This is better than the previous comparison window.'
  } else if (currentWindow.netChange > previousWindow.netChange) {
    body += ' This is worse than the previous comparison window.'
  }

  return {
    rangeKey,
    currentWindow,
    previousWindow,
    hasComparisonWindow,
    tone,
    headline,
    body,
    createdSeries,
    completedSeries,
    rangeLabel: isAllTime
      ? 'All time'
      : isCustom
        ? `Custom: ${getDisplayRangeLabel(currentStartDate, currentEndDate)}`
        : `Last ${rangeKey} days`,
  }
}

export function buildComparisonTimelineChartData(comparisonMetrics) {
  const labels = createLabelSeries(comparisonMetrics.createdSeries, comparisonMetrics.completedSeries)
  const createdLookup = new Map(comparisonMetrics.createdSeries.map((entry) => [entry.date, entry.count]))
  const completedLookup = new Map(comparisonMetrics.completedSeries.map((entry) => [entry.date, entry.count]))
  const createdValues = labels.map((entry) => createdLookup.get(entry) ?? 0)
  const completedValues = labels.map((entry) => completedLookup.get(entry) ?? 0)
  const movingAverageWindow = Math.min(7, Math.max(3, Math.floor(labels.length / 5) || 3))

  return {
    labels: labels.map((entry) => formatLabel(entry)),
    datasets: [
      {
        label: 'Created',
        data: createdValues,
        borderColor: '#f87171',
        backgroundColor: 'rgba(248, 113, 113, 0.12)',
        tension: 0.25,
        borderWidth: 2,
        pointRadius: 2,
      },
      {
        label: 'Completed',
        data: completedValues,
        borderColor: '#22c55e',
        backgroundColor: 'rgba(34, 197, 94, 0.12)',
        tension: 0.25,
        borderWidth: 2,
        pointRadius: 2,
      },
      {
        label: `${movingAverageWindow}D created avg`,
        data: buildMovingAverage(createdValues, movingAverageWindow),
        borderColor: '#fda4af',
        borderDash: [5, 4],
        tension: 0.2,
        borderWidth: 2,
        pointRadius: 0,
      },
      {
        label: `${movingAverageWindow}D completed avg`,
        data: buildMovingAverage(completedValues, movingAverageWindow),
        borderColor: '#86efac',
        borderDash: [5, 4],
        tension: 0.2,
        borderWidth: 2,
        pointRadius: 0,
      },
    ],
  }
}

export function buildComparisonSummaryChartData(comparisonMetrics) {
  const datasets = [
    {
      label: 'Current period',
      data: [
        comparisonMetrics.currentWindow.created,
        comparisonMetrics.currentWindow.fixed,
        comparisonMetrics.currentWindow.netChange,
        Number(comparisonMetrics.currentWindow.completionRate.toFixed(2)),
      ],
      backgroundColor: 'rgba(96, 165, 250, 0.78)',
      borderColor: '#60a5fa',
      borderWidth: 1,
      borderRadius: 8,
    },
  ]

  if (comparisonMetrics.previousWindow) {
    datasets.push({
      label: 'Previous period',
      data: [
        comparisonMetrics.previousWindow.created,
        comparisonMetrics.previousWindow.fixed,
        comparisonMetrics.previousWindow.netChange,
        Number(comparisonMetrics.previousWindow.completionRate.toFixed(2)),
      ],
      backgroundColor: 'rgba(244, 114, 182, 0.74)',
      borderColor: '#f472b6',
      borderWidth: 1,
      borderRadius: 8,
    })
  }

  return {
    labels: ['Bugs created', 'Bugs completed', 'Net change', 'Completion rate %'],
    datasets,
  }
}

export function getSummaryMetrics(deadlineMetrics) {
  return {
    bugCount: deadlineMetrics.remainingBugs,
    daysUntilDeadline: deadlineMetrics.daysUntilDeadline,
    bugsPerDayRequired: deadlineMetrics.bugsPerDayRequired,
    currentAddRate: deadlineMetrics.currentAddRate,
    currentFixRate: deadlineMetrics.currentFixRate,
    currentNetBurnRate: deadlineMetrics.currentNetBurnRate,
    onTrack: deadlineMetrics.onTrack,
    deadlineLabel: deadlineMetrics.deadlineLabel,
    trackingStartLabel: deadlineMetrics.trackingStartLabel,
    statusSignal: deadlineMetrics.statusSignal,
    likelihoodScore: deadlineMetrics.likelihoodScore,
  }
}