import {
  compareAsc,
  differenceInCalendarDays,
  eachDayOfInterval,
  endOfYear,
  format,
  isBefore,
  isValid,
  parseISO,
  subDays,
} from 'date-fns'

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

function filterSeriesByStartDate(series, startDate) {
  const startDateKey = format(startDate, 'yyyy-MM-dd')
  return series.filter((entry) => entry.date >= startDateKey)
}

function getRangeStartDate(startDate, rangeDays, today) {
  if (rangeDays === 'all') {
    return startDate
  }

  const numericRange = getNumericRangeDays(rangeDays, NaN)
  if (!Number.isFinite(numericRange)) {
    return startDate
  }

  const candidate = subDays(today, numericRange - 1)
  return isBefore(candidate, startDate) ? startDate : candidate
}

function clampTargetWindow(targetFromDate, targetToDate) {
  if (compareAsc(targetFromDate, targetToDate) === 1) {
    return {
      targetFromDate: targetToDate,
      targetToDate,
    }
  }

  return { targetFromDate, targetToDate }
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

  return {
    startDate,
    endDate,
    dayCount,
    created,
    fixed,
    addRate,
    fixRate,
    netBurnRate,
    label: `${format(startDate, 'MMM d')} - ${format(endDate, 'MMM d')}`,
  }
}

function getPaceStatus({ remainingBugs, currentNetBurnRate, neededNetBurnRate, daysUntilDeadline }) {
  if (remainingBugs === 0) {
    return {
      tone: 'positive',
      signal: 'Green',
      headline: 'Backlog cleared',
      body: 'The current snapshot shows no remaining bugs in scope.',
    }
  }

  if (daysUntilDeadline === 0) {
    return {
      tone: 'negative',
      signal: 'Red',
      headline: 'Deadline is today',
      body: 'There is no remaining runway to burn down the current backlog.',
    }
  }

  if (currentNetBurnRate >= neededNetBurnRate) {
    return {
      tone: 'positive',
      signal: 'Green',
      headline: 'Likely to hit the target',
      body: 'Recent fix velocity is strong enough to offset new bugs and still reduce the backlog at the required pace.',
    }
  }

  if (currentNetBurnRate > 0) {
    return {
      tone: 'warning',
      signal: 'Amber',
      headline: 'Improving, but behind plan',
      body: 'The backlog is shrinking, but not quickly enough to hit the selected deadline at the current trend.',
    }
  }

  return {
    tone: 'negative',
    signal: 'Red',
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

export function getDashboardMetrics(source, { deadlineDate, targetFromDate, targetToDate, rangeDays = '30' } = {}) {
  const bugs = normalizeBugRecords(source)
  const allCreatedPerDay = buildSeriesFromField(bugs, 'createdAt')
  const allCompletedPerDay = buildSeriesFromField(bugs, 'completedAt')
  const allRemainingPerDay = buildRemainingSeries(allCreatedPerDay, allCompletedPerDay)
  const remainingBugs = bugs.filter((bug) => !bug.completedAt).length
  const totalBugCount = bugs.length
  const today = new Date()
  const defaultDeadline = getDeadlineDate(today)
  const rawTargetFromDate = getValidDate(targetFromDate, today)
  const rawTargetToDate = getValidDate(targetToDate ?? deadlineDate, defaultDeadline)
  const { targetFromDate: targetStart, targetToDate: targetEnd } = clampTargetWindow(rawTargetFromDate, rawTargetToDate)
  const startDate = bugs[0]?.createdAt ? parseISO(bugs[0].createdAt) : today
  const safeStartDate = isBefore(targetEnd, startDate) ? targetEnd : startDate
  const rangeStartDate = getRangeStartDate(safeStartDate, rangeDays, today)
  const createdPerDay = filterSeriesByStartDate(allCreatedPerDay, rangeStartDate)
  const completedPerDay = filterSeriesByStartDate(allCompletedPerDay, rangeStartDate)
  const remainingPerDay = filterSeriesByStartDate(allRemainingPerDay, rangeStartDate)
  const runwayStart = compareAsc(today, targetStart) === 1 ? today : targetStart
  const daysUntilDeadline = Math.max(differenceInCalendarDays(targetEnd, runwayStart), 0)
  const rangeLength = Math.max(differenceInCalendarDays(today, rangeStartDate) + 1, 1)
  const createdInRange = createdPerDay.reduce((sum, entry) => sum + entry.count, 0)
  const completedInRange = completedPerDay.reduce((sum, entry) => sum + entry.count, 0)
  const currentAddRate = createdInRange / rangeLength
  const currentFixRate = completedInRange / rangeLength
  const currentNetBurnRate = currentFixRate - currentAddRate
  const neededNetBurnRate = daysUntilDeadline > 0 ? remainingBugs / daysUntilDeadline : remainingBugs
  const bugsPerDayRequired = daysUntilDeadline > 0 ? currentAddRate + neededNetBurnRate : remainingBugs
  const paceStatus = getPaceStatus({
    remainingBugs,
    currentNetBurnRate,
    neededNetBurnRate,
    daysUntilDeadline,
  })
  const priorityDistribution = buildPriorityDistribution(bugs)
  const likelihoodScore = getLikelihoodScore({
    remainingBugs,
    currentNetBurnRate,
    neededNetBurnRate,
    daysUntilDeadline,
  })

  return {
    bugs,
    createdPerDay,
    completedPerDay,
    remainingPerDay,
    totalBugCount,
    remainingBugs,
    bugsPerDayRequired,
    currentAddRate,
    currentFixRate,
    currentNetBurnRate,
    neededNetBurnRate,
    daysUntilDeadline,
    createdInRange,
    completedInRange,
    rangeLength,
    rangeStartDate,
    rangeStartLabel: format(rangeStartDate, 'MMM d, yyyy'),
    rangeLabel: rangeDays === 'all' ? 'All time' : `Last ${rangeDays} days`,
    onPace: paceStatus.tone === 'positive',
    paceTone: paceStatus.tone,
    paceSignal: paceStatus.signal,
    paceHeadline: paceStatus.headline,
    paceBody: paceStatus.body,
    priorityDistribution,
    likelihoodScore,
    deadline: targetEnd,
    deadlineLabel: format(targetEnd, 'MMM d, yyyy'),
    targetFromDate: targetStart,
    targetToDate: targetEnd,
    targetFromLabel: format(targetStart, 'MMM d, yyyy'),
    targetToLabel: format(targetEnd, 'MMM d, yyyy'),
    startDate: safeStartDate,
    today,
  }
}

export function buildFlowChartData(dashboardMetrics) {
  const labels = createLabelSeries(dashboardMetrics.createdPerDay, dashboardMetrics.completedPerDay)
  const createdLookup = new Map(dashboardMetrics.createdPerDay.map((entry) => [entry.date, entry.count]))
  const completedLookup = new Map(dashboardMetrics.completedPerDay.map((entry) => [entry.date, entry.count]))

  return {
    labels: labels.map((entry) => formatLabel(entry)),
    datasets: [
      {
        label: 'Created',
        data: labels.map((entry) => createdLookup.get(entry) ?? 0),
        borderColor: '#ff6b6b',
        backgroundColor: 'rgba(255, 107, 107, 0.18)',
        fill: true,
        tension: 0.35,
        borderWidth: 3,
        pointRadius: 3,
        pointHoverRadius: 5,
      },
      {
        label: 'Fixed',
        data: labels.map((entry) => completedLookup.get(entry) ?? 0),
        borderColor: '#34d399',
        backgroundColor: 'rgba(52, 211, 153, 0.14)',
        fill: true,
        tension: 0.35,
        borderWidth: 3,
        pointRadius: 3,
        pointHoverRadius: 5,
      },
    ],
  }
}

export function buildBacklogChartData(dashboardMetrics) {
  const remainingMap = new Map(dashboardMetrics.remainingPerDay.map((entry) => [entry.date, entry.count]))
  const labels = dashboardMetrics.remainingPerDay.map((entry) => entry.date)

  return {
    labels: labels.map((date) => formatLabel(date)),
    datasets: [
      {
        label: 'Open bugs',
        data: labels.map((date) => remainingMap.get(date) ?? null),
        borderColor: '#60a5fa',
        backgroundColor: 'rgba(96, 165, 250, 0.16)',
        tension: 0.2,
        borderWidth: 3,
        spanGaps: true,
      },
    ],
  }
}

export function buildProjectionChartData(dashboardMetrics) {
  const deadline = dashboardMetrics.deadline
  const today = dashboardMetrics.today
  const targetFromDate = dashboardMetrics.targetFromDate
  const start = compareAsc(today, targetFromDate) === 1 ? today : targetFromDate
  const safeStart = compareAsc(start, deadline) === 1 ? deadline : start
  const dates = eachDayOfInterval({ start: safeStart, end: deadline })
  const daysRemaining = Math.max(dates.length - 1, 1)
  const idealStep = dashboardMetrics.remainingBugs / daysRemaining

  return {
    labels: dates.map((date) => format(date, 'MMM d')),
    datasets: [
      {
        label: 'Projected backlog',
        data: dates.map((_, index) => Math.max(0, dashboardMetrics.remainingBugs - dashboardMetrics.currentNetBurnRate * index)),
        borderColor: '#f472b6',
        backgroundColor: 'rgba(244, 114, 182, 0.14)',
        tension: 0.24,
        borderWidth: 3,
        spanGaps: true,
      },
      {
        label: 'Required glide path',
        data: dates.map((_, index) => Math.max(0, dashboardMetrics.remainingBugs - idealStep * index)),
        borderColor: '#fbbf24',
        backgroundColor: 'rgba(251, 191, 36, 0.12)',
        borderDash: [8, 6],
        tension: 0,
        borderWidth: 2,
        pointRadius: 0,
      },
    ],
  }
}

export function buildPriorityChartData(dashboardMetrics) {
  return {
    labels: dashboardMetrics.priorityDistribution.map((entry) => entry.label),
    datasets: [
      {
        label: 'Open bugs',
        data: dashboardMetrics.priorityDistribution.map((entry) => entry.count),
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

export function getComparisonMetrics(source, { rangeDays = '30' } = {}) {
  const bugs = normalizeBugRecords(source)
  const today = new Date()
  const usedFallbackRange = rangeDays === 'all'
  const comparisonRangeDays = getNumericRangeDays(rangeDays, 30)
  const currentStart = subDays(today, comparisonRangeDays - 1)
  const previousEnd = subDays(currentStart, 1)
  const previousStart = subDays(previousEnd, comparisonRangeDays - 1)
  const currentWindow = getWindowStats(bugs, currentStart, today)
  const previousWindow = getWindowStats(bugs, previousStart, previousEnd)
  const netBurnDelta = currentWindow.netBurnRate - previousWindow.netBurnRate
  const addRateDelta = currentWindow.addRate - previousWindow.addRate
  const fixRateDelta = currentWindow.fixRate - previousWindow.fixRate

  let tone = 'warning'
  let headline = 'Mixed movement versus the prior window'
  let body = 'Recent results are close to the previous period, so the trend is not decisively better yet.'

  if (netBurnDelta > 0.05) {
    tone = 'positive'
    headline = 'Improving versus the prior window'
    body = 'Net burn improved over the previous period, meaning fixes are outpacing bug intake more effectively.'
  } else if (netBurnDelta < -0.05) {
    tone = 'negative'
    headline = 'Worse than the prior window'
    body = 'Net burn slipped compared with the previous period, so intake pressure or slower fixes are hurting progress.'
  }

  return {
    comparisonRangeDays,
    usedFallbackRange,
    currentWindow,
    previousWindow,
    netBurnDelta,
    addRateDelta,
    fixRateDelta,
    tone,
    headline,
    body,
  }
}

export function buildComparisonChartData(comparisonMetrics) {
  return {
    labels: ['Created / day', 'Fixed / day', 'Net burn / day'],
    datasets: [
      {
        label: `Current ${comparisonMetrics.comparisonRangeDays} days`,
        data: [
          comparisonMetrics.currentWindow.addRate,
          comparisonMetrics.currentWindow.fixRate,
          comparisonMetrics.currentWindow.netBurnRate,
        ],
        backgroundColor: 'rgba(96, 165, 250, 0.78)',
        borderColor: '#60a5fa',
        borderWidth: 1,
        borderRadius: 8,
      },
      {
        label: `Previous ${comparisonMetrics.comparisonRangeDays} days`,
        data: [
          comparisonMetrics.previousWindow.addRate,
          comparisonMetrics.previousWindow.fixRate,
          comparisonMetrics.previousWindow.netBurnRate,
        ],
        backgroundColor: 'rgba(244, 114, 182, 0.74)',
        borderColor: '#f472b6',
        borderWidth: 1,
        borderRadius: 8,
      },
    ],
  }
}

export function getSummaryMetrics(dashboardMetrics) {
  return {
    bugCount: dashboardMetrics.remainingBugs,
    daysUntilDeadline: dashboardMetrics.daysUntilDeadline,
    bugsPerDayRequired: dashboardMetrics.bugsPerDayRequired,
    currentAddRate: dashboardMetrics.currentAddRate,
    currentFixRate: dashboardMetrics.currentFixRate,
    currentNetBurnRate: dashboardMetrics.currentNetBurnRate,
    onPace: dashboardMetrics.onPace,
    deadlineLabel: dashboardMetrics.deadlineLabel,
    targetFromLabel: dashboardMetrics.targetFromLabel,
    targetToLabel: dashboardMetrics.targetToLabel,
    paceSignal: dashboardMetrics.paceSignal,
    likelihoodScore: dashboardMetrics.likelihoodScore,
  }
}