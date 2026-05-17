import { Suspense, lazy, memo, useMemo } from "react";
import MetricCard from "@dashboard/components/MetricCard";
import { cn } from "@shared/utils/cn";
import {
  formatNumber,
  formatPercent,
  formatSignedNumber,
  getHistoryCancelledShareTone,
  getHistoryClosedWorkTone,
  getHistoryCompletedShareTone,
  getHistoryCycleTone,
  getNetChangeTone,
  getTargetConfidenceTone,
  getTargetCurrentNetBurnTone,
  getTargetDaysLeftTone,
  getTargetOpenBugsTone,
  getTrendBugsClosedTone,
  getTrendBugsCreatedTone,
  getTrendClosureRateTone,
} from "./utils/dashboard";
import {
  buildComparisonRateHistoryChartData,
  buildComparisonWindowHistoryChartData,
  buildComparisonSummaryChartData,
  buildComparisonTimelineChartData,
  buildDeadlineBurndownChartData,
  buildHistoryCycleBucketChartData,
  buildHistoryCycleTimeChartData,
  buildHistoryOutcomeChartData,
  buildHistoryTrendChartData,
  buildOpenAgeChartData,
  buildPriorityChartData,
  buildResolutionTimeChartData,
  buildSlaHitRateChartData,
  buildSlaOutcomeChartData,
  buildSlaTrendChartData,
  buildStatusChartData,
} from "@dashboard/utils/metrics";
import type {
  ChartFocusState,
  ComparisonMetrics,
  DeadlineMetrics,
  HistoryMetrics,
  InsightsMetrics,
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
    return `The backlog is growing by ${formatNumber(Math.abs(summary.currentNetBurnRate), 2)}/day right now, against ${formatNumber(deadlineMetrics.neededNetBurnRate, 2)}/day reduction needed.`;
  }

  if (summary.currentNetBurnRate >= deadlineMetrics.neededNetBurnRate) {
    return `The backlog is shrinking by ${formatNumber(summary.currentNetBurnRate, 2)}/day, which is ahead of the ${formatNumber(deadlineMetrics.neededNetBurnRate, 2)}/day reduction needed.`;
  }

  return `The backlog is shrinking by ${formatNumber(summary.currentNetBurnRate, 2)}/day, but that is still below the ${formatNumber(deadlineMetrics.neededNetBurnRate, 2)}/day reduction needed to hit the target path.`;
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
      tone: getTargetOpenBugsTone(deadlineMetrics),
      value: formatNumber(summary.bugCount),
    },
    {
      hint: "Confidence is based on how much of the required daily reduction rate you are currently achieving. Green means at least 80% of target, blue means some real progress, red means very little or no reduction.",
      label: "Confidence",
      tone: getTargetConfidenceTone(summary, deadlineMetrics),
      value: formatPercent(summary.likelihoodScore),
    },
    {
      hint: "Required daily backlog reduction to hit zero by the selected deadline.",
      label: "Required reduction",
      tone: "neutral",
      value: `${formatNumber(deadlineMetrics.neededNetBurnRate, 2)}/day`,
    },
    {
      hint: "Recent backlog change per day across all backlog exits. Negative means the backlog is shrinking; positive means it is growing.",
      label: "Net backlog change",
      tone: getTargetCurrentNetBurnTone(deadlineMetrics),
      value: `${formatSignedNumber(-summary.currentNetBurnRate, 2)}/day`,
    },
    {
      hint: dayMetric.hint,
      label: dayMetric.label,
      tone: getTargetDaysLeftTone(deadlineMetrics),
      value: formatNumber(summary.daysUntilDeadline),
    },
  ];
}

function buildPeriodsMetricCards(
  comparisonMetrics: ComparisonMetrics,
): MetricCardDefinition[] {
  return [
    {
      hint: "Created minus closed during the selected period.",
      label: "Net change",
      tone: getNetChangeTone(comparisonMetrics.currentWindow.netChange),
      value: formatSignedNumber(comparisonMetrics.currentWindow.netChange),
    },
    {
      hint: "Closure rate helps normalize periods with different intake volume.",
      label: "Closure rate",
      tone: getTrendClosureRateTone(comparisonMetrics),
      value: formatPercent(comparisonMetrics.currentWindow.completionRate, 1),
    },
    {
      hint: "Bugs that left the active backlog during the selected period, including completed, canceled, duplicate, and archived terminal work.",
      label: "Bugs closed",
      tone: getTrendBugsClosedTone(comparisonMetrics),
      value: formatNumber(comparisonMetrics.currentWindow.fixed),
    },
    {
      hint: "New bugs added during the selected period. Lower is better.",
      label: "Bugs created",
      tone: getTrendBugsCreatedTone(comparisonMetrics),
      value: formatNumber(comparisonMetrics.currentWindow.created),
    },
  ];
}

function getInsightsHitRateTone(insightsMetrics: InsightsMetrics): Tone {
  return insightsMetrics.tone;
}

function getInsightsOverdueTone(insightsMetrics: InsightsMetrics): Tone {
  if (insightsMetrics.overdueCompleted === 0) {
    return insightsMetrics.eligibleCompleted > 0 ? "positive" : "neutral";
  }

  return "negative";
}

function buildInsightsMetricCards(
  insightsMetrics: InsightsMetrics,
): MetricCardDefinition[] {
  return [
    {
      hint: "Bugs completed in the selected period, regardless of whether they landed on time or overdue.",
      label: "Resolved in period",
      tone: "neutral",
      value: formatNumber(insightsMetrics.totalCompleted),
    },
    {
      hint: "Share of due-dated completed bugs that landed on time. Green at 90%+, blue at 75-89.9%, red below 75%.",
      label: "SLA hit rate",
      tone: getInsightsHitRateTone(insightsMetrics),
      value: formatPercent(insightsMetrics.slaHitRate, 1),
    },
    {
      hint: "Completed bugs with due dates that closed on or before their Linear due date.",
      label: "On time",
      tone: "neutral",
      value: formatNumber(insightsMetrics.onTimeCompleted),
    },
    {
      hint: "Completed bugs in this period that were finished after their Linear due date.",
      label: "SLA breaches",
      tone: getInsightsOverdueTone(insightsMetrics),
      value: formatNumber(insightsMetrics.overdueCompleted),
    },
    {
      hint: "Median completion time for bugs completed in the selected period.",
      label: "Median resolve time",
      tone: "neutral",
      value: `${formatNumber(insightsMetrics.medianResolutionDays, 1)}d`,
    },
  ];
}

function buildHistoryMetricCards(
  historyMetrics: HistoryMetrics,
): MetricCardDefinition[] {
  const { currentWindow } = historyMetrics;

  return [
    {
      hint: "All bugs that reached a terminal outcome in the selected period, including completed, cancelled, duplicated, archived, and auto-closed work.",
      label: "Closed work",
      tone: getHistoryClosedWorkTone(),
      value: formatNumber(currentWindow.totalClosed),
    },
    {
      hint: "Share of closed work that ended as completed. Green at 75%+, blue at 60-74.9%, red below 60%.",
      label: "Completed share",
      tone: getHistoryCompletedShareTone(currentWindow),
      value: formatPercent(currentWindow.completionRate, 1),
    },
    {
      hint: "Share of closed work that ended as cancelled. Green at 10% or lower, blue at 10-20%, red above 20%.",
      label: "Cancelled share",
      tone: getHistoryCancelledShareTone(currentWindow),
      value: formatPercent(currentWindow.cancellationRate, 1),
    },
    {
      hint: "Median time from bug creation to terminal outcome for all work closed in the selected period.",
      label: "Median cycle",
      tone: getHistoryCycleTone(),
      value: `${formatNumber(currentWindow.medianCycleDays, 1)}d`,
    },
    {
      hint: "75th percentile cycle time shows the upper-middle band of closure time without jumping all the way to the tail.",
      label: "P75 cycle",
      tone: getHistoryCycleTone(),
      value: `${formatNumber(currentWindow.p75CycleDays, 1)}d`,
    },
    {
      hint: "90th percentile cycle time helps show how painful the slowest closures are even when the median looks acceptable.",
      label: "P90 cycle",
      tone: getHistoryCycleTone(),
      value: `${formatNumber(currentWindow.p90CycleDays, 1)}d`,
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

  return `${leadingStatus.label} is currently the largest active workflow state with ${formatNumber(leadingStatus.count)} bugs in it. Closed states like Done, Cancelled, and Duplicated are excluded from this chart. Done currently contains ${formatNumber(doneCount)} bugs.`;
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

function getSlaHitRateSummary(insightsMetrics: InsightsMetrics) {
  if (insightsMetrics.eligibleCompleted === 0) {
    return "No completed bugs in this period have Linear due dates yet, so SLA hit rate is waiting on more due-date coverage.";
  }

  return `${formatNumber(insightsMetrics.onTimeCompleted)} of ${formatNumber(insightsMetrics.eligibleCompleted)} completed bugs with due dates landed on time in ${insightsMetrics.rangeLabel}.`;
}

function getSlaOutcomeSummary(insightsMetrics: InsightsMetrics) {
  return `${formatNumber(insightsMetrics.totalCompleted)} bugs were completed in ${insightsMetrics.rangeLabel}, split between on-time, overdue, and missing due-date outcomes.`;
}

function getSlaTrendSummary(insightsMetrics: InsightsMetrics) {
  if (!insightsMetrics.trendSeries.length) {
    return "No completed bugs were found in the selected period.";
  }

  return "Daily SLA outcomes show whether overdue completions are clustered on a few delivery days or spread across the period.";
}

function getResolutionTimeSummary(insightsMetrics: InsightsMetrics) {
  return `Median resolution time is ${formatNumber(insightsMetrics.medianResolutionDays, 1)} days, and overdue completions ran ${formatNumber(insightsMetrics.medianOverdueDays, 1)} days late at the median.`;
}

function getHistoryOutcomeSummary(historyMetrics: HistoryMetrics) {
  if (historyMetrics.currentWindow.totalClosed === 0) {
    return `No bugs for ${historyMetrics.teamLabel} reached a terminal outcome in the selected period.`;
  }

  const leadingOutcome = [...historyMetrics.outcomeMetrics].sort(
    (left, right) => right.count - left.count,
  )[0];

  if (!leadingOutcome) {
    return "No closed work was found in the selected period.";
  }

  return `${leadingOutcome.label} is the largest terminal outcome for ${historyMetrics.teamLabel} in ${historyMetrics.rangeLabel} at ${formatNumber(leadingOutcome.count)} bugs.`;
}

function getHistoryTrendSummary(historyMetrics: HistoryMetrics) {
  if (!historyMetrics.trendSeries.length) {
    return `Outcome history for ${historyMetrics.teamLabel} will populate when bugs start reaching terminal states in the selected range.`;
  }

  return `This timeline separates completed work from the non-completion outcomes for ${historyMetrics.teamLabel} so closure quality is visible, not just closure volume.`;
}

function getHistoryCycleTimeSummary(historyMetrics: HistoryMetrics) {
  return `Median cycle time for ${historyMetrics.teamLabel} is ${formatNumber(historyMetrics.currentWindow.medianCycleDays, 1)} days, the 75th percentile is ${formatNumber(historyMetrics.currentWindow.p75CycleDays, 1)} days, and the 90th percentile is ${formatNumber(historyMetrics.currentWindow.p90CycleDays, 1)} days.`;
}

function getHistoryCycleBucketSummary(historyMetrics: HistoryMetrics) {
  const olderClosures = historyMetrics.cycleBuckets
    .filter((bucket) => bucket.label === "31-60d" || bucket.label === "61d+")
    .reduce((sum, bucket) => sum + bucket.count, 0);

  return `${formatNumber(olderClosures)} closures for ${historyMetrics.teamLabel} took longer than 30 days, which helps separate steady throughput from long-tail cleanup.`;
}

function ChartFallback({ className = "" }: { className?: string }) {
  return (
    <div
      className={cn(
        "min-h-[156px] animate-pulse rounded-[20px] border border-white/8 bg-zinc-900/60 sm:min-h-[184px] xl:min-h-[198px]",
        className,
      )}
    />
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
        isWorkdayMode,
      ),
    [deadlineMetrics, isWorkdayMode, summary],
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
    <div className="grid content-start gap-1.5 sm:gap-2">
      <div className="grid gap-1.5 sm:grid-cols-2 sm:gap-2 xl:grid-cols-5">
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

      <div className="grid items-stretch gap-1.5 md:grid-cols-2 sm:gap-2">
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
            description="Open backlog by priority — highest risk at a glance."
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
            description="Active bugs by workflow state. Closed states excluded."
            onHoverStateChange={onChartFocusChange}
            siegeMode={siegeMode}
            summary={statusSummary}
            title="Active bugs by status"
            variant="bar"
          />
        </Suspense>
        <Suspense fallback={<ChartFallback />}>
          <ChartCard
            chartKey="open-age-breakdown"
            className="h-full"
            data={openAgeChartData}
            description="Open backlog by age — separates fresh intake from stale work."
            onHoverStateChange={onChartFocusChange}
            siegeMode={siegeMode}
            summary={openAgeSummary}
            title="Active bug age"
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
    () => buildPeriodsMetricCards(comparisonMetrics),
    [comparisonMetrics],
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
    <div className="grid content-start gap-1.5 sm:gap-2">
      <div className="grid gap-1.5 sm:grid-cols-2 sm:gap-2 xl:grid-cols-4">
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

      <div className="grid items-stretch gap-1.5 md:grid-cols-2 sm:gap-2">
        <Suspense fallback={<ChartFallback />}>
          <ChartCard
            chartKey="comparison-timeline"
            className="h-full"
            data={comparisonTimelineData}
            onHoverStateChange={onChartFocusChange}
            siegeMode={siegeMode}
            description="Daily intake vs closures — shows whether backlog pressure is rising or easing."
            title="Created vs closed over time"
          />
        </Suspense>
        <Suspense fallback={<ChartFallback />}>
          <ChartCard
            chartKey="comparison-summary"
            className="h-full"
            data={comparisonSummaryData}
            description="Current vs previous period across intake, closures, net change, and closure rate."
            onHoverStateChange={onChartFocusChange}
            siegeMode={siegeMode}
            title="Current vs previous window"
            variant="bar"
          />
        </Suspense>
        <Suspense fallback={<ChartFallback />}>
          <ChartCard
            chartKey="period-window-history"
            className="h-full"
            data={comparisonWindowHistoryData}
            description="Historical windows colored by whether backlog grew or shrank."
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
            description="Historical intake vs closure rates across matching windows."
            onHoverStateChange={onChartFocusChange}
            siegeMode={siegeMode}
            summary={rateHistorySummary}
            title="Closure vs intake trend"
          />
        </Suspense>
      </div>
    </div>
  );
});

interface InsightsViewProps {
  insightsMetrics: InsightsMetrics;
  onChartFocusChange?: (nextFocus: ChartFocusState | null) => void;
  siegeMode?: boolean;
}

export const InsightsView = memo(function InsightsView({
  insightsMetrics,
  onChartFocusChange,
  siegeMode = false,
}: InsightsViewProps) {
  const slaHitRateData = useMemo(
    () => buildSlaHitRateChartData(insightsMetrics),
    [insightsMetrics],
  );
  const slaOutcomeData = useMemo(
    () => buildSlaOutcomeChartData(insightsMetrics),
    [insightsMetrics],
  );
  const slaTrendData = useMemo(
    () => buildSlaTrendChartData(insightsMetrics),
    [insightsMetrics],
  );
  const resolutionTimeData = useMemo(
    () => buildResolutionTimeChartData(insightsMetrics),
    [insightsMetrics],
  );
  const metricCards = useMemo(
    () => buildInsightsMetricCards(insightsMetrics),
    [insightsMetrics],
  );
  const slaHitRateSummary = useMemo(
    () => getSlaHitRateSummary(insightsMetrics),
    [insightsMetrics],
  );
  const slaOutcomeSummary = useMemo(
    () => getSlaOutcomeSummary(insightsMetrics),
    [insightsMetrics],
  );
  const slaTrendSummary = useMemo(
    () => getSlaTrendSummary(insightsMetrics),
    [insightsMetrics],
  );
  const resolutionTimeSummary = useMemo(
    () => getResolutionTimeSummary(insightsMetrics),
    [insightsMetrics],
  );

  return (
    <div className="grid content-start gap-1.5 sm:gap-2">
      <div className="grid gap-1.5 sm:grid-cols-2 sm:gap-2 xl:grid-cols-5">
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

      <div className="grid items-stretch gap-1.5 md:grid-cols-2 sm:gap-2">
        <Suspense fallback={<ChartFallback />}>
          <ChartCard
            chartKey="sla-hit-rate-by-priority"
            className="h-full"
            data={slaHitRateData}
            description="Completed bugs grouped by Linear priority, using due date as the SLA target."
            onHoverStateChange={onChartFocusChange}
            siegeMode={siegeMode}
            summary={slaHitRateSummary}
            title="SLA hit rate by severity"
            variant="bar"
          />
        </Suspense>
        <Suspense fallback={<ChartFallback />}>
          <ChartCard
            chartKey="sla-outcomes-by-priority"
            className="h-full"
            data={slaOutcomeData}
            description="Shows on-time completions versus overdue completions for each severity group."
            onHoverStateChange={onChartFocusChange}
            siegeMode={siegeMode}
            summary={slaOutcomeSummary}
            title="SLA outcomes by severity"
            variant="bar"
          />
        </Suspense>
        <Suspense fallback={<ChartFallback />}>
          <ChartCard
            chartKey="sla-outcome-trend"
            className="h-full"
            data={slaTrendData}
            description="Daily completed bugs split by whether they landed on time or overdue against the Linear due date."
            onHoverStateChange={onChartFocusChange}
            siegeMode={siegeMode}
            summary={slaTrendSummary}
            title="SLA outcome trend"
          />
        </Suspense>
        <Suspense fallback={<ChartFallback />}>
          <ChartCard
            chartKey="resolution-time-by-priority"
            className="h-full"
            data={resolutionTimeData}
            description="Average completion time and average overdue size by severity."
            onHoverStateChange={onChartFocusChange}
            siegeMode={siegeMode}
            summary={resolutionTimeSummary}
            title="Resolution time by severity"
            variant="bar"
          />
        </Suspense>
      </div>
    </div>
  );
});

interface HistoryViewProps {
  historyMetrics: HistoryMetrics;
  onChartFocusChange?: (nextFocus: ChartFocusState | null) => void;
  siegeMode?: boolean;
}

export const HistoryView = memo(function HistoryView({
  historyMetrics,
  onChartFocusChange,
  siegeMode = false,
}: HistoryViewProps) {
  const outcomeChartData = useMemo(
    () => buildHistoryOutcomeChartData(historyMetrics),
    [historyMetrics],
  );
  const trendChartData = useMemo(
    () => buildHistoryTrendChartData(historyMetrics),
    [historyMetrics],
  );
  const cycleTimeChartData = useMemo(
    () => buildHistoryCycleTimeChartData(historyMetrics),
    [historyMetrics],
  );
  const cycleBucketChartData = useMemo(
    () => buildHistoryCycleBucketChartData(historyMetrics),
    [historyMetrics],
  );
  const metricCards = useMemo(
    () => buildHistoryMetricCards(historyMetrics),
    [historyMetrics],
  );
  const outcomeSummary = useMemo(
    () => getHistoryOutcomeSummary(historyMetrics),
    [historyMetrics],
  );
  const trendSummary = useMemo(
    () => getHistoryTrendSummary(historyMetrics),
    [historyMetrics],
  );
  const cycleTimeSummary = useMemo(
    () => getHistoryCycleTimeSummary(historyMetrics),
    [historyMetrics],
  );
  const cycleBucketSummary = useMemo(
    () => getHistoryCycleBucketSummary(historyMetrics),
    [historyMetrics],
  );

  return (
    <div className="grid content-start gap-1.5 sm:gap-2">
      <div className="grid gap-1.5 sm:grid-cols-2 sm:gap-2 xl:grid-cols-6">
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

      <div className="grid items-stretch gap-1.5 md:grid-cols-2 sm:gap-2">
        <Suspense fallback={<ChartFallback />}>
          <ChartCard
            chartKey="history-outcome-breakdown"
            className="h-full"
            data={outcomeChartData}
            description="How closed work ended in the selected period across completed and non-completion outcomes."
            onHoverStateChange={onChartFocusChange}
            siegeMode={siegeMode}
            summary={outcomeSummary}
            title="Terminal outcomes"
            variant="bar"
          />
        </Suspense>
        <Suspense fallback={<ChartFallback />}>
          <ChartCard
            chartKey="history-outcome-trend"
            className="h-full"
            data={trendChartData}
            description="Daily terminal outcomes over time so completion quality is visible alongside closure volume."
            onHoverStateChange={onChartFocusChange}
            siegeMode={siegeMode}
            summary={trendSummary}
            title="Closed outcomes over time"
          />
        </Suspense>
        <Suspense fallback={<ChartFallback />}>
          <ChartCard
            chartKey="history-cycle-time"
            className="h-full"
            data={cycleTimeChartData}
            description="Median, P75, and P90 cycle time by priority for bugs that reached a terminal outcome in the selected period."
            onHoverStateChange={onChartFocusChange}
            siegeMode={siegeMode}
            summary={cycleTimeSummary}
            title="Cycle time by priority"
            variant="bar"
          />
        </Suspense>
        <Suspense fallback={<ChartFallback />}>
          <ChartCard
            chartKey="history-cycle-buckets"
            className="h-full"
            data={cycleBucketChartData}
            description="Distribution of closure times from creation to terminal outcome."
            onHoverStateChange={onChartFocusChange}
            siegeMode={siegeMode}
            summary={cycleBucketSummary}
            title="Cycle time distribution"
            variant="bar"
          />
        </Suspense>
      </div>
    </div>
  );
});
