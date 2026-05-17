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
  HistoryCycleBucketEntry,
  HistoryMetrics,
  HistoryOutcomeKey,
  HistoryOutcomeMetric,
  HistoryPriorityMetrics,
  HistoryTrendEntry,
  HistoryWindowMetrics,
  InsightsMetrics,
  InsightsPriorityMetrics,
  InsightsTrendEntry,
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
  "Other",
] as const;
const OPEN_AGE_BUCKETS = [
  { label: "0-7d", maxDays: 7 },
  { label: "8-30d", maxDays: 30 },
  { label: "31-90d", maxDays: 90 },
  { label: "91-180d", maxDays: 180 },
  { label: "181d+", maxDays: Number.POSITIVE_INFINITY },
] as const;
const HISTORY_OUTCOME_ORDER = [
  "completed",
  "cancelled",
  "duplicated",
  "autoClosed",
  "archived",
] as const satisfies readonly HistoryOutcomeKey[];
const HISTORY_CYCLE_BUCKETS = [
  { label: "0-3d", maxDays: 3 },
  { label: "4-7d", maxDays: 7 },
  { label: "8-14d", maxDays: 14 },
  { label: "15-30d", maxDays: 30 },
  { label: "31-60d", maxDays: 60 },
  { label: "61d+", maxDays: Number.POSITIVE_INFINITY },
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

interface BurndownSeriesSource {
  completedIndex: SeriesIndex;
  createdIndex: SeriesIndex;
}

interface BacklogHistorySource {
  completedIndex: SeriesIndex;
  createdIndex: SeriesIndex;
  firstBugDate: Date | null;
  remainingIndex: SeriesIndex;
  remainingSeries: DailyCountEntry[];
}

interface TerminalHistoryEvent {
  date: string;
  outcome: HistoryOutcomeKey;
}

function normalizeBugRecords(
  source: MetricsSource | null | undefined,
): MetricsBug[] {
  return [...(source?.bugs ?? [])]
    .map((entry) => ({
      archivedAt: entry.archivedAt || null,
      autoClosedAt: entry.autoClosedAt || null,
      canceledAt: entry.canceledAt || null,
      completedAt: entry.completedAt || null,
      createdAt: entry.createdAt,
      dueDate: entry.dueDate || null,
      priority: Number(entry.priority ?? 0),
      stateName: entry.stateName ?? null,
      stateType: entry.stateType ?? null,
      teamKey: entry.teamKey ?? null,
      updatedAt: entry.updatedAt || null,
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

function getHistoryOutcomeLabel(outcome: HistoryOutcomeKey) {
  switch (outcome) {
    case "completed":
      return "Completed";
    case "cancelled":
      return "Cancelled";
    case "duplicated":
      return "Duplicated";
    case "autoClosed":
      return "Auto-closed";
    case "archived":
      return "Archived";
    default:
      return "Closed";
  }
}

function buildStatusDistributionFromCounts(
  counts: Map<string, number>,
): StatusDistributionEntry[] {
  return STATUS_ORDER.map((label) => ({
    label,
    count: counts.get(label) ?? 0,
  }));
}

function isTerminalStatusLabel(statusLabel: string) {
  return statusLabel === "Cancelled" || statusLabel === "Duplicated";
}

function getBugTerminalEvent(bug: MetricsBug): TerminalHistoryEvent | null {
  if (bug.completedAt) {
    return {
      date: bug.completedAt,
      outcome: "completed",
    };
  }

  const statusLabel = getLinearStatusLabel(bug);

  if (statusLabel === "Cancelled") {
    const date =
      bug.canceledAt ?? bug.updatedAt ?? bug.autoClosedAt ?? bug.archivedAt;

    return date
      ? {
          date,
          outcome: "cancelled",
        }
      : null;
  }

  if (statusLabel === "Duplicated") {
    const date =
      bug.canceledAt ?? bug.autoClosedAt ?? bug.archivedAt ?? bug.updatedAt;

    return date
      ? {
          date,
          outcome: "duplicated",
        }
      : null;
  }

  if (bug.autoClosedAt) {
    return {
      date: bug.autoClosedAt,
      outcome: "autoClosed",
    };
  }

  if (bug.archivedAt) {
    return {
      date: bug.archivedAt,
      outcome: "archived",
    };
  }

  if (bug.canceledAt) {
    return {
      date: bug.canceledAt,
      outcome: "cancelled",
    };
  }

  return null;
}

function getBugClosureDate(bug: MetricsBug) {
  return getBugTerminalEvent(bug)?.date ?? null;
}

function buildOpenAgeDistribution(
  bugs: MetricsBug[],
  today: Date,
) {
  const bucketCounts = new Map<string, number>(
    OPEN_AGE_BUCKETS.map((bucket) => [bucket.label, 0]),
  );

  for (const bug of bugs) {
    if (getBugClosureDate(bug) != null) {
      continue;
    }

    if (isTerminalStatusLabel(getLinearStatusLabel(bug))) {
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

function buildClosureSeries(bugs: MetricsBug[]): DailyCountEntry[] {
  const countsByDay = new Map<string, number>();

  for (const bug of bugs) {
    const value = getBugClosureDate(bug);
    if (!value) {
      continue;
    }

    countsByDay.set(value, (countsByDay.get(value) ?? 0) + 1);
  }

  return [...countsByDay.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, count]) => ({ date, count }));
}

function buildBurndownSeriesSource(bugs: MetricsBug[]): BurndownSeriesSource {
  const burndownBugs = bugs.filter(
    (bug) => !isTerminalStatusLabel(getLinearStatusLabel(bug)),
  );
  const createdSeries = buildSeriesFromField(burndownBugs, "createdAt");
  const completedSeries = buildSeriesFromField(burndownBugs, "completedAt");

  return {
    completedIndex: buildSeriesIndex(completedSeries),
    createdIndex: buildSeriesIndex(createdSeries),
  };
}

function buildBacklogHistorySource(bugs: MetricsBug[]): BacklogHistorySource {
  const createdSeries = buildSeriesFromField(bugs, "createdAt");
  const completedSeries = buildClosureSeries(bugs);
  const remainingSeries = buildRemainingSeries(createdSeries, completedSeries);

  return {
    completedIndex: buildSeriesIndex(completedSeries),
    createdIndex: buildSeriesIndex(createdSeries),
    firstBugDate: bugs[0]?.createdAt ? parseISO(bugs[0].createdAt) : null,
    remainingIndex: buildSeriesIndex(remainingSeries, { usePrefixSums: false }),
    remainingSeries,
  };
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

function getSeriesValueBefore(seriesIndex: SeriesIndex, date: Date | string) {
  const dateKey = typeof date === "string" ? date : format(date, "yyyy-MM-dd");
  const index = findLowerBound(seriesIndex.dates, dateKey) - 1;

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
    if (!isTerminalStatusLabel(statusLabel) && statusLabel !== "Done") {
      statusCounts.set(statusLabel, (statusCounts.get(statusLabel) ?? 0) + 1);
    }

    if (getBugClosureDate(bug) == null && !isTerminalStatusLabel(statusLabel)) {
      remainingBugs += 1;
      const label = getPriorityLabel(bug.priority);
      priorityCounts.set(label, (priorityCounts.get(label) ?? 0) + 1);
    }
  }

  const createdSeries = buildSeriesFromField(bugs, "createdAt");
  const completedSeries = buildClosureSeries(bugs);
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

function createPreparedSourceFromBugs(bugs: MetricsBug[]): PreparedMetricsSource {
  const priorityCounts = new Map<string, number>();
  const statusCounts = new Map<string, number>();
  let remainingBugs = 0;

  for (const bug of bugs) {
    const statusLabel = getLinearStatusLabel(bug);
    if (!isTerminalStatusLabel(statusLabel) && statusLabel !== "Done") {
      statusCounts.set(statusLabel, (statusCounts.get(statusLabel) ?? 0) + 1);
    }

    if (getBugClosureDate(bug) == null && !isTerminalStatusLabel(statusLabel)) {
      remainingBugs += 1;
      const label = getPriorityLabel(bug.priority);
      priorityCounts.set(label, (priorityCounts.get(label) ?? 0) + 1);
    }
  }

  const createdSeries = buildSeriesFromField(bugs, "createdAt");
  const completedSeries = buildClosureSeries(bugs);
  const remainingSeries = buildRemainingSeries(createdSeries, completedSeries);

  return {
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
}

function getPreparedSourceForTeam(
  source: MetricsSource | null | undefined,
  teamKey?: string | null,
) {
  const preparedSource = prepareMetricsSource(source);

  if (!teamKey) {
    return preparedSource;
  }

  return createPreparedSourceFromBugs(
    preparedSource.bugs.filter((bug) => bug.teamKey === teamKey),
  );
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

function getSelectedRangeDates(
  preparedSource: PreparedMetricsSource,
  {
    customFromDate,
    customToDate,
    rangeKey = "30",
  }: {
    customFromDate?: string;
    customToDate?: string;
    rangeKey?: CompareRangeKey;
  },
) {
  const today = startOfDay(new Date());
  const earliestDate = preparedSource.firstBugDate ?? today;
  const isAllTime = rangeKey === "all";
  const isCustom = rangeKey === "custom";

  if (isCustom) {
    const customDates = getCustomRangeDates(
      customFromDate,
      customToDate,
      today,
    );

    return {
      ...customDates,
      isAllTime,
      isCustom,
      rangeLabel: `Custom: ${getDisplayRangeLabel(customDates.startDate, customDates.endDate)}`,
      today,
    };
  }

  if (isAllTime) {
    return {
      startDate: earliestDate,
      endDate: today,
      isAllTime,
      isCustom,
      rangeLabel: "All time",
      today,
    };
  }

  return {
    startDate: subDays(today, getNumericRangeDays(rangeKey, 30) - 1),
    endDate: today,
    isAllTime,
    isCustom,
    rangeLabel: `Last ${rangeKey} days`,
    today,
  };
}

function isDateInRange(
  dateValue: string | null | undefined,
  startDate: Date,
  endDate: Date,
) {
  if (!dateValue) {
    return false;
  }

  const dateKey = dateValue.slice(0, 10);
  return (
    dateKey >= format(startDate, "yyyy-MM-dd") &&
    dateKey <= format(endDate, "yyyy-MM-dd")
  );
}

function getAverage(values: number[]) {
  if (!values.length) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function getMedian(values: number[]) {
  if (!values.length) {
    return 0;
  }

  const sortedValues = [...values].sort((left, right) => left - right);
  const middleIndex = Math.floor(sortedValues.length / 2);

  if (sortedValues.length % 2 === 1) {
    return sortedValues[middleIndex] ?? 0;
  }

  return (
    ((sortedValues[middleIndex - 1] ?? 0) + (sortedValues[middleIndex] ?? 0)) /
    2
  );
}

function getPercentile(values: number[], percentile: number) {
  if (!values.length) {
    return 0;
  }

  const sortedValues = [...values].sort((left, right) => left - right);
  const clampedPercentile = Math.max(0, Math.min(percentile, 100));
  const index = Math.min(
    sortedValues.length - 1,
    Math.max(0, Math.ceil((clampedPercentile / 100) * sortedValues.length) - 1),
  );

  return sortedValues[index] ?? 0;
}

function getResolutionDays(bug: MetricsBug) {
  if (!bug.completedAt) {
    return 0;
  }

  return Math.max(
    differenceInCalendarDays(parseISO(bug.completedAt), parseISO(bug.createdAt)),
    0,
  );
}

function getLifecycleDays(bug: MetricsBug, terminalDate: string) {
  return Math.max(
    differenceInCalendarDays(parseISO(terminalDate), parseISO(bug.createdAt)),
    0,
  );
}

function createEmptyHistoryWindowMetrics(): HistoryWindowMetrics {
  return {
    archived: 0,
    autoClosed: 0,
    averageCycleDays: 0,
    cancellationRate: 0,
    cancelled: 0,
    completionRate: 0,
    completed: 0,
    duplicated: 0,
    medianCycleDays: 0,
    p75CycleDays: 0,
    p90CycleDays: 0,
    totalClosed: 0,
  };
}

function createEmptyHistoryPriorityMetrics(
  label: string,
): HistoryPriorityMetrics {
  return {
    archived: 0,
    autoClosed: 0,
    averageCycleDays: 0,
    cancelled: 0,
    completed: 0,
    duplicated: 0,
    label,
    medianCycleDays: 0,
    p75CycleDays: 0,
    p90CycleDays: 0,
    totalClosed: 0,
  };
}

function createEmptyHistoryTrendEntry(date: string): HistoryTrendEntry {
  return {
    archived: 0,
    autoClosed: 0,
    cancelled: 0,
    completed: 0,
    date,
    duplicated: 0,
    total: 0,
  };
}

function finalizeHistoryWindowMetrics(
  metrics: HistoryWindowMetrics,
  cycleDays: number[],
): HistoryWindowMetrics {
  return {
    ...metrics,
    averageCycleDays: getAverage(cycleDays),
    cancellationRate:
      metrics.totalClosed > 0
        ? (metrics.cancelled / metrics.totalClosed) * 100
        : 0,
    completionRate:
      metrics.totalClosed > 0
        ? (metrics.completed / metrics.totalClosed) * 100
        : 0,
    medianCycleDays: getMedian(cycleDays),
    p75CycleDays: getPercentile(cycleDays, 75),
    p90CycleDays: getPercentile(cycleDays, 90),
  };
}

function getHistoryTone(
  currentWindow: HistoryWindowMetrics,
  previousWindow: HistoryWindowMetrics | null,
): Tone {
  void previousWindow;

  if (currentWindow.totalClosed === 0) {
    return "neutral";
  }

  if (currentWindow.completionRate >= 75 && currentWindow.cancellationRate <= 10) {
    return "positive";
  }

  if (currentWindow.completionRate >= 60 && currentWindow.cancellationRate <= 20) {
    return "neutral";
  }

  return "negative";
}

function getHistoryWindowStats(
  preparedSource: PreparedMetricsSource,
  startDate: Date,
  endDate: Date,
  teamKey?: string | null,
): HistoryWindowMetrics {
  const cycleDays: number[] = [];
  const metrics = createEmptyHistoryWindowMetrics();

  for (const bug of preparedSource.bugs) {
    if (teamKey && bug.teamKey !== teamKey) {
      continue;
    }

    const terminalEvent = getBugTerminalEvent(bug);
    if (!terminalEvent || !isDateInRange(terminalEvent.date, startDate, endDate)) {
      continue;
    }

    const lifecycleDays = getLifecycleDays(bug, terminalEvent.date);
    cycleDays.push(lifecycleDays);
    metrics.totalClosed += 1;

    switch (terminalEvent.outcome) {
      case "completed":
        metrics.completed += 1;
        break;
      case "cancelled":
        metrics.cancelled += 1;
        break;
      case "duplicated":
        metrics.duplicated += 1;
        break;
      case "autoClosed":
        metrics.autoClosed += 1;
        break;
      case "archived":
        metrics.archived += 1;
        break;
      default:
        break;
    }
  }

  return finalizeHistoryWindowMetrics(metrics, cycleDays);
}

function createEmptyInsightsPriorityMetrics(
  label: string,
): InsightsPriorityMetrics {
  return {
    averageOverdueDays: 0,
    averageResolutionDays: 0,
    overdueCompleted: 0,
    eligible: 0,
    label,
    medianOverdueDays: 0,
    medianResolutionDays: 0,
    missingDueDate: 0,
    onTime: 0,
    slaHitRate: 0,
    totalCompleted: 0,
  };
}

function finalizeInsightsPriorityMetrics(
  metrics: InsightsPriorityMetrics,
  resolutionDays: number[],
  overdueDays: number[],
) {
  return {
    ...metrics,
    averageOverdueDays: getAverage(overdueDays),
    averageResolutionDays: getAverage(resolutionDays),
    medianOverdueDays: getMedian(overdueDays),
    medianResolutionDays: getMedian(resolutionDays),
    slaHitRate:
      metrics.eligible > 0 ? (metrics.onTime / metrics.eligible) * 100 : 0,
  };
}

const SLA_HIT_RATE_POSITIVE_THRESHOLD = 90;
const SLA_HIT_RATE_NEUTRAL_THRESHOLD = 75;

function getInsightsTone(slaHitRate: number, eligibleCompleted: number): Tone {
  if (eligibleCompleted === 0) {
    return "neutral";
  }

  if (slaHitRate >= SLA_HIT_RATE_POSITIVE_THRESHOLD) {
    return "positive";
  }

  if (slaHitRate >= SLA_HIT_RATE_NEUTRAL_THRESHOLD) {
    return "neutral";
  }

  return "negative";
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

  if (currentNetBurnRate > 0 && currentNetBurnRate / neededNetBurnRate >= 0.5) {
    return {
      tone: "neutral" as Tone,
      signal: "Watch",
      headline: "Backlog is improving but off pace",
      body: "Recent fix velocity is still reducing the backlog, but not quickly enough to reach zero by the selected deadline without more throughput or less intake.",
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

  if (currentNetBurnRate <= 0) {
    return 0;
  }

  return Math.max(
    0,
    Math.min(100, Math.round((currentNetBurnRate / neededNetBurnRate) * 100)),
  );
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
    teamKey,
    trackingStartDate,
    workdaySettings,
  }: {
    deadlineDate?: string;
    teamKey?: string | null;
    trackingStartDate?: string;
    workdaySettings?: WorkdaySettings;
  } = {},
): DeadlineMetrics {
  const preparedSource = getPreparedSourceForTeam(source, teamKey);
  const backlogHistorySource = buildBacklogHistorySource(preparedSource.bugs);
  const remainingBugs = preparedSource.remainingBugs;
  const today = startOfDay(new Date());
  const defaultDeadline = getDeadlineDate(today);
  const deadline = getValidDate(deadlineDate, defaultDeadline);
  const firstBugDate = backlogHistorySource.firstBugDate ?? today;
  const requestedTrackingStartDate = getValidDate(
    trackingStartDate,
    subDays(today, DEADLINE_TREND_WINDOW_DAYS - 1),
  );
  const trackingStart = isBefore(requestedTrackingStartDate, firstBugDate)
    ? firstBugDate
    : requestedTrackingStartDate;
  const recentCreatedPerDay = filterSeriesByDateRange(
    backlogHistorySource.createdIndex,
    trackingStart,
    today,
  );
  const recentCompletedPerDay = filterSeriesByDateRange(
    backlogHistorySource.completedIndex,
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
    allRemainingPerDay: backlogHistorySource.remainingSeries,
    remainingBugs,
    trackingStartDate: trackingStart,
    trackingStartLabel: format(trackingStart, "MMM d, yyyy"),
    trackingStartBacklog: getSeriesValueBefore(
      backlogHistorySource.remainingIndex,
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
    doneCount: preparedSource.bugs.filter((bug) => getLinearStatusLabel(bug) === "Done").length,
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
    openAgeDistribution: buildOpenAgeDistribution(preparedSource.bugs, today),
    priorityDistribution: preparedSource.priorityDistribution,
    statusDistribution: preparedSource.statusDistribution,
    today,
    workdaySettings: activeWorkdaySettings,
  };
}

export function buildDeadlineBurndownChartData(
  deadlineMetrics: DeadlineMetrics,
): ChartData<"line", Array<number | null>, string> {
  const trackingStartKey = format(deadlineMetrics.trackingStartDate, "yyyy-MM-dd");
  const todayKey = format(deadlineMetrics.today, "yyyy-MM-dd");
  const rangeEnd =
    compareAsc(deadlineMetrics.today, deadlineMetrics.deadline) === 1
      ? deadlineMetrics.today
      : deadlineMetrics.deadline;
  const labels = eachDayOfInterval({
    start: deadlineMetrics.trackingStartDate,
    end: rangeEnd,
  }).map((entry) => format(entry, "yyyy-MM-dd"));
  const remainingIndex = buildSeriesIndex(deadlineMetrics.allRemainingPerDay, {
    usePrefixSums: false,
  });
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
        data: labels.map((entry) => {
          if (entry > todayKey) {
            return null;
          }

          return entry === trackingStartKey
            ? getSeriesValueBefore(remainingIndex, entry)
            : getSeriesValueAtOrBefore(remainingIndex, entry);
        }),
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
  const ageDistribution = deadlineMetrics.openAgeDistribution;

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
    teamKey,
  }: {
    customFromDate?: string;
    customToDate?: string;
    rangeKey?: CompareRangeKey;
    teamKey?: string | null;
  } = {},
): ComparisonMetrics {
  const preparedSource = getPreparedSourceForTeam(source, teamKey);
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

export function getInsightsMetrics(
  source: MetricsSource | null,
  {
    rangeKey = "30",
    customFromDate,
    customToDate,
    teamKey,
  }: {
    customFromDate?: string;
    customToDate?: string;
    rangeKey?: CompareRangeKey;
    teamKey?: string | null;
  } = {},
): InsightsMetrics {
  const preparedSource = getPreparedSourceForTeam(source, teamKey);
  const { startDate, endDate, rangeLabel, today } = getSelectedRangeDates(
    preparedSource,
    { rangeKey, customFromDate, customToDate },
  );
  const currentWindow = getWindowStats(preparedSource, startDate, endDate);
  const completedInRange = preparedSource.bugs.filter((bug) =>
    isDateInRange(bug.completedAt, startDate, endDate),
  );
  const priorityBuckets = new Map(
    PRIORITY_ORDER.map((label) => [
      label,
      {
        metrics: createEmptyInsightsPriorityMetrics(label),
        overdueDays: [] as number[],
        resolutionDays: [] as number[],
      },
    ]),
  );
  const trendCounts = new Map<string, InsightsTrendEntry>();
  const resolutionDays: number[] = [];
  const overdueDays: number[] = [];
  let onTimeCompleted = 0;
  let overdueCompleted = 0;
  let missingDueDate = 0;

  for (const bug of completedInRange) {
    const priorityLabel = getPriorityLabel(bug.priority);
    const bucket = priorityBuckets.get(priorityLabel);
    const completedAt = bug.completedAt as string;
    const resolutionDayCount = getResolutionDays(bug);
    const trendEntry = trendCounts.get(completedAt) ?? {
      completed: 0,
      date: completedAt,
      onTime: 0,
      overdueCompleted: 0,
    };

    trendEntry.completed += 1;
    resolutionDays.push(resolutionDayCount);

    if (bucket) {
      bucket.metrics.totalCompleted += 1;
      bucket.resolutionDays.push(resolutionDayCount);
    }

    if (!bug.dueDate) {
      missingDueDate += 1;
      if (bucket) {
        bucket.metrics.missingDueDate += 1;
      }
      trendCounts.set(completedAt, trendEntry);
      continue;
    }

    if (bucket) {
      bucket.metrics.eligible += 1;
    }

    if (completedAt <= bug.dueDate) {
      onTimeCompleted += 1;
      trendEntry.onTime += 1;
      if (bucket) {
        bucket.metrics.onTime += 1;
      }
    } else {
      const overdueDayCount = Math.max(
        differenceInCalendarDays(parseISO(completedAt), parseISO(bug.dueDate)),
        0,
      );

      overdueCompleted += 1;
      trendEntry.overdueCompleted += 1;
      overdueDays.push(overdueDayCount);
      if (bucket) {
        bucket.metrics.overdueCompleted += 1;
        bucket.overdueDays.push(overdueDayCount);
      }
    }

    trendCounts.set(completedAt, trendEntry);
  }

  let openOverdue = 0;
  let openPending = 0;
  for (const bug of preparedSource.bugs) {
    if (getBugClosureDate(bug) != null || !bug.dueDate) {
      continue;
    }

    if (isTerminalStatusLabel(getLinearStatusLabel(bug))) {
      continue;
    }

    const daysUntilDue = differenceInCalendarDays(parseISO(bug.dueDate), today);
    if (daysUntilDue < 0) {
      openOverdue += 1;
    } else if (daysUntilDue <= 7) {
      openPending += 1;
    }
  }

  const eligibleCompleted = onTimeCompleted + overdueCompleted;
  const slaHitRate =
    eligibleCompleted > 0 ? (onTimeCompleted / eligibleCompleted) * 100 : 0;
  const tone = getInsightsTone(slaHitRate, eligibleCompleted);
  const priorityMetrics = PRIORITY_ORDER.map((label) => {
    const bucket = priorityBuckets.get(label);
    return bucket
      ? finalizeInsightsPriorityMetrics(
          bucket.metrics,
          bucket.resolutionDays,
          bucket.overdueDays,
        )
      : createEmptyInsightsPriorityMetrics(label);
  });
  const headline =
    eligibleCompleted === 0
      ? "SLA due dates need more coverage"
      : tone === "positive"
        ? "SLA delivery is holding strong"
        : tone === "neutral"
          ? "SLA delivery is close to target"
          : "SLA delivery needs attention";
  const body =
    eligibleCompleted === 0
      ? `No completed bugs in ${rangeLabel} have a due date, so SLA hit rate cannot be calculated yet.`
        : `${onTimeCompleted} of ${eligibleCompleted} completed bugs with due dates landed on or before SLA in ${rangeLabel}. ${overdueCompleted} completed after their due date and ${missingDueDate} completed bugs were missing due dates.`;

  return {
    averageOverdueDays: getAverage(overdueDays),
    averageResolutionDays: getAverage(resolutionDays),
    body,
    overdueCompleted,
    currentWindow,
    openPending,
    eligibleCompleted,
    headline,
    medianOverdueDays: getMedian(overdueDays),
    medianResolutionDays: getMedian(resolutionDays),
    missingDueDate,
    onTimeCompleted,
    openOverdue,
    priorityMetrics,
    rangeLabel,
    slaHitRate,
    tone,
    totalCompleted: completedInRange.length,
    trendSeries: [...trendCounts.values()].sort((left, right) =>
      left.date.localeCompare(right.date),
    ),
  };
}

export function getHistoryMetrics(
  source: MetricsSource | null,
  {
    rangeKey = "30",
    customFromDate,
    customToDate,
    teamKey,
  }: {
    customFromDate?: string;
    customToDate?: string;
    rangeKey?: CompareRangeKey;
    teamKey?: string | null;
  } = {},
): HistoryMetrics {
  const preparedSource = getPreparedSourceForTeam(source, teamKey);
  const { startDate, endDate, isAllTime, rangeLabel, today } = getSelectedRangeDates(
    preparedSource,
    { rangeKey, customFromDate, customToDate },
  );
  const historyTeamLabel = teamKey ?? "All teams";
  const dayCount = Math.max(differenceInCalendarDays(endDate, startDate) + 1, 1);
  const previousWindow = isAllTime
    ? null
    : getHistoryWindowStats(
        preparedSource,
        subDays(startDate, dayCount),
        subDays(startDate, 1),
        teamKey,
      );

  const cycleDays: number[] = [];
  const outcomeCounts = new Map<HistoryOutcomeKey, number>(
    HISTORY_OUTCOME_ORDER.map((outcome) => [outcome, 0]),
  );
  const cycleBucketCounts = new Map<string, number>(
    HISTORY_CYCLE_BUCKETS.map((bucket) => [bucket.label, 0]),
  );
  const trendCounts = new Map<string, HistoryTrendEntry>();
  const priorityBuckets = new Map(
    PRIORITY_ORDER.map((label) => [
      label,
      {
        cycleDays: [] as number[],
        metrics: createEmptyHistoryPriorityMetrics(label),
      },
    ]),
  );

  for (const bug of preparedSource.bugs) {
    if (teamKey && bug.teamKey !== teamKey) {
      continue;
    }

    const terminalEvent = getBugTerminalEvent(bug);
    if (!terminalEvent || !isDateInRange(terminalEvent.date, startDate, endDate)) {
      continue;
    }

    const lifecycleDays = getLifecycleDays(bug, terminalEvent.date);
    const priorityLabel = getPriorityLabel(bug.priority);
    const priorityBucket = priorityBuckets.get(priorityLabel);
    const trendEntry =
      trendCounts.get(terminalEvent.date) ??
      createEmptyHistoryTrendEntry(terminalEvent.date);
    const cycleBucket = HISTORY_CYCLE_BUCKETS.find(
      (bucket) => lifecycleDays <= bucket.maxDays,
    );

    cycleDays.push(lifecycleDays);
    outcomeCounts.set(
      terminalEvent.outcome,
      (outcomeCounts.get(terminalEvent.outcome) ?? 0) + 1,
    );
    trendEntry.total += 1;

    if (priorityBucket) {
      priorityBucket.metrics.totalClosed += 1;
      priorityBucket.cycleDays.push(lifecycleDays);
    }

    if (cycleBucket) {
      cycleBucketCounts.set(
        cycleBucket.label,
        (cycleBucketCounts.get(cycleBucket.label) ?? 0) + 1,
      );
    }

    switch (terminalEvent.outcome) {
      case "completed":
        trendEntry.completed += 1;
        if (priorityBucket) {
          priorityBucket.metrics.completed += 1;
        }
        break;
      case "cancelled":
        trendEntry.cancelled += 1;
        if (priorityBucket) {
          priorityBucket.metrics.cancelled += 1;
        }
        break;
      case "duplicated":
        trendEntry.duplicated += 1;
        if (priorityBucket) {
          priorityBucket.metrics.duplicated += 1;
        }
        break;
      case "autoClosed":
        trendEntry.autoClosed += 1;
        if (priorityBucket) {
          priorityBucket.metrics.autoClosed += 1;
        }
        break;
      case "archived":
        trendEntry.archived += 1;
        if (priorityBucket) {
          priorityBucket.metrics.archived += 1;
        }
        break;
      default:
        break;
    }

    trendCounts.set(terminalEvent.date, trendEntry);
  }

  const currentWindow = finalizeHistoryWindowMetrics(
    {
      archived: outcomeCounts.get("archived") ?? 0,
      autoClosed: outcomeCounts.get("autoClosed") ?? 0,
      averageCycleDays: 0,
      cancellationRate: 0,
      cancelled: outcomeCounts.get("cancelled") ?? 0,
      completionRate: 0,
      completed: outcomeCounts.get("completed") ?? 0,
      duplicated: outcomeCounts.get("duplicated") ?? 0,
      medianCycleDays: 0,
      p75CycleDays: 0,
      p90CycleDays: 0,
      totalClosed: cycleDays.length,
    },
    cycleDays,
  );
  const tone = getHistoryTone(currentWindow, previousWindow);
  const outcomeMetrics: HistoryOutcomeMetric[] = HISTORY_OUTCOME_ORDER.map(
    (outcome) => {
      const count = outcomeCounts.get(outcome) ?? 0;

      return {
        count,
        key: outcome,
        label: getHistoryOutcomeLabel(outcome),
        percent: currentWindow.totalClosed > 0 ? (count / currentWindow.totalClosed) * 100 : 0,
      };
    },
  );
  const priorityMetrics: HistoryPriorityMetrics[] = PRIORITY_ORDER.map((label) => {
    const bucket = priorityBuckets.get(label);
    if (!bucket) {
      return createEmptyHistoryPriorityMetrics(label);
    }

    return {
      ...bucket.metrics,
      averageCycleDays: getAverage(bucket.cycleDays),
      medianCycleDays: getMedian(bucket.cycleDays),
      p75CycleDays: getPercentile(bucket.cycleDays, 75),
      p90CycleDays: getPercentile(bucket.cycleDays, 90),
    };
  });
  const cycleBuckets: HistoryCycleBucketEntry[] = HISTORY_CYCLE_BUCKETS.map(
    (bucket) => ({
      count: cycleBucketCounts.get(bucket.label) ?? 0,
      label: bucket.label,
    }),
  );
  const trendSeries = [...trendCounts.values()].sort((left, right) =>
    left.date.localeCompare(right.date),
  );
  const olderClosures = cycleBuckets
    .filter((bucket) => bucket.label === "31-60d" || bucket.label === "61d+")
    .reduce((sum, bucket) => sum + bucket.count, 0);
  const headline =
    currentWindow.totalClosed === 0
      ? `No closed work for ${historyTeamLabel} in this period`
      : tone === "positive"
        ? `Closed work is landing mostly as completed for ${historyTeamLabel}`
        : tone === "neutral"
          ? `Closed work is mixed across outcomes for ${historyTeamLabel}`
          : `Closed work is leaning away from completion for ${historyTeamLabel}`;
  const body =
    currentWindow.totalClosed === 0
      ? `No bugs for ${historyTeamLabel} reached a terminal state in ${rangeLabel}.`
      : `${currentWindow.completed} of ${currentWindow.totalClosed} closed bugs for ${historyTeamLabel} landed as completed in ${rangeLabel}. Median cycle time was ${Number(currentWindow.medianCycleDays.toFixed(1))} days, the 75th percentile was ${Number(currentWindow.p75CycleDays.toFixed(1))} days, and ${olderClosures} closures took longer than 30 days.`;

  void today;

  return {
    body,
    currentWindow,
    cycleBuckets,
    headline,
    outcomeMetrics,
    previousWindow,
    priorityMetrics,
    rangeLabel,
    teamKey: teamKey ?? null,
    teamLabel: historyTeamLabel,
    tone,
    trendSeries,
  };
}

export function buildSlaHitRateChartData(
  insightsMetrics: InsightsMetrics,
): ChartData<"bar", number[], string> {
  return {
    labels: insightsMetrics.priorityMetrics.map((entry) => entry.label),
    datasets: [
      {
        label: "SLA hit rate %",
        data: insightsMetrics.priorityMetrics.map((entry) =>
          Number(entry.slaHitRate.toFixed(1)),
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

export function buildSlaOutcomeChartData(
  insightsMetrics: InsightsMetrics,
): ChartData<"bar", number[], string> {
  return {
    labels: insightsMetrics.priorityMetrics.map((entry) => entry.label),
    datasets: [
      {
        label: "On time",
        data: insightsMetrics.priorityMetrics.map((entry) => entry.onTime),
        backgroundColor: "rgba(45, 212, 191, 0.72)",
        borderColor: "#2dd4bf",
        borderWidth: 1,
        borderRadius: 8,
      },
      {
        label: "Breached",
        data: insightsMetrics.priorityMetrics.map((entry) => entry.overdueCompleted),
        backgroundColor: "rgba(248, 113, 113, 0.72)",
        borderColor: "#f87171",
        borderWidth: 1,
        borderRadius: 8,
      },
      {
        label: "Missing due date",
        data: insightsMetrics.priorityMetrics.map(
          (entry) => entry.missingDueDate,
        ),
        backgroundColor: "rgba(148, 163, 184, 0.64)",
        borderColor: "#94a3b8",
        borderWidth: 1,
        borderRadius: 8,
      },
    ],
  };
}

export function buildSlaTrendChartData(
  insightsMetrics: InsightsMetrics,
): ChartData<"line", number[], string> {
  const trendSeries = insightsMetrics.trendSeries.length
    ? insightsMetrics.trendSeries
    : [{ completed: 0, date: "", onTime: 0, overdueCompleted: 0 }];

  return {
    labels: trendSeries.map((entry) =>
      entry.date ? formatLabel(entry.date) : "No completions",
    ),
    datasets: [
      {
        label: "On time",
        data: trendSeries.map((entry) => entry.onTime),
        borderColor: "#5eead4",
        backgroundColor: "rgba(94, 234, 212, 0.14)",
        tension: 0.25,
        borderWidth: 3,
        pointRadius: 2,
        pointHoverRadius: 4,
      },
      {
        label: "Overdue",
        data: trendSeries.map((entry) => entry.overdueCompleted),
        borderColor: "#f87171",
        backgroundColor: "rgba(248, 113, 113, 0.14)",
        tension: 0.25,
        borderWidth: 3,
        pointRadius: 2,
        pointHoverRadius: 4,
      },
    ],
  };
}

export function buildResolutionTimeChartData(
  insightsMetrics: InsightsMetrics,
): ChartData<"bar", number[], string> {
  return {
    labels: insightsMetrics.priorityMetrics.map((entry) => entry.label),
    datasets: [
      {
        label: "Avg resolution days",
        data: insightsMetrics.priorityMetrics.map((entry) =>
          Number(entry.averageResolutionDays.toFixed(1)),
        ),
        backgroundColor: "rgba(125, 211, 252, 0.72)",
        borderColor: "#7dd3fc",
        borderWidth: 1,
        borderRadius: 8,
      },
      {
        label: "Avg overdue days",
        data: insightsMetrics.priorityMetrics.map((entry) =>
          Number(entry.averageOverdueDays.toFixed(1)),
        ),
        backgroundColor: "rgba(251, 191, 36, 0.7)",
        borderColor: "#fbbf24",
        borderWidth: 1,
        borderRadius: 8,
      },
    ],
  };
}

export function buildHistoryOutcomeChartData(
  historyMetrics: HistoryMetrics,
): ChartData<"bar", number[], string> {
  return {
    labels: historyMetrics.outcomeMetrics.map((entry) => entry.label),
    datasets: [
      {
        label: "Closed bugs",
        data: historyMetrics.outcomeMetrics.map((entry) => entry.count),
        backgroundColor: [
          "rgba(45, 212, 191, 0.72)",
          "rgba(248, 113, 113, 0.72)",
          "rgba(249, 168, 212, 0.7)",
          "rgba(251, 191, 36, 0.7)",
          "rgba(148, 163, 184, 0.72)",
        ],
        borderColor: ["#2dd4bf", "#f87171", "#f9a8d4", "#fbbf24", "#94a3b8"],
        borderWidth: 1,
        borderRadius: 8,
      },
    ],
  };
}

export function buildHistoryTrendChartData(
  historyMetrics: HistoryMetrics,
): ChartData<"line", number[], string> {
  const trendSeries = historyMetrics.trendSeries.length
    ? historyMetrics.trendSeries
    : [createEmptyHistoryTrendEntry("")];

  return {
    labels: trendSeries.map((entry) =>
      entry.date ? formatLabel(entry.date) : "No closures",
    ),
    datasets: [
      {
        label: "Completed",
        data: trendSeries.map((entry) => entry.completed),
        borderColor: "#2dd4bf",
        backgroundColor: "rgba(45, 212, 191, 0.14)",
        tension: 0.25,
        borderWidth: 3,
        pointRadius: 2,
        pointHoverRadius: 4,
      },
      {
        label: "Cancelled",
        data: trendSeries.map((entry) => entry.cancelled),
        borderColor: "#f87171",
        backgroundColor: "rgba(248, 113, 113, 0.14)",
        tension: 0.25,
        borderWidth: 3,
        pointRadius: 2,
        pointHoverRadius: 4,
      },
      {
        label: "Duplicated",
        data: trendSeries.map((entry) => entry.duplicated),
        borderColor: "#f9a8d4",
        backgroundColor: "rgba(249, 168, 212, 0.14)",
        tension: 0.25,
        borderWidth: 3,
        pointRadius: 2,
        pointHoverRadius: 4,
      },
      {
        label: "Auto-closed",
        data: trendSeries.map((entry) => entry.autoClosed),
        borderColor: "#fbbf24",
        backgroundColor: "rgba(251, 191, 36, 0.14)",
        tension: 0.25,
        borderWidth: 3,
        pointRadius: 2,
        pointHoverRadius: 4,
      },
      {
        label: "Archived",
        data: trendSeries.map((entry) => entry.archived),
        borderColor: "#94a3b8",
        backgroundColor: "rgba(148, 163, 184, 0.14)",
        tension: 0.25,
        borderWidth: 3,
        pointRadius: 2,
        pointHoverRadius: 4,
      },
    ],
  };
}

export function buildHistoryCycleTimeChartData(
  historyMetrics: HistoryMetrics,
): ChartData<"bar", number[], string> {
  return {
    labels: historyMetrics.priorityMetrics.map((entry) => entry.label),
    datasets: [
      {
        label: "Median cycle days",
        data: historyMetrics.priorityMetrics.map((entry) =>
          Number(entry.medianCycleDays.toFixed(1)),
        ),
        backgroundColor: "rgba(125, 211, 252, 0.72)",
        borderColor: "#7dd3fc",
        borderWidth: 1,
        borderRadius: 8,
      },
      {
        label: "P75 cycle days",
        data: historyMetrics.priorityMetrics.map((entry) =>
          Number(entry.p75CycleDays.toFixed(1)),
        ),
        backgroundColor: "rgba(94, 234, 212, 0.68)",
        borderColor: "#5eead4",
        borderWidth: 1,
        borderRadius: 8,
      },
      {
        label: "P90 cycle days",
        data: historyMetrics.priorityMetrics.map((entry) =>
          Number(entry.p90CycleDays.toFixed(1)),
        ),
        backgroundColor: "rgba(251, 191, 36, 0.7)",
        borderColor: "#fbbf24",
        borderWidth: 1,
        borderRadius: 8,
      },
    ],
  };
}

export function buildHistoryCycleBucketChartData(
  historyMetrics: HistoryMetrics,
): ChartData<"bar", number[], string> {
  return {
    labels: historyMetrics.cycleBuckets.map((entry) => entry.label),
    datasets: [
      {
        label: "Closed bugs",
        data: historyMetrics.cycleBuckets.map((entry) => entry.count),
        backgroundColor: [
          "rgba(56, 189, 248, 0.72)",
          "rgba(45, 212, 191, 0.72)",
          "rgba(125, 211, 252, 0.72)",
          "rgba(251, 191, 36, 0.72)",
          "rgba(249, 115, 22, 0.72)",
          "rgba(248, 113, 113, 0.72)",
        ],
        borderColor: ["#38bdf8", "#2dd4bf", "#7dd3fc", "#fbbf24", "#f97316", "#f87171"],
        borderWidth: 1,
        borderRadius: 8,
      },
    ],
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
