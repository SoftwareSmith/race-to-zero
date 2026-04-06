import {
  differenceInCalendarDays,
  eachDayOfInterval,
  endOfYear,
  format,
  isBefore,
  parseISO,
} from 'date-fns'

function normalizeBugRecords(source) {
  return [...(source?.bugs ?? [])]
    .map((entry) => ({
      createdAt: entry.createdAt,
      completedAt: entry.completedAt || null,
    }))
    .filter((entry) => Boolean(entry.createdAt))
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
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

export function getDashboardMetrics(source) {
  const bugs = normalizeBugRecords(source)
  const createdPerDay = buildSeriesFromField(bugs, 'createdAt')
  const completedPerDay = buildSeriesFromField(bugs, 'completedAt')
  const remainingPerDay = buildRemainingSeries(createdPerDay, completedPerDay)
  const remainingBugs = bugs.filter((bug) => !bug.completedAt).length
  const deadline = getDeadlineDate()
  const startDate = bugs[0]?.createdAt ? parseISO(bugs[0].createdAt) : new Date()
  const safeStartDate = isBefore(deadline, startDate) ? deadline : startDate
  const daysUntilDeadline = Math.max(differenceInCalendarDays(deadline, new Date()), 0)
  const bugsPerDayRequired = daysUntilDeadline > 0 ? remainingBugs / daysUntilDeadline : remainingBugs
  const totalCompleted = completedPerDay.reduce((sum, entry) => sum + entry.count, 0)
  const actualBurnRate = completedPerDay.length > 0 ? totalCompleted / completedPerDay.length : 0

  return {
    bugs,
    createdPerDay,
    completedPerDay,
    remainingPerDay,
    remainingBugs,
    bugsPerDayRequired,
    actualBurnRate,
    daysUntilDeadline,
    onPace: actualBurnRate >= bugsPerDayRequired,
    deadline,
    deadlineLabel: format(deadline, 'MMM d, yyyy'),
    startDate: safeStartDate,
  }
}

export function buildDailyChartData(series, label, color) {
  const normalized = [...series].sort((left, right) => left.date.localeCompare(right.date))

  return {
    labels: normalized.map((entry) => formatLabel(entry.date)),
    datasets: [
      {
        label,
        data: normalized.map((entry) => entry.count),
        borderColor: color,
        backgroundColor: `${color}22`,
        fill: true,
        tension: 0.35,
        borderWidth: 3,
        pointRadius: 3,
        pointHoverRadius: 5,
      },
    ],
  }
}

export function buildBurndownChartData(dashboardMetrics) {
  const dates = eachDayOfInterval({
    start: dashboardMetrics.startDate,
    end: dashboardMetrics.deadline,
  })
  const idealStep = dates.length > 1
    ? dashboardMetrics.remainingBugs / (dates.length - 1)
    : dashboardMetrics.remainingBugs
  const remainingMap = new Map(dashboardMetrics.remainingPerDay.map((entry) => [entry.date, entry.count]))

  return {
    labels: dates.map((date) => format(date, 'MMM d')),
    datasets: [
      {
        label: 'Remaining',
        data: dates.map((date) => remainingMap.get(format(date, 'yyyy-MM-dd')) ?? null),
        borderColor: '#184f88',
        backgroundColor: 'rgba(24, 79, 136, 0.1)',
        tension: 0.2,
        borderWidth: 3,
        spanGaps: true,
      },
      {
        label: 'Ideal',
        data: dates.map((_, index) => Math.max(0, dashboardMetrics.remainingBugs - idealStep * index)),
        borderColor: '#f59e0b',
        backgroundColor: 'rgba(245, 158, 11, 0.12)',
        borderDash: [8, 6],
        tension: 0,
        borderWidth: 2,
        pointRadius: 0,
      },
    ],
  }
}

export function getSummaryMetrics(dashboardMetrics) {
  return {
    remainingBugs: dashboardMetrics.remainingBugs,
    daysUntilDeadline: dashboardMetrics.daysUntilDeadline,
    bugsPerDayRequired: dashboardMetrics.bugsPerDayRequired,
    actualBurnRate: dashboardMetrics.actualBurnRate,
    onPace: dashboardMetrics.onPace,
    deadlineLabel: dashboardMetrics.deadlineLabel,
  }
}