import {
  compareAsc,
  differenceInCalendarDays,
  endOfYear,
  format,
  isBefore,
  isValid,
  parseISO,
  startOfDay,
  subDays,
} from "date-fns";
import type {
  BootstrapMetricsSnapshot,
  BootstrapMetricsSource,
  DailyCountEntry,
  DeadlineMetrics,
  MetricsBug,
  MetricsSource,
  OpenAgeDistributionEntry,
  PriorityDistributionEntry,
  StatusDistributionEntry,
  Tone,
  WorkdaySettings,
} from "../../../types/dashboard.js";
import { countConfiguredDays } from "../../../shared/utils/workCalendar.js";

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

interface SeriesIndex {
  dates: string[];
  prefixSums: number[];
  series: DailyCountEntry[];
  values: number[];
}

interface PreparedBootstrapSource {
  completedSeries: DailyCountEntry[];
  createdSeries: DailyCountEntry[];
  doneCount: number;
  firstBugDate: Date | null;
  openAgeDistribution: OpenAgeDistributionEntry[];
  priorityDistribution: PriorityDistributionEntry[];
  remainingBugs: number;
  remainingSeries: DailyCountEntry[];
  statusDistribution: StatusDistributionEntry[];
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
    count: counts.get(label) ?? 0,
    label,
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
    count: counts.get(label) ?? 0,
    label,
  }));
}

function isTerminalStatusLabel(statusLabel: string) {
  return statusLabel === "Cancelled" || statusLabel === "Duplicated";
}

function getBugClosureDate(bug: MetricsBug) {
  if (bug.completedAt) {
    return bug.completedAt;
  }

  const statusLabel = getLinearStatusLabel(bug);

  if (statusLabel === "Cancelled") {
    return bug.canceledAt ?? bug.updatedAt ?? bug.autoClosedAt ?? bug.archivedAt ?? null;
  }

  if (statusLabel === "Duplicated") {
    return bug.canceledAt ?? bug.autoClosedAt ?? bug.archivedAt ?? bug.updatedAt ?? null;
  }

  if (bug.autoClosedAt) {
    return bug.autoClosedAt;
  }

  if (bug.archivedAt) {
    return bug.archivedAt;
  }

  if (bug.canceledAt) {
    return bug.canceledAt;
  }

  return null;
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

function getSeriesValueBefore(seriesIndex: SeriesIndex, date: Date | string) {
  const dateKey = typeof date === "string" ? date : format(date, "yyyy-MM-dd");
  const index = findLowerBound(seriesIndex.dates, dateKey) - 1;

  if (index < 0) {
    return 0;
  }

  return seriesIndex.values[index] ?? 0;
}

function buildOpenAgeDistribution(
  bugs: MetricsBug[],
  today: Date,
): OpenAgeDistributionEntry[] {
  const bucketCounts = new Map<string, number>([
    ["0-7d", 0],
    ["8-30d", 0],
    ["31-90d", 0],
    ["91-180d", 0],
    ["181d+", 0],
  ]);

  for (const bug of bugs) {
    if (getBugClosureDate(bug) != null) {
      continue;
    }

    if (isTerminalStatusLabel(getLinearStatusLabel(bug))) {
      continue;
    }

    const createdAt = parseISO(bug.createdAt);
    const ageInDays = Math.max(differenceInCalendarDays(today, createdAt), 0);
    const label =
      ageInDays <= 7
        ? "0-7d"
        : ageInDays <= 30
          ? "8-30d"
          : ageInDays <= 90
            ? "31-90d"
            : ageInDays <= 180
              ? "91-180d"
              : "181d+";

    bucketCounts.set(label, (bucketCounts.get(label) ?? 0) + 1);
  }

  return ["0-7d", "8-30d", "31-90d", "91-180d", "181d+"] .map((label) => ({
    count: bucketCounts.get(label) ?? 0,
    label,
  }));
}

function createBootstrapSnapshotFromBugs(
  bugs: MetricsBug[],
): BootstrapMetricsSnapshot {
  const priorityCounts = new Map<string, number>();
  const statusCounts = new Map<string, number>();
  let doneCount = 0;
  let remainingBugs = 0;

  for (const bug of bugs) {
    const statusLabel = getLinearStatusLabel(bug);
    if (statusLabel === "Done") {
      doneCount += 1;
    }

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
  const today = startOfDay(new Date());

  return {
    completedSeries,
    createdSeries,
    doneCount,
    firstBugDate: bugs[0]?.createdAt ?? null,
    openAgeDistribution: buildOpenAgeDistribution(bugs, today),
    priorityDistribution: buildPriorityDistributionFromCounts(priorityCounts),
    remainingBugs,
    remainingSeries,
    statusDistribution: buildStatusDistributionFromCounts(statusCounts),
  };
}

export function buildBootstrapMetricsSource(
  source: MetricsSource | null | undefined,
): BootstrapMetricsSource {
  const bugs = normalizeBugRecords(source);
  const teamKeys = [
    ...new Set(
      bugs
        .map((bug) => bug.teamKey?.trim() ?? "")
        .filter((teamKey) => teamKey.length > 0),
    ),
  ].sort((left, right) => left.localeCompare(right));
  const byTeam = Object.fromEntries(
    teamKeys.map((teamKey) => [
      teamKey,
      createBootstrapSnapshotFromBugs(
        bugs.filter((bug) => bug.teamKey === teamKey),
      ),
    ]),
  );

  return {
    all: createBootstrapSnapshotFromBugs(bugs),
    byTeam,
    generatedAt: source?.generatedAt,
    lastUpdated: source?.lastUpdated,
    teamKeys,
  };
}

function isBootstrapMetricsSource(
  source: BootstrapMetricsSource | MetricsSource | null | undefined,
): source is BootstrapMetricsSource {
  return Boolean(source && "all" in source && "byTeam" in source);
}

function getPreparedSourceForTeam(
  source: BootstrapMetricsSource | MetricsSource | null | undefined,
  teamKey?: string | null,
) {
  if (isBootstrapMetricsSource(source)) {
    const snapshot = (teamKey ? source.byTeam[teamKey] : source.all) ?? source.all;

    return {
      completedSeries: snapshot.completedSeries,
      createdSeries: snapshot.createdSeries,
      doneCount: snapshot.doneCount,
      firstBugDate: snapshot.firstBugDate ? parseISO(snapshot.firstBugDate) : null,
      openAgeDistribution: snapshot.openAgeDistribution,
      priorityDistribution: snapshot.priorityDistribution,
      remainingBugs: snapshot.remainingBugs,
      remainingSeries: snapshot.remainingSeries,
      statusDistribution: snapshot.statusDistribution,
    } satisfies PreparedBootstrapSource;
  }

  const bootstrapSource = buildBootstrapMetricsSource(source);
  return getPreparedSourceForTeam(bootstrapSource, teamKey);
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

function getDeadlineStatus({
  currentNetBurnRate,
  daysUntilDeadline,
  neededNetBurnRate,
  remainingBugs,
}: {
  currentNetBurnRate: number;
  daysUntilDeadline: number;
  neededNetBurnRate: number;
  remainingBugs: number;
}) {
  if (remainingBugs === 0) {
    return {
      body: "The current snapshot shows no remaining bugs in scope.",
      headline: "Queue is already at zero",
      signal: "Ahead",
      tone: "positive" as Tone,
    };
  }

  if (daysUntilDeadline === 0) {
    return {
      body: "There is no remaining runway to burn down the current backlog.",
      headline: "Deadline has arrived",
      signal: "Behind",
      tone: "negative" as Tone,
    };
  }

  if (currentNetBurnRate >= neededNetBurnRate) {
    return {
      body: "Recent fix velocity is offsetting new bugs and still reducing the backlog quickly enough to reach zero by the selected deadline if the same trend holds.",
      headline: "Ahead of the zero-bug pace",
      signal: "Ahead",
      tone: "positive" as Tone,
    };
  }

  if (currentNetBurnRate > 0 && currentNetBurnRate / neededNetBurnRate >= 0.5) {
    return {
      body: "Recent fix velocity is still reducing the backlog, but not quickly enough to reach zero by the selected deadline without more throughput or less intake.",
      headline: "Backlog is improving but off pace",
      signal: "Watch",
      tone: "neutral" as Tone,
    };
  }

  return {
    body: "Recent intake is matching or exceeding fixes, so the backlog is not burning down fast enough to hit the selected deadline without a throughput change.",
    headline: "Behind the zero-bug pace",
    signal: "Behind",
    tone: "negative" as Tone,
  };
}

function getLikelihoodScore({
  currentNetBurnRate,
  daysUntilDeadline,
  neededNetBurnRate,
  remainingBugs,
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

export function getBootstrapDeadlineMetrics(
  source: BootstrapMetricsSource | MetricsSource | null,
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
  const createdIndex = buildSeriesIndex(preparedSource.createdSeries);
  const completedIndex = buildSeriesIndex(preparedSource.completedSeries);
  const remainingIndex = buildSeriesIndex(preparedSource.remainingSeries, {
    usePrefixSums: false,
  });
  const remainingBugs = preparedSource.remainingBugs;
  const today = startOfDay(new Date());
  const defaultDeadline = getDeadlineDate(today);
  const deadline = getValidDate(deadlineDate, defaultDeadline);
  const firstBugDate: Date = preparedSource.firstBugDate ?? today;
  const requestedTrackingStartDate: Date = getValidDate(
    trackingStartDate,
    subDays(today, DEADLINE_TREND_WINDOW_DAYS - 1),
  );
  const trackingStart: Date = isBefore(requestedTrackingStartDate, firstBugDate)
    ? firstBugDate
    : requestedTrackingStartDate;
  const recentCreatedPerDay = filterSeriesByDateRange(
    createdIndex,
    trackingStart,
    today,
  );
  const recentCompletedPerDay = filterSeriesByDateRange(
    completedIndex,
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
    currentNetBurnRate,
    daysUntilDeadline,
    neededNetBurnRate,
    remainingBugs,
  });

  return {
    allRemainingPerDay: preparedSource.remainingSeries,
    bugsPerDayRequired,
    currentAddRate,
    currentFixRate,
    currentNetBurnRate,
    daysUntilDeadline,
    deadline,
    deadlineLabel: format(deadline, "MMM d, yyyy"),
    doneCount: preparedSource.doneCount,
    likelihoodScore: getLikelihoodScore({
      currentNetBurnRate,
      daysUntilDeadline,
      neededNetBurnRate,
      remainingBugs,
    }),
    neededNetBurnRate,
    onTrack: status.tone === "positive",
    openAgeDistribution: preparedSource.openAgeDistribution,
    priorityDistribution: preparedSource.priorityDistribution,
    remainingBugs,
    statusBody: status.body,
    statusDistribution: preparedSource.statusDistribution,
    statusHeadline: status.headline,
    statusSignal: status.signal,
    statusTone: status.tone,
    today,
    trackingStartBacklog: getSeriesValueBefore(remainingIndex, trackingStart),
    trackingStartDate: trackingStart,
    trackingStartLabel: format(trackingStart, "MMM d, yyyy"),
    trendWindowLabel: `${format(trackingStart, "MMM d")} - ${format(today, "MMM d")}`,
    workdaySettings: activeWorkdaySettings,
  };
}