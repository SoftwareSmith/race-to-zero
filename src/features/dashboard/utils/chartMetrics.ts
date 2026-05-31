import type { ChartData } from "chart.js";
import { compareAsc, eachDayOfInterval, format, parseISO } from "date-fns";
import type {
  ComparisonMetrics,
  DailyCountEntry,
  DeadlineMetrics,
  HistoryMetrics,
  HistoryTrendEntry,
  InsightsMetrics,
} from "../../../types/dashboard";
import { countConfiguredDays } from "@shared/utils/workCalendar";

interface SeriesIndex {
  dates: string[];
  prefixSums: number[];
  series: DailyCountEntry[];
  values: number[];
}

function formatLabel(dateValue: string) {
  return format(parseISO(dateValue), "MMM d");
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

function getSeriesValueAtOrBefore(seriesIndex: SeriesIndex, date: Date | string) {
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

function createLabelSeries(...seriesCollection: DailyCountEntry[][]) {
  return [...new Set(seriesCollection.flatMap((series) => series.map((entry) => entry.date)))].sort(
    (left, right) => left.localeCompare(right),
  );
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
  const hasFutureProjection = labels.some((entry) => entry > todayKey);

  const datasets: Array<{
    label: string;
    data: Array<number | null>;
    borderColor: string;
    backgroundColor: string;
    fill?: boolean;
    tension: number;
    borderWidth: number;
    pointRadius: number;
    pointHoverRadius?: number;
    borderDash?: number[];
  }> = [
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
  ];

  if (hasFutureProjection) {
    datasets.push({
      label: "Projected remaining",
      data: labels.map((entry) => {
        if (entry < todayKey) {
          return null;
        }

        const elapsed = Math.max(
          countConfiguredDays(
            deadlineMetrics.today,
            parseISO(entry),
            deadlineMetrics.workdaySettings,
            { inclusive: false },
          ),
          0,
        );

        return Number(
          Math.max(
            0,
            deadlineMetrics.remainingBugs -
              deadlineMetrics.currentNetBurnRate * elapsed,
          ).toFixed(2),
        );
      }),
      borderColor: "#fca5a5",
      backgroundColor: "rgba(252, 165, 165, 0.12)",
      borderDash: [4, 4],
      tension: 0.18,
      borderWidth: 2,
      pointRadius: 0,
    });
  }

  return {
    labels: labels.map((entry) => formatLabel(entry)),
    datasets,
  };
}

export function buildPriorityChartData(
  metricsWithPriority: DeadlineMetrics,
): ChartData<"bar", number[], string> {
  return {
    labels: metricsWithPriority.priorityDistribution.map((entry) => entry.label),
    datasets: [
      {
        label: "Open bugs",
        data: metricsWithPriority.priorityDistribution.map((entry) => entry.count),
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

export function buildSlaHitRateChartData(
  insightsMetrics: InsightsMetrics,
): ChartData<"bar", number[], string> {
  return {
    labels: insightsMetrics.priorityMetrics.map((entry) => entry.label),
    datasets: [
      {
        label: "SLA hit rate %",
        data: insightsMetrics.priorityMetrics.map((entry) => Number(entry.slaHitRate.toFixed(1))),
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
        data: insightsMetrics.priorityMetrics.map((entry) => entry.missingDueDate),
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
    labels: trendSeries.map((entry) => (entry.date ? formatLabel(entry.date) : "No completions")),
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
        data: insightsMetrics.priorityMetrics.map((entry) => Number(entry.averageResolutionDays.toFixed(1))),
        backgroundColor: "rgba(125, 211, 252, 0.72)",
        borderColor: "#7dd3fc",
        borderWidth: 1,
        borderRadius: 8,
      },
      {
        label: "Avg overdue days",
        data: insightsMetrics.priorityMetrics.map((entry) => Number(entry.averageOverdueDays.toFixed(1))),
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
    labels: trendSeries.map((entry) => (entry.date ? formatLabel(entry.date) : "No closures")),
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
        data: historyMetrics.priorityMetrics.map((entry) => Number(entry.medianCycleDays.toFixed(1))),
        backgroundColor: "rgba(125, 211, 252, 0.72)",
        borderColor: "#7dd3fc",
        borderWidth: 1,
        borderRadius: 8,
      },
      {
        label: "P75 cycle days",
        data: historyMetrics.priorityMetrics.map((entry) => Number(entry.p75CycleDays.toFixed(1))),
        backgroundColor: "rgba(94, 234, 212, 0.68)",
        borderColor: "#5eead4",
        borderWidth: 1,
        borderRadius: 8,
      },
      {
        label: "P90 cycle days",
        data: historyMetrics.priorityMetrics.map((entry) => Number(entry.p90CycleDays.toFixed(1))),
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
    comparisonMetrics.closedSeries,
  );
  const createdLookup = new Map(
    comparisonMetrics.createdSeries.map((entry) => [entry.date, entry.count]),
  );
  const closedLookup = new Map(
    comparisonMetrics.closedSeries.map((entry) => [entry.date, entry.count]),
  );
  const createdValues = labels.map((entry) => createdLookup.get(entry) ?? 0);
  const closedValues = labels.map((entry) => closedLookup.get(entry) ?? 0);

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
        label: "Closed",
        data: closedValues,
        borderColor: "#38bdf8",
        backgroundColor: "rgba(56, 189, 248, 0.14)",
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
        comparisonMetrics.currentWindow.completed,
        comparisonMetrics.currentWindow.closed,
        comparisonMetrics.currentWindow.netChange,
        Number(comparisonMetrics.currentWindow.closureRate.toFixed(2)),
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
        comparisonMetrics.previousWindow.completed,
        comparisonMetrics.previousWindow.closed,
        comparisonMetrics.previousWindow.netChange,
        Number(comparisonMetrics.previousWindow.closureRate.toFixed(2)),
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
      "Bugs closed",
      "Net change",
      "Closure rate %",
    ],
    datasets,
  };
}

export function buildComparisonOutcomeChartData(
  comparisonMetrics: ComparisonMetrics,
): ChartData<"bar", number[], string> {
  return {
    labels: comparisonMetrics.outcomeMetrics.map((entry) => entry.label),
    datasets: [
      {
        label: "Closed bugs",
        data: comparisonMetrics.outcomeMetrics.map((entry) => entry.count),
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

export function buildComparisonWindowHistoryChartData(
  comparisonMetrics: ComparisonMetrics,
): ChartData<"bar", number[], string> {
  const values = comparisonMetrics.historicalWindows.map((window) => window.netChange);

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
        data: comparisonMetrics.historicalWindows.map((window) => Number(window.addRate.toFixed(2))),
        borderColor: "#fda4af",
        backgroundColor: "rgba(253, 164, 175, 0.14)",
        tension: 0.25,
        borderWidth: 3,
        pointRadius: 2,
        pointHoverRadius: 4,
      },
      {
        label: "Closure rate",
        data: comparisonMetrics.historicalWindows.map((window) => Number(window.closedRate.toFixed(2))),
        borderColor: "#38bdf8",
        backgroundColor: "rgba(56, 189, 248, 0.14)",
        tension: 0.25,
        borderWidth: 3,
        pointRadius: 2,
        pointHoverRadius: 4,
      },
    ],
  };
}