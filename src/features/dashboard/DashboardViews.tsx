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
      hint: "Confidence rises when current net burn stays above the required burn.",
      label: "Confidence",
      tone: metricTone,
      value: formatPercent(summary.likelihoodScore),
    },
    {
      hint: "Required daily net backlog reduction to hit zero by the selected deadline.",
      label: "Required net burn",
      tone: metricTone,
      value: `${formatNumber(deadlineMetrics.neededNetBurnRate, 2)}/day`,
    },
    {
      hint: "Recent fixes per day minus recent created bugs per day.",
      label: "Current net burn",
      tone: metricTone,
      value: `${formatNumber(summary.currentNetBurnRate, 2)}/day`,
    },
    {
      hint: dayMetric.hint,
      label: dayMetric.label,
      tone: metricTone,
      value: formatNumber(summary.daysUntilDeadline),
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
      hint: "Created minus closed during the selected period.",
      label: "Net change",
      tone: netChangeTone,
      value: formatSignedNumber(comparisonMetrics.currentWindow.netChange),
    },
    {
      hint: "Closure rate helps normalize periods with different intake volume.",
      label: "Closure rate",
      tone: completionRateTone,
      value: formatPercent(comparisonMetrics.currentWindow.completionRate, 1),
    },
    {
      hint: "Bugs that left the active backlog during the selected period, including completed, canceled, duplicate, and archived terminal work.",
      label: "Bugs closed",
      tone: completedTone,
      value: formatNumber(comparisonMetrics.currentWindow.fixed),
    },
    {
      hint: "New bugs added during the selected period. Lower is better.",
      label: "Bugs created",
      tone: createdTone,
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

function getInsightsOnTimeTone(insightsMetrics: InsightsMetrics): Tone {
  if (insightsMetrics.onTimeCompleted === 0) {
    return "neutral";
  }

  return "positive";
}

function getInsightsOpenOverdueTone(insightsMetrics: InsightsMetrics): Tone {
  if (insightsMetrics.openOverdue === 0) {
    return insightsMetrics.eligibleCompleted > 0 ? "positive" : "neutral";
  }
  return "negative";
}

function buildInsightsMetricCards(
  insightsMetrics: InsightsMetrics,
): MetricCardDefinition[] {
  return [
    {
      hint: "Open bugs that have passed their Linear due date and are not yet resolved.",
      label: "Open SLA risk",
      tone: getInsightsOpenOverdueTone(insightsMetrics),
      value: formatNumber(insightsMetrics.openOverdue),
    },
    {
      hint: "Completed bugs with due dates that closed on or before their Linear due date.",
      label: "SLA hit rate",
      tone: getInsightsHitRateTone(insightsMetrics),
      value: formatPercent(insightsMetrics.slaHitRate, 1),
    },
    {
      hint: "Completed bugs with due dates that closed on or before their Linear due date.",
      label: "On time",
      tone: getInsightsOnTimeTone(insightsMetrics),
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
  return `${formatNumber(insightsMetrics.totalCompleted)} due-dated bugs were completed in ${insightsMetrics.rangeLabel}, split between on-time and overdue completion.`;
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
