import { Suspense, lazy, memo, useMemo } from "react";
import MetricCard from "@dashboard/components/MetricCard";
import { cn } from "@shared/utils/cn";
import {
  formatNumber,
  formatPercent,
  formatSignedNumber,
  getMetricTone,
  getNetChangeTone,
} from "./utils/dashboard";
import {
  buildComparisonRateHistoryChartData,
  buildComparisonWindowHistoryChartData,
  buildComparisonSummaryChartData,
  buildComparisonTimelineChartData,
  buildDeadlineBurndownChartData,
  buildOpenAgeChartData,
  buildPriorityChartData,
  buildStatusChartData,
} from "@dashboard/utils/metrics";
import type {
  ChartFocusState,
  ComparisonMetrics,
  DeadlineMetrics,
  SummaryMetrics,
  Tone,
  WorkdaySettings,
} from "../../types/dashboard";

const ChartCard = lazy(() => import("@dashboard/components/ChartCard"));

interface MetricCardDefinition {
  hint: string;
  label: string;
  tone: Tone;
  value: string;
}

function getBacklogSummary(
  summary: SummaryMetrics,
  deadlineMetrics: DeadlineMetrics,
) {
  if (summary.currentNetBurnRate <= 0) {
    return `The backlog is not trending downward right now. Current net burn is ${formatNumber(summary.currentNetBurnRate, 2)}/day against ${formatNumber(deadlineMetrics.neededNetBurnRate, 2)}/day needed.`;
  }

  if (summary.currentNetBurnRate >= deadlineMetrics.neededNetBurnRate) {
    return `The backlog is trending downward, and current net burn of ${formatNumber(summary.currentNetBurnRate, 2)}/day is holding ahead of the target path.`;
  }

  return `The backlog is trending downward, but current net burn of ${formatNumber(summary.currentNetBurnRate, 2)}/day is still below the ${formatNumber(deadlineMetrics.neededNetBurnRate, 2)}/day needed to close the gap to the target path.`;
}

function getWorkdayLabelAndHint(
  isWorkdayMode: boolean,
  deadlineLabel: string,
): { hint: string; label: string } {
  if (isWorkdayMode) {
    return {
      hint: `Remaining working days to reach zero by ${deadlineLabel}.`,
      label: "Workdays left",
    };
  }

  return {
    hint: `Days remaining to reach zero by ${deadlineLabel}.`,
    label: "Days left",
  };
}

function buildOverviewMetricCards(
  summary: SummaryMetrics,
  deadlineMetrics: DeadlineMetrics,
  metricTone: Tone,
  isWorkdayMode: boolean,
): MetricCardDefinition[] {
  const dayMetric = getWorkdayLabelAndHint(
    isWorkdayMode,
    summary.deadlineLabel,
  );

  return [
    {
      hint: "Current open backlog size. This same number drives the animated bug field in the background.",
      label: "Open bugs",
      tone: metricTone,
      value: formatNumber(summary.bugCount),
    },
    {
      hint: dayMetric.hint,
      label: dayMetric.label,
      tone: metricTone,
      value: formatNumber(summary.daysUntilDeadline),
    },
    {
      hint: "Recent fixes per day minus recent created bugs per day.",
      label: "Current net burn",
      tone: metricTone,
      value: `${formatNumber(summary.currentNetBurnRate, 2)}/day`,
    },
    {
      hint: "Required daily net backlog reduction to hit zero by the selected deadline.",
      label: "Required net burn",
      tone: metricTone,
      value: `${formatNumber(deadlineMetrics.neededNetBurnRate, 2)}/day`,
    },
    {
      hint: "Confidence rises when current net burn stays above the required burn.",
      label: "Confidence",
      tone: metricTone,
      value: formatPercent(summary.likelihoodScore),
    },
  ];
}

function getCompletedTone(comparisonMetrics: ComparisonMetrics): Tone {
  if (
    comparisonMetrics.currentWindow.fixed >
    comparisonMetrics.currentWindow.created
  ) {
    return "positive";
  }

  if (
    comparisonMetrics.currentWindow.fixed ===
    comparisonMetrics.currentWindow.created
  ) {
    return "neutral";
  }

  return getMetricTone(
    comparisonMetrics.currentWindow.fixed,
    comparisonMetrics.previousWindow?.fixed ?? null,
    true,
  );
}

function getCompletionRateTone(comparisonMetrics: ComparisonMetrics): Tone {
  if (comparisonMetrics.currentWindow.completionRate > 100) {
    return "positive";
  }

  if (Math.abs(comparisonMetrics.currentWindow.completionRate - 100) < 0.01) {
    return "neutral";
  }

  return getMetricTone(
    comparisonMetrics.currentWindow.completionRate,
    comparisonMetrics.previousWindow?.completionRate ?? null,
    true,
  );
}

function buildPeriodsMetricCards(
  comparisonMetrics: ComparisonMetrics,
  createdTone: Tone,
  completedTone: Tone,
  netChangeTone: Tone,
  completionRateTone: Tone,
): MetricCardDefinition[] {
  return [
    {
      hint: "New bugs added during the selected period. Lower is better.",
      label: "Bugs created",
      tone: createdTone,
      value: formatNumber(comparisonMetrics.currentWindow.created),
    },
    {
      hint: "Bugs completed during the selected period. Higher is better.",
      label: "Bugs completed",
      tone: completedTone,
      value: formatNumber(comparisonMetrics.currentWindow.fixed),
    },
    {
      hint: "Created minus completed during the selected period.",
      label: "Net change",
      tone: netChangeTone,
      value: formatSignedNumber(comparisonMetrics.currentWindow.netChange),
    },
    {
      hint: "Completion rate helps normalize periods with different intake volume.",
      label: "Completion rate",
      tone: completionRateTone,
      value: formatPercent(comparisonMetrics.currentWindow.completionRate, 1),
    },
  ];
}

function getStatusDistributionSummary(deadlineMetrics: DeadlineMetrics) {
  const leadingStatus = [...deadlineMetrics.statusDistribution].sort(
    (left, right) => right.count - left.count,
  )[0];
  if (!leadingStatus) {
    return "No workflow states are currently represented in the snapshot.";
  }

  const doneCount = deadlineMetrics.bugs.filter((bug) => {
    const rawValue = bug.stateName?.trim() || bug.stateType?.trim() || "";
    const normalizedValue = rawValue.toLowerCase();

    return (
      normalizedValue === "done" ||
      normalizedValue === "completed" ||
      normalizedValue === "complete" ||
      (!normalizedValue && Boolean(bug.completedAt))
    );
  }).length;

  return `${leadingStatus.label} is currently the largest Linear column with ${formatNumber(leadingStatus.count)} bugs assigned to it. Done is ignored in the chart because its size would dominate the rest of the workflow view (${formatNumber(doneCount)} bugs).`;
}

function getHistoricalWindowSummary(comparisonMetrics: ComparisonMetrics) {
  const improvingWindows = comparisonMetrics.historicalWindows.filter(
    (window) => window.netChange < 0,
  ).length;
  const regressingWindows = comparisonMetrics.historicalWindows.filter(
    (window) => window.netChange > 0,
  ).length;

  return `Each bar is one ${comparisonMetrics.currentWindow.dayCount}-day window of backlog movement. ${formatNumber(improvingWindows)} windows reduced the queue while ${formatNumber(regressingWindows)} increased it.`;
}

function getOpenAgeSummary(deadlineMetrics: DeadlineMetrics) {
  const ageChartData = buildOpenAgeDistributionSummary(deadlineMetrics);
  return ageChartData;
}

function buildOpenAgeDistributionSummary(deadlineMetrics: DeadlineMetrics) {
  const ageDistribution =
    buildOpenAgeChartData(deadlineMetrics).datasets[0]?.data ?? [];
  const olderThanNinety =
    Number(ageDistribution[3] ?? 0) + Number(ageDistribution[4] ?? 0);

  return `${formatNumber(olderThanNinety)} open bugs are older than 90 days, which helps separate fresh intake from long-running backlog.`;
}

function getRateHistorySummary(comparisonMetrics: ComparisonMetrics) {
  return `This trend compares historical fix velocity with intake velocity over matching ${comparisonMetrics.currentWindow.dayCount}-day windows so it is easier to see when throughput actually overtakes incoming bugs.`;
}

function ChartFallback({ className = "" }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex min-h-[180px] items-center rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(10,12,18,0.96),rgba(19,23,32,0.96))] p-3.5 text-sm text-stone-400",
        className,
      )}
    >
      Loading chart...
    </div>
  );
}

export { default as StatusBanner } from "@shared/components/StatusBanner";

interface OverviewViewProps {
  deadlineMetrics: DeadlineMetrics;
  onChartFocusChange?: (nextFocus: ChartFocusState | null) => void;
  siegeMode?: boolean;
  summary: SummaryMetrics;
  workdaySettings: WorkdaySettings;
}

export const OverviewView = memo(function OverviewView({
  deadlineMetrics,
  onChartFocusChange,
  siegeMode = false,
  summary,
  workdaySettings,
}: OverviewViewProps) {
  const metricTone = deadlineMetrics.statusTone;
  const isWorkdayMode =
    workdaySettings.excludeWeekends || workdaySettings.excludePublicHolidays;
  const backlogSummary = getBacklogSummary(summary, deadlineMetrics);
  const deadlineBurndownData = useMemo(
    () => buildDeadlineBurndownChartData(deadlineMetrics),
    [deadlineMetrics],
  );
  const priorityChartData = useMemo(
    () => buildPriorityChartData(deadlineMetrics),
    [deadlineMetrics],
  );
  const statusChartData = useMemo(
    () => buildStatusChartData(deadlineMetrics),
    [deadlineMetrics],
  );
  const openAgeChartData = useMemo(
    () => buildOpenAgeChartData(deadlineMetrics),
    [deadlineMetrics],
  );
  const metricCards = useMemo(
    () =>
      buildOverviewMetricCards(
        summary,
        deadlineMetrics,
        metricTone,
        isWorkdayMode,
      ),
    [deadlineMetrics, isWorkdayMode, metricTone, summary],
  );
  const statusSummary = useMemo(
    () => getStatusDistributionSummary(deadlineMetrics),
    [deadlineMetrics],
  );
  const openAgeSummary = useMemo(
    () => getOpenAgeSummary(deadlineMetrics),
    [deadlineMetrics],
  );

  return (
    <div className="grid content-start gap-2">
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
        {metricCards.map((metricCard) => (
          <MetricCard
            key={metricCard.label}
            hint={metricCard.hint}
            label={metricCard.label}
            siegeMode={siegeMode}
            tone={metricCard.tone}
            value={metricCard.value}
          />
        ))}
      </div>

      <div className="grid items-stretch gap-2 md:grid-cols-2">
        <Suspense fallback={<ChartFallback />}>
          <ChartCard
            chartKey="bug-burndown"
            className="h-full"
            data={deadlineBurndownData}
            onHoverStateChange={onChartFocusChange}
            siegeMode={siegeMode}
            summary={backlogSummary}
            title="Bug burndown"
          />
        </Suspense>
        <Suspense fallback={<ChartFallback />}>
          <ChartCard
            chartKey="priority-breakdown"
            className="h-full"
            data={priorityChartData}
            description="Breakdown of the open backlog by priority so the biggest risk pockets are visible without hovering."
            onHoverStateChange={onChartFocusChange}
            siegeMode={siegeMode}
            title="Open bugs by priority"
            variant="bar"
          />
        </Suspense>
        <Suspense fallback={<ChartFallback />}>
          <ChartCard
            chartKey="status-breakdown"
            className="h-full"
            data={statusChartData}
            description="Bug counts grouped by your Linear workflow columns using a fixed dashboard order."
            onHoverStateChange={onChartFocusChange}
            siegeMode={siegeMode}
            summary={statusSummary}
            title="Bugs by status"
            variant="bar"
          />
        </Suspense>
        <Suspense fallback={<ChartFallback />}>
          <ChartCard
            chartKey="open-age-breakdown"
            className="h-full"
            data={openAgeChartData}
            description="Open backlog grouped by age so stale work is visible separately from fresh intake."
            onHoverStateChange={onChartFocusChange}
            siegeMode={siegeMode}
            summary={openAgeSummary}
            title="Open bug age"
            variant="bar"
          />
        </Suspense>
      </div>
    </div>
  );
});

interface PeriodsViewProps {
  comparisonMetrics: ComparisonMetrics;
  onChartFocusChange?: (nextFocus: ChartFocusState | null) => void;
  siegeMode?: boolean;
}

export const PeriodsView = memo(function PeriodsView({
  comparisonMetrics,
  onChartFocusChange,
  siegeMode = false,
}: PeriodsViewProps) {
  const createdTone = getMetricTone(
    comparisonMetrics.currentWindow.created,
    comparisonMetrics.previousWindow?.created ?? null,
    false,
  );
  const completedTone = getCompletedTone(comparisonMetrics);
  const netChangeTone = getNetChangeTone(
    comparisonMetrics.currentWindow.netChange,
  );
  const completionRateTone = getCompletionRateTone(comparisonMetrics);
  const comparisonTimelineData = useMemo(
    () => buildComparisonTimelineChartData(comparisonMetrics),
    [comparisonMetrics],
  );
  const comparisonSummaryData = useMemo(
    () => buildComparisonSummaryChartData(comparisonMetrics),
    [comparisonMetrics],
  );
  const comparisonWindowHistoryData = useMemo(
    () => buildComparisonWindowHistoryChartData(comparisonMetrics),
    [comparisonMetrics],
  );
  const comparisonRateHistoryData = useMemo(
    () => buildComparisonRateHistoryChartData(comparisonMetrics),
    [comparisonMetrics],
  );
  const metricCards = useMemo(
    () =>
      buildPeriodsMetricCards(
        comparisonMetrics,
        createdTone,
        completedTone,
        netChangeTone,
        completionRateTone,
      ),
    [
      comparisonMetrics,
      completionRateTone,
      completedTone,
      createdTone,
      netChangeTone,
    ],
  );
  const historicalWindowSummary = useMemo(
    () => getHistoricalWindowSummary(comparisonMetrics),
    [comparisonMetrics],
  );
  const rateHistorySummary = useMemo(
    () => getRateHistorySummary(comparisonMetrics),
    [comparisonMetrics],
  );

  return (
    <div className="grid content-start gap-2">
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {metricCards.map((metricCard) => (
          <MetricCard
            key={metricCard.label}
            hint={metricCard.hint}
            label={metricCard.label}
            siegeMode={siegeMode}
            tone={metricCard.tone}
            value={metricCard.value}
          />
        ))}
      </div>

      <div className="grid items-stretch gap-2 md:grid-cols-2">
        <Suspense fallback={<ChartFallback />}>
          <ChartCard
            chartKey="comparison-timeline"
            className="h-full"
            data={comparisonTimelineData}
            onHoverStateChange={onChartFocusChange}
            siegeMode={siegeMode}
            summary="Compare daily intake against completions to see whether recent periods are relieving pressure or letting backlog build."
            title="Created vs completed over time"
          />
        </Suspense>
        <Suspense fallback={<ChartFallback />}>
          <ChartCard
            chartKey="comparison-summary"
            className="h-full"
            data={comparisonSummaryData}
            description="Each x-axis group is one metric type, with current and previous period bars paired so the change is easy to read."
            onHoverStateChange={onChartFocusChange}
            siegeMode={siegeMode}
            summary="These bars compare the current period with the previous one across intake, completions, net movement, and completion rate."
            title="Current vs previous window"
            variant="bar"
          />
        </Suspense>
        <Suspense fallback={<ChartFallback />}>
          <ChartCard
            chartKey="period-window-history"
            className="h-full"
            data={comparisonWindowHistoryData}
            description="Non-overlapping historical windows for the currently selected range, colored by whether backlog grew or shrank in each period."
            onHoverStateChange={onChartFocusChange}
            siegeMode={siegeMode}
            summary={historicalWindowSummary}
            title="Period-by-period net change"
            variant="bar"
          />
        </Suspense>
        <Suspense fallback={<ChartFallback />}>
          <ChartCard
            chartKey="period-rate-history"
            className="h-full"
            data={comparisonRateHistoryData}
            description="Historical intake and fix rates across the same non-overlapping windows as the net-change view."
            onHoverStateChange={onChartFocusChange}
            siegeMode={siegeMode}
            summary={rateHistorySummary}
            title="Fix vs intake trend"
          />
        </Suspense>
      </div>
    </div>
  );
});
