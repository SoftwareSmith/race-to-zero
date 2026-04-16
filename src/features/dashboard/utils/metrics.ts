import type { ChartData } from "chart.js";
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
} from "date-fns";
import type {
  CompareRangeKey,
  ComparisonMetrics,
  ComparisonWindowMetrics,
  DailyCountEntry,
  DeadlineMetrics,
  MetricsBug,
  MetricsSource,
  PriorityDistributionEntry,
  StatusDistributionEntry,
  SummaryMetrics,
  Tone,
  WorkdaySettings,
} from "../../../types/dashboard";
import { countConfiguredDays } from "@shared/utils/workCalendar";

const DEADLINE_TREND_WINDOW_DAYS = 30;
const PRIORITY_ORDER = [
  "Urgent",
  "High",
  "Normal",
  "Low",
  "Unspecified",
] as const;
const STATUS_ORDER = [
  "Backlog",
  "Triage",
  "Todo",
  "In progress",
  "In review",
  "Deploy ready",
  "Cancelled",
  "Duplicated",
  "Other",
] as const;
const OPEN_AGE_BUCKETS = [
  { label: "0-7d", maxDays: 7 },
  { label: "8-30d", maxDays: 30 },
  { label: "31-90d", maxDays: 90 },
  { label: "91-180d", maxDays: 180 },
  { label: "181d+", maxDays: Number.POSITIVE_INFINITY },
] as const;
const PREPARED_SOURCE_CACHE = new WeakMap<
  MetricsSource,
  PreparedMetricsSource
>();

interface SeriesIndex {
  dates: string[];
  prefixSums: number[];
  series: DailyCountEntry[];
  values: number[];
}

interface PreparedMetricsSource {
  bugs: MetricsBug[];
  completedIndex: SeriesIndex;
  completedSeries: DailyCountEntry[];
  createdIndex: SeriesIndex;
  createdSeries: DailyCountEntry[];
  firstBugDate: Date | null;
  priorityDistribution: PriorityDistributionEntry[];
  remainingBugs: number;
  remainingIndex: SeriesIndex;
  remainingSeries: DailyCountEntry[];
  statusDistribution: StatusDistributionEntry[];
}

function normalizeBugRecords(
  source: MetricsSource | null | undefined,
): MetricsBug[] {
  return [...(source?.bugs ?? [])]
    .map((entry) => ({
      completedAt: entry.completedAt || null,
      createdAt: entry.createdAt,
      priority: Number(entry.priority ?? 0),
      stateName: entry.stateName ?? null,
      stateType: entry.stateType ?? null,
      teamKey: entry.teamKey ?? null,
    }))
    .filter((entry) => Boolean(entry.createdAt))
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
}

function getPriorityLabel(priority: number) {
  switch (priority) {
    case 1:
      return "Urgent";
    case 2:
      return "High";
    case 3:
      return "Normal";
    case 4:
      return "Low";
    default:
      return "Unspecified";
  }
}

function buildPriorityDistributionFromCounts(
  counts: Map<string, number>,
): PriorityDistributionEntry[] {
  return PRIORITY_ORDER.map((label) => ({
    label,
    count: counts.get(label) ?? 0,
  }));
}

function getLinearStatusLabel(bug: MetricsBug) {
  const rawValue = bug.stateName?.trim() || bug.stateType?.trim() || "";
  const normalizedValue = rawValue.toLowerCase();

  if (normalizedValue === "backlog") {
    return "Backlog";
  }

  if (normalizedValue === "triage" || normalizedValue === "triaged") {
    return "Triage";
  }

  if (
    normalizedValue === "todo" ||
    normalizedValue === "to do" ||
    normalizedValue === "unstarted"
  ) {
    return "Todo";
  }

  if (
    normalizedValue === "in progress" ||
    normalizedValue === "in-progress" ||
    normalizedValue === "started" ||
    normalizedValue === "doing"
  ) {
    return "In progress";
  }

  if (
    normalizedValue === "in review" ||
    normalizedValue === "review" ||
    normalizedValue === "qa" ||
    normalizedValue === "testing"
  ) {
    return "In review";
  }

  if (
    normalizedValue === "deploy ready" ||
    normalizedValue === "ready to deploy" ||
    normalizedValue === "deploy-ready" ||
    normalizedValue === "ready for deploy"
  ) {
    return "Deploy ready";
  }

  if (
    normalizedValue === "done" ||
    normalizedValue === "completed" ||
    normalizedValue === "complete" ||
    (!normalizedValue && bug.completedAt)
  ) {
    return "Done";
  }

  if (
    normalizedValue === "cancelled" ||
    normalizedValue === "canceled" ||
    normalizedValue === "cancel"
  ) {
    return "Cancelled";
  }

  if (
    normalizedValue === "duplicated" ||
    normalizedValue === "duplicate" ||
    normalizedValue === "duplicate bug"
  ) {
    return "Duplicated";
  }

  return "Other";
}

function buildStatusDistributionFromCounts(
  counts: Map<string, number>,
): StatusDistributionEntry[] {
  return STATUS_ORDER.map((label) => ({
    label,
    count: counts.get(label) ?? 0,
  }));
}

function buildOpenAgeDistribution(
  bugs: MetricsBug[],
  today: Date,
) {
  const bucketCounts = new Map<string, number>(
    OPEN_AGE_BUCKETS.map((bucket) => [bucket.label, 0]),
  );

  for (const bug of bugs) {
    if (bug.completedAt) {
      continue;
    }

    const createdAt = parseISO(bug.createdAt);
    const ageInDays = Math.max(differenceInCalendarDays(today, createdAt), 0);
    const bucket = OPEN_AGE_BUCKETS.find(
      (entry) => ageInDays <= entry.maxDays,
    );

    if (!bucket) {
      continue;
    }

    bucketCounts.set(bucket.label, (bucketCounts.get(bucket.label) ?? 0) + 1);
  }

  return OPEN_AGE_BUCKETS.map((bucket) => ({
    label: bucket.label,
    count: bucketCounts.get(bucket.label) ?? 0,
  }));
}

function formatLabel(dateValue: string) {
  return format(parseISO(dateValue), "MMM d");
}

function getDisplayRangeLabel(startDate: Date, endDate: Date) {
  return `${format(startDate, "MMM d")} - ${format(endDate, "MMM d")}`;
}

function buildSeriesFromField(
  bugs: MetricsBug[],
  fieldName: "completedAt" | "createdAt",
): DailyCountEntry[] {
  const countsByDay = new Map<string, number>();

  for (const bug of bugs) {
    const value = bug[fieldName];
    if (!value) {
      continue;
    }

    countsByDay.set(value, (countsByDay.get(value) ?? 0) + 1);
  }

  return [...countsByDay.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, count]) => ({ date, count }));
}

function buildRemainingSeries(
  createdPerDay: DailyCountEntry[],
  completedPerDay: DailyCountEntry[],
): DailyCountEntry[] {
  const orderedDates = [
    ...new Set([
      ...createdPerDay.map((entry) => entry.date),
      ...completedPerDay.map((entry) => entry.date),
    ]),
  ].sort((left, right) => left.localeCompare(right));

  const createdLookup = new Map(
    createdPerDay.map((entry) => [entry.date, entry.count]),
  );
  const completedLookup = new Map(
    completedPerDay.map((entry) => [entry.date, entry.count]),
  );
  const remainingPerDay: DailyCountEntry[] = [];
  let runningRemaining = 0;

  for (const date of orderedDates) {
    runningRemaining += createdLookup.get(date) ?? 0;
    runningRemaining -= completedLookup.get(date) ?? 0;
    remainingPerDay.push({ date, count: Math.max(runningRemaining, 0) });
  }

  return remainingPerDay;
}

function buildSeriesIndex(
  series: DailyCountEntry[],
  { usePrefixSums = true }: { usePrefixSums?: boolean } = {},
): SeriesIndex {
  const dates: string[] = [];
  const values: number[] = [];
  const prefixSums: number[] = [];
  let runningTotal = 0;

  for (const entry of series) {
    dates.push(entry.date);
    values.push(entry.count);

    if (usePrefixSums) {
      runningTotal += entry.count;
      prefixSums.push(runningTotal);
    }
  }

  return {
    dates,
    prefixSums,
    series,
    values,
  };
}

function findLowerBound(values: string[], target: string) {
  let low = 0;
  let high = values.length;

  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (values[middle] < target) {
      low = middle + 1;
    } else {
      high = middle;
    }
  }

  return low;
}

function findUpperBound(values: string[], target: string) {
  let low = 0;
  let high = values.length;

  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (values[middle] <= target) {
      low = middle + 1;
    } else {
      high = middle;
    }
  }

  return low;
}

function filterSeriesByDateRange(
  seriesIndex: SeriesIndex,
  startDate: Date,
  endDate: Date,
) {
  const startDateKey = format(startDate, "yyyy-MM-dd");
  const endDateKey = format(endDate, "yyyy-MM-dd");
  const startIndex = findLowerBound(seriesIndex.dates, startDateKey);
  const endIndex = findUpperBound(seriesIndex.dates, endDateKey);

  return seriesIndex.series.slice(startIndex, endIndex);
}

function getSeriesTotalInRange(
  seriesIndex: SeriesIndex,
  startDate: Date,
  endDate: Date,
) {
  const startDateKey = format(startDate, "yyyy-MM-dd");
  const endDateKey = format(endDate, "yyyy-MM-dd");
  const startIndex = findLowerBound(seriesIndex.dates, startDateKey);
  const endIndex = findUpperBound(seriesIndex.dates, endDateKey) - 1;

  if (startIndex > endIndex || endIndex < 0 || !seriesIndex.prefixSums.length) {
    return 0;
  }

  const endTotal = seriesIndex.prefixSums[endIndex] ?? 0;
  const startTotal =
    startIndex > 0 ? (seriesIndex.prefixSums[startIndex - 1] ?? 0) : 0;

  return endTotal - startTotal;
}

function getSeriesValueAtOrBefore(
  seriesIndex: SeriesIndex,
  date: Date | string,
) {
  const dateKey = typeof date === "string" ? date : format(date, "yyyy-MM-dd");
  const index = findUpperBound(seriesIndex.dates, dateKey) - 1;

  if (index < 0) {
    return 0;
  }

  return seriesIndex.values[index] ?? 0;
}

function prepareMetricsSource(
  source: MetricsSource | null | undefined,
): PreparedMetricsSource {
  if (source && PREPARED_SOURCE_CACHE.has(source)) {
    return PREPARED_SOURCE_CACHE.get(source) as PreparedMetricsSource;
  }

  const bugs = normalizeBugRecords(source);
  const priorityCounts = new Map<string, number>();
  const statusCounts = new Map<string, number>();
  let remainingBugs = 0;

  for (const bug of bugs) {
    const statusLabel = getLinearStatusLabel(bug);
    statusCounts.set(statusLabel, (statusCounts.get(statusLabel) ?? 0) + 1);

    if (!bug.completedAt) {
      remainingBugs += 1;
      const label = getPriorityLabel(bug.priority);
      priorityCounts.set(label, (priorityCounts.get(label) ?? 0) + 1);
    }
  }

  const createdSeries = buildSeriesFromField(bugs, "createdAt");
  const completedSeries = buildSeriesFromField(bugs, "completedAt");
  const remainingSeries = buildRemainingSeries(createdSeries, completedSeries);
  const preparedSource: PreparedMetricsSource = {
    bugs,
    completedIndex: buildSeriesIndex(completedSeries),
    completedSeries,
    createdIndex: buildSeriesIndex(createdSeries),
    createdSeries,
    firstBugDate: bugs[0]?.createdAt ? parseISO(bugs[0].createdAt) : null,
    priorityDistribution: buildPriorityDistributionFromCounts(priorityCounts),
    remainingBugs,
    remainingIndex: buildSeriesIndex(remainingSeries, { usePrefixSums: false }),
    remainingSeries,
    statusDistribution: buildStatusDistributionFromCounts(statusCounts),
  };

  if (source) {
    PREPARED_SOURCE_CACHE.set(source, preparedSource);
  }

  return preparedSource;
}

function getDeadlineDate(referenceDate = new Date()) {
  return endOfYear(referenceDate);
}

function getValidDate(dateValue: string | undefined, fallbackDate: Date) {
  if (!dateValue) {
    return fallbackDate;
  }

  const parsedDate = parseISO(dateValue);
  return isValid(parsedDate) ? parsedDate : fallbackDate;
}

function getNumericRangeDays(rangeDays: string, fallbackDays = 30) {
  const numericRange = Number(rangeDays);
  return Number.isFinite(numericRange) && numericRange > 0
    ? numericRange
    : fallbackDays;
}

function getWindowStats(
  preparedSource: PreparedMetricsSource,
  startDate: Date,
  endDate: Date,
): ComparisonWindowMetrics {
  const dayCount = Math.max(
    differenceInCalendarDays(endDate, startDate) + 1,
    1,
  );
  const created = getSeriesTotalInRange(
    preparedSource.createdIndex,
    startDate,
    endDate,
  );
  const fixed = getSeriesTotalInRange(
    preparedSource.completedIndex,
    startDate,
    endDate,
  );

  const addRate = created / dayCount;
  const fixRate = fixed / dayCount;
  const netBurnRate = fixRate - addRate;
  const netChange = created - fixed;
  const completionRate =
    created > 0 ? Math.min((fixed / created) * 100, 999) : 0;

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
  };
}

function buildHistoricalWindows(
  preparedSource: PreparedMetricsSource,
  earliestDate: Date,
  currentEndDate: Date,
  windowSizeDays: number,
) {
  const windows: ComparisonWindowMetrics[] = [];
  let windowEnd = currentEndDate;

  while (compareAsc(windowEnd, earliestDate) >= 0) {
    let windowStart = subDays(windowEnd, windowSizeDays - 1);
    if (compareAsc(windowStart, earliestDate) < 0) {
      windowStart = earliestDate;
    }

    windows.push(getWindowStats(preparedSource, windowStart, windowEnd));

    if (compareAsc(windowStart, earliestDate) <= 0) {
      break;
    }

    windowEnd = subDays(windowStart, 1);
  }

  return windows.reverse();
}

function getDeadlineStatus({
  remainingBugs,
  currentNetBurnRate,
  neededNetBurnRate,
  daysUntilDeadline,
}: {
  currentNetBurnRate: number;
  daysUntilDeadline: number;
  neededNetBurnRate: number;
  remainingBugs: number;
}) {
  if (remainingBugs === 0) {
    return {
      tone: "positive" as Tone,
      signal: "Ahead",
      headline: "Queue is already at zero",
      body: "The current snapshot shows no remaining bugs in scope.",
    };
  }

  if (daysUntilDeadline === 0) {
    return {
      tone: "negative" as Tone,
      signal: "Behind",
      headline: "Deadline has arrived",
      body: "There is no remaining runway to burn down the current backlog.",
    };
  }

  if (currentNetBurnRate >= neededNetBurnRate) {
    return {
      tone: "positive" as Tone,
      signal: "Ahead",
      headline: "Ahead of the zero-bug pace",
      body: "Recent fix velocity is offsetting new bugs and still reducing the backlog quickly enough to reach zero by the selected deadline if the same trend holds.",
    };
  }

  return {
    tone: "negative" as Tone,
    signal: "Behind",
    headline: "Behind the zero-bug pace",
    body: "Recent intake is matching or exceeding fixes, so the backlog is not burning down fast enough to hit the selected deadline without a throughput change.",
  };
}

function getLikelihoodScore({
  remainingBugs,
  currentNetBurnRate,
  neededNetBurnRate,
  daysUntilDeadline,
}: {
  currentNetBurnRate: number;
  daysUntilDeadline: number;
  neededNetBurnRate: number;
  remainingBugs: number;
}) {
  if (remainingBugs === 0) {
    return 100;
  }

  if (daysUntilDeadline === 0) {
    return 0;
  }

  if (neededNetBurnRate <= 0) {
    return currentNetBurnRate > 0 ? 100 : 0;
  }

  const ratio = currentNetBurnRate / neededNetBurnRate;
  return Math.max(0, Math.min(100, Math.round(ratio * 100)));
}

function createLabelSeries(
  primarySeries: DailyCountEntry[],
  secondarySeries: DailyCountEntry[] = [],
) {
  return [
    ...new Set([
      ...primarySeries.map((entry) => entry.date),
      ...secondarySeries.map((entry) => entry.date),
    ]),
  ].sort((left, right) => left.localeCompare(right));
}

function getCustomRangeDates(
  customFromDate: string | undefined,
  customToDate: string | undefined,
  today: Date,
) {
  const startDate = getValidDate(customFromDate, subDays(today, 29));
  const endDate = getValidDate(customToDate, today);

  if (compareAsc(startDate, endDate) === 1) {
    return {
      startDate: endDate,
      endDate,
    };
  }

  return { startDate, endDate };
}

export function getDeadlineMetrics(
  source: MetricsSource | null,
  {
    deadlineDate,
    trackingStartDate,
    workdaySettings,
  }: {
    deadlineDate?: string;
    trackingStartDate?: string;
    workdaySettings?: WorkdaySettings;
  } = {},
): DeadlineMetrics {
  const preparedSource = prepareMetricsSource(source);
  const remainingBugs = preparedSource.remainingBugs;
  const today = startOfDay(new Date());
  const defaultDeadline = getDeadlineDate(today);
  const deadline = getValidDate(deadlineDate, defaultDeadline);
  const firstBugDate = preparedSource.firstBugDate ?? today;
  const requestedTrackingStartDate = getValidDate(
    trackingStartDate,
    subDays(today, DEADLINE_TREND_WINDOW_DAYS - 1),
  );
  const trackingStart = isBefore(requestedTrackingStartDate, firstBugDate)
    ? firstBugDate
    : requestedTrackingStartDate;
  const recentCreatedPerDay = filterSeriesByDateRange(
    preparedSource.createdIndex,
    trackingStart,
    today,
  );
  const recentCompletedPerDay = filterSeriesByDateRange(
    preparedSource.completedIndex,
    trackingStart,
    today,
  );
  const activeWorkdaySettings: WorkdaySettings = workdaySettings ?? {
    excludePublicHolidays: false,
    excludeWeekends: false,
  };
  const trendDayCount = Math.max(
    countConfiguredDays(trackingStart, today, activeWorkdaySettings, {
      inclusive: true,
    }),
    1,
  );
  const currentAddRate =
    recentCreatedPerDay.reduce((sum, entry) => sum + entry.count, 0) /
    trendDayCount;
  const currentFixRate =
    recentCompletedPerDay.reduce((sum, entry) => sum + entry.count, 0) /
    trendDayCount;
  const currentNetBurnRate = currentFixRate - currentAddRate;
  const daysUntilDeadline = Math.max(
    countConfiguredDays(today, deadline, activeWorkdaySettings, {
      inclusive: false,
    }),
    0,
  );
  const neededNetBurnRate =
    daysUntilDeadline > 0 ? remainingBugs / daysUntilDeadline : remainingBugs;
  const bugsPerDayRequired =
    daysUntilDeadline > 0 ? currentAddRate + neededNetBurnRate : remainingBugs;
  const status = getDeadlineStatus({
    remainingBugs,
    currentNetBurnRate,
    neededNetBurnRate,
    daysUntilDeadline,
  });

  return {
    bugs: preparedSource.bugs,
    allRemainingPerDay: preparedSource.remainingSeries,
    remainingBugs,
    trackingStartDate: trackingStart,
    trackingStartLabel: format(trackingStart, "MMM d, yyyy"),
    trackingStartBacklog: getSeriesValueAtOrBefore(
      preparedSource.remainingIndex,
      trackingStart,
    ),
    currentAddRate,
    currentFixRate,
    currentNetBurnRate,
    neededNetBurnRate,
    bugsPerDayRequired,
    daysUntilDeadline,
    deadline,
    deadlineLabel: format(deadline, "MMM d, yyyy"),
    trendWindowLabel: getDisplayRangeLabel(trackingStart, today),
    statusTone: status.tone,
    statusSignal: status.signal,
    statusHeadline: status.headline,
    statusBody: status.body,
    onTrack: status.tone === "positive",
    likelihoodScore: getLikelihoodScore({
      remainingBugs,
      currentNetBurnRate,
      neededNetBurnRate,
      daysUntilDeadline,
    }),
    priorityDistribution: preparedSource.priorityDistribution,
    statusDistribution: preparedSource.statusDistribution,
    today,
    workdaySettings: activeWorkdaySettings,
  };
}

export function buildDeadlineBurndownChartData(
  deadlineMetrics: DeadlineMetrics,
): ChartData<"line", Array<number | null>, string> {
  const actualHistory = deadlineMetrics.allRemainingPerDay.filter(
    (entry) =>
      entry.date >= format(deadlineMetrics.trackingStartDate, "yyyy-MM-dd"),
  );
  const historyDates = actualHistory.map((entry) => entry.date);
  const futureDates =
    compareAsc(deadlineMetrics.today, deadlineMetrics.deadline) === -1
      ? eachDayOfInterval({
          start: addDays(deadlineMetrics.today, 1),
          end: deadlineMetrics.deadline,
        }).map((entry) => format(entry, "yyyy-MM-dd"))
      : [];
  const labels = [...new Set([...historyDates, ...futureDates])];
  const todayKey = format(deadlineMetrics.today, "yyyy-MM-dd");
  const actualLookup = new Map(
    actualHistory.map((entry) => [entry.date, entry.count]),
  );
  const idealStartDate = deadlineMetrics.trackingStartDate;
  const idealStartCount = deadlineMetrics.trackingStartBacklog;
  const idealDuration = Math.max(
    countConfiguredDays(
      idealStartDate,
      deadlineMetrics.deadline,
      deadlineMetrics.workdaySettings,
      { inclusive: false },
    ),
    1,
  );

  return {
    labels: labels.map((entry) => formatLabel(entry)),
    datasets: [
      {
        label: "Remaining bugs",
        data: labels.map((entry) =>
          entry <= todayKey ? (actualLookup.get(entry) ?? null) : null,
        ),
        borderColor: "#f87171",
        backgroundColor: "rgba(248, 113, 113, 0.18)",
        fill: false,
        tension: 0.22,
        borderWidth: 3,
        pointRadius: 2,
        pointHoverRadius: 4,
      },
      {
        label: "Ideal line",
        data: labels.map((entry) => {
          const currentDate = parseISO(entry);
          const elapsed = Math.max(
            countConfiguredDays(
              idealStartDate,
              currentDate,
              deadlineMetrics.workdaySettings,
              { inclusive: false },
            ),
            0,
          );
          return Math.max(
            0,
            Number(
              (
                idealStartCount -
                (idealStartCount / idealDuration) * elapsed
              ).toFixed(2),
            ),
          );
        }),
        borderColor: "#5eead4",
        backgroundColor: "rgba(94, 234, 212, 0.08)",
        borderDash: [6, 6],
        tension: 0,
        borderWidth: 2,
        pointRadius: 0,
      },
    ],
  };
}

export function buildPriorityChartData(
  metricsWithPriority: DeadlineMetrics,
): ChartData<"bar", number[], string> {
  return {
    labels: metricsWithPriority.priorityDistribution.map(
      (entry) => entry.label,
    ),
    datasets: [
      {
        label: "Open bugs",
        data: metricsWithPriority.priorityDistribution.map(
          (entry) => entry.count,
        ),
        backgroundColor: [
          "rgba(248, 113, 113, 0.72)",
          "rgba(125, 211, 252, 0.72)",
          "rgba(94, 234, 212, 0.72)",
          "rgba(148, 163, 184, 0.7)",
          "rgba(120, 113, 108, 0.66)",
        ],
        borderColor: ["#f87171", "#7dd3fc", "#5eead4", "#94a3b8", "#78716c"],
        borderWidth: 1,
        borderRadius: 8,
      },
    ],
  };
}

export function buildStatusChartData(
  deadlineMetrics: DeadlineMetrics,
): ChartData<"bar", number[], string> {
  const visibleStatusEntries = deadlineMetrics.statusDistribution.filter(
    (entry) => entry.label !== "Done",
  );
  const palette = [
    ["rgba(56, 189, 248, 0.74)", "#38bdf8"],
    ["rgba(45, 212, 191, 0.72)", "#2dd4bf"],
    ["rgba(251, 191, 36, 0.7)", "#fbbf24"],
    ["rgba(248, 113, 113, 0.72)", "#f87171"],
    ["rgba(167, 139, 250, 0.7)", "#a78bfa"],
    ["rgba(148, 163, 184, 0.72)", "#94a3b8"],
  ] as const;

  return {
    labels: visibleStatusEntries.map((entry) => entry.label),
    datasets: [
      {
        label: "Bugs",
        data: visibleStatusEntries.map((entry) => entry.count),
        backgroundColor: visibleStatusEntries.map(
          (_, index) => palette[index % palette.length][0],
        ),
        borderColor: visibleStatusEntries.map(
          (_, index) => palette[index % palette.length][1],
        ),
        borderWidth: 1,
        borderRadius: 8,
      },
    ],
  };
}

export function buildOpenAgeChartData(
  deadlineMetrics: DeadlineMetrics,
): ChartData<"bar", number[], string> {
  const ageDistribution = buildOpenAgeDistribution(
    deadlineMetrics.bugs,
    deadlineMetrics.today,
  );

  return {
    labels: ageDistribution.map((entry) => entry.label),
    datasets: [
      {
        label: "Open bugs",
        data: ageDistribution.map((entry) => entry.count),
        backgroundColor: [
          "rgba(56, 189, 248, 0.72)",
          "rgba(45, 212, 191, 0.72)",
          "rgba(251, 191, 36, 0.72)",
          "rgba(249, 115, 22, 0.72)",
          "rgba(248, 113, 113, 0.72)",
        ],
        borderColor: ["#38bdf8", "#2dd4bf", "#fbbf24", "#f97316", "#f87171"],
        borderWidth: 1,
        borderRadius: 8,
      },
    ],
  };
}

export function getComparisonMetrics(
  source: MetricsSource | null,
  {
    rangeKey = "30",
    customFromDate,
    customToDate,
  }: {
    customFromDate?: string;
    customToDate?: string;
    rangeKey?: CompareRangeKey;
  } = {},
): ComparisonMetrics {
  const preparedSource = prepareMetricsSource(source);
  const today = startOfDay(new Date());
  const earliestDate = preparedSource.firstBugDate ?? today;
  const isAllTime = rangeKey === "all";
  const isCustom = rangeKey === "custom";

  let currentStartDate = earliestDate;
  let currentEndDate = today;

  if (isCustom) {
    const customDates = getCustomRangeDates(
      customFromDate,
      customToDate,
      today,
    );
    currentStartDate = customDates.startDate;
    currentEndDate = customDates.endDate;
  } else if (!isAllTime) {
    const selectedDays = getNumericRangeDays(rangeKey, 30);
    currentStartDate = subDays(today, selectedDays - 1);
    currentEndDate = today;
  }

  const currentWindow = getWindowStats(
    preparedSource,
    currentStartDate,
    currentEndDate,
  );
  const hasComparisonWindow = !isAllTime;
  const previousWindow = hasComparisonWindow
    ? getWindowStats(
        preparedSource,
        subDays(currentStartDate, currentWindow.dayCount),
        subDays(currentStartDate, 1),
      )
    : null;
  const createdSeries = filterSeriesByDateRange(
    preparedSource.createdIndex,
    currentStartDate,
    currentEndDate,
  );
  const completedSeries = filterSeriesByDateRange(
    preparedSource.completedIndex,
    currentStartDate,
    currentEndDate,
  );
  const historicalWindows = buildHistoricalWindows(
    preparedSource,
    earliestDate,
    currentEndDate,
    currentWindow.dayCount,
  );

  let tone: Tone =
    currentWindow.netChange > 0
      ? "negative"
      : currentWindow.netChange < 0
        ? "positive"
        : "neutral";
  let headline =
    currentWindow.netChange > 0
      ? "Intake is outpacing completions"
      : currentWindow.netChange < 0
        ? "Completions are outpacing intake"
        : "Intake and completions are running even";
  let body =
    currentWindow.netChange > 0
      ? `The current window created ${currentWindow.created} bugs and closed ${currentWindow.fixed}, so backlog pressure increased by ${currentWindow.netChange}.`
      : currentWindow.netChange < 0
        ? `The current window closed ${currentWindow.fixed} bugs and created ${currentWindow.created}, so the backlog reduced by ${Math.abs(currentWindow.netChange)}.`
        : `The current window created and closed ${currentWindow.created} bugs, leaving net backlog movement flat.`;

  if (!hasComparisonWindow) {
    tone = "neutral";
    headline = "All-time trend view";
    body =
      "All time shows the full bug history for the CP scope. Switch to a fixed or custom range to compare this period against a previous one.";
  } else if (
    previousWindow &&
    currentWindow.netChange < previousWindow.netChange
  ) {
    body += ` That is better than the previous window by ${Math.abs(currentWindow.netChange - previousWindow.netChange)} net bugs.`;
  } else if (
    previousWindow &&
    currentWindow.netChange > previousWindow.netChange
  ) {
    body += ` That is worse than the previous window by ${Math.abs(currentWindow.netChange - previousWindow.netChange)} net bugs.`;
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
    historicalWindows,
    rangeLabel: isAllTime
      ? "All time"
      : isCustom
        ? `Custom: ${getDisplayRangeLabel(currentStartDate, currentEndDate)}`
        : `Last ${rangeKey} days`,
  };
}

export function buildComparisonTimelineChartData(
  comparisonMetrics: ComparisonMetrics,
): ChartData<"line", number[], string> {
  const labels = createLabelSeries(
    comparisonMetrics.createdSeries,
    comparisonMetrics.completedSeries,
  );
  const createdLookup = new Map(
    comparisonMetrics.createdSeries.map((entry) => [entry.date, entry.count]),
  );
  const completedLookup = new Map(
    comparisonMetrics.completedSeries.map((entry) => [entry.date, entry.count]),
  );
  const createdValues = labels.map((entry) => createdLookup.get(entry) ?? 0);
  const completedValues = labels.map(
    (entry) => completedLookup.get(entry) ?? 0,
  );

  return {
    labels: labels.map((entry) => formatLabel(entry)),
    datasets: [
      {
        label: "Created",
        data: createdValues,
        borderColor: "#fda4af",
        backgroundColor: "rgba(253, 164, 175, 0.14)",
        tension: 0.25,
        borderWidth: 3,
        pointRadius: 2,
        pointHoverRadius: 4,
      },
      {
        label: "Completed",
        data: completedValues,
        borderColor: "#5eead4",
        backgroundColor: "rgba(94, 234, 212, 0.14)",
        tension: 0.25,
        borderWidth: 3,
        pointRadius: 2,
        pointHoverRadius: 4,
      },
    ],
  };
}

export function buildComparisonSummaryChartData(
  comparisonMetrics: ComparisonMetrics,
): ChartData<"bar", number[], string> {
  const datasets: Array<{
    backgroundColor: string;
    borderColor: string;
    borderRadius: number;
    borderWidth: number;
    data: number[];
    label: string;
  }> = [
    {
      label: "Current period",
      data: [
        comparisonMetrics.currentWindow.created,
        comparisonMetrics.currentWindow.fixed,
        comparisonMetrics.currentWindow.netChange,
        Number(comparisonMetrics.currentWindow.completionRate.toFixed(2)),
      ],
      backgroundColor: "rgba(125, 211, 252, 0.72)",
      borderColor: "#7dd3fc",
      borderWidth: 1,
      borderRadius: 8,
    },
  ];

  if (comparisonMetrics.previousWindow) {
    datasets.push({
      label: "Previous period",
      data: [
        comparisonMetrics.previousWindow.created,
        comparisonMetrics.previousWindow.fixed,
        comparisonMetrics.previousWindow.netChange,
        Number(comparisonMetrics.previousWindow.completionRate.toFixed(2)),
      ],
      backgroundColor: "rgba(94, 234, 212, 0.68)",
      borderColor: "#5eead4",
      borderWidth: 1,
      borderRadius: 8,
    });
  }

  return {
    labels: [
      "Bugs created",
      "Bugs completed",
      "Net change",
      "Completion rate %",
    ],
    datasets,
  };
}

export function buildComparisonWindowHistoryChartData(
  comparisonMetrics: ComparisonMetrics,
): ChartData<"bar", number[], string> {
  const values = comparisonMetrics.historicalWindows.map(
    (window) => window.netChange,
  );

  return {
    labels: comparisonMetrics.historicalWindows.map((window) =>
      format(window.endDate, "MMM d"),
    ),
    datasets: [
      {
        label: `Net change per ${comparisonMetrics.currentWindow.dayCount}-day window`,
        data: values,
        backgroundColor: values.map((value) => {
          if (value < 0) {
            return "rgba(45, 212, 191, 0.72)";
          }

          if (value > 0) {
            return "rgba(248, 113, 113, 0.72)";
          }

          return "rgba(148, 163, 184, 0.72)";
        }),
        borderColor: values.map((value) => {
          if (value < 0) {
            return "#2dd4bf";
          }

          if (value > 0) {
            return "#f87171";
          }

          return "#94a3b8";
        }),
        borderWidth: 1,
        borderRadius: 8,
      },
    ],
  };
}

export function buildComparisonRateHistoryChartData(
  comparisonMetrics: ComparisonMetrics,
): ChartData<"line", number[], string> {
  return {
    labels: comparisonMetrics.historicalWindows.map((window) =>
      format(window.endDate, "MMM d"),
    ),
    datasets: [
      {
        label: "Intake rate",
        data: comparisonMetrics.historicalWindows.map((window) =>
          Number(window.addRate.toFixed(2)),
        ),
        borderColor: "#fda4af",
        backgroundColor: "rgba(253, 164, 175, 0.14)",
        tension: 0.25,
        borderWidth: 3,
        pointRadius: 2,
        pointHoverRadius: 4,
      },
      {
        label: "Fix rate",
        data: comparisonMetrics.historicalWindows.map((window) =>
          Number(window.fixRate.toFixed(2)),
        ),
        borderColor: "#5eead4",
        backgroundColor: "rgba(94, 234, 212, 0.14)",
        tension: 0.25,
        borderWidth: 3,
        pointRadius: 2,
        pointHoverRadius: 4,
      },
    ],
  };
}

export function getSummaryMetrics(
  deadlineMetrics: DeadlineMetrics,
): SummaryMetrics {
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
  };
}
