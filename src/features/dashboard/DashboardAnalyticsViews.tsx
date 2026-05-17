import { memo, useMemo } from "react";
import MetricCard from "@dashboard/components/MetricCard";
import ChartCard from "@dashboard/components/ChartCard";
import {
  formatNumber,
  formatPercent,
  formatSignedNumber,
  getHistoryCancelledShareTone,
  getHistoryClosedWorkTone,
  getHistoryCompletedShareTone,
  getHistoryCycleTone,
  getNetChangeTone,
  getTrendBugsClosedTone,
  getTrendBugsCreatedTone,
  getTrendClosureRateTone,
} from "./utils/dashboard";
import {
  buildComparisonRateHistoryChartData,
  buildComparisonSummaryChartData,
  buildComparisonTimelineChartData,
  buildComparisonWindowHistoryChartData,
  buildHistoryCycleBucketChartData,
  buildHistoryCycleTimeChartData,
  buildHistoryOutcomeChartData,
  buildHistoryTrendChartData,
  buildResolutionTimeChartData,
  buildSlaHitRateChartData,
  buildSlaOutcomeChartData,
  buildSlaTrendChartData,
} from "@dashboard/utils/chartMetrics";
import type {
  ChartFocusState,
  ComparisonMetrics,
  HistoryMetrics,
  InsightsMetrics,
  Tone,
} from "../../types/dashboard";

interface MetricCardDefinition {
  hint: string;
  label: string;
  tone: Tone;
  value: string;
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

function getHistoricalWindowSummary(comparisonMetrics: ComparisonMetrics) {
  const improvingWindows = comparisonMetrics.historicalWindows.filter(
    (window) => window.netChange < 0,
  ).length;
  const regressingWindows = comparisonMetrics.historicalWindows.filter(
    (window) => window.netChange > 0,
  ).length;

  return `Each bar is one ${comparisonMetrics.currentWindow.dayCount}-day window of backlog movement. ${formatNumber(improvingWindows)} windows reduced the queue while ${formatNumber(regressingWindows)} increased it.`;
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
        <ChartCard
          chartKey="comparison-timeline"
          className="h-full"
          data={comparisonTimelineData}
          description="Daily intake vs closures — shows whether backlog pressure is rising or easing."
          onHoverStateChange={onChartFocusChange}
          siegeMode={siegeMode}
          title="Created vs closed over time"
        />
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
      </div>
    </div>
  );
});
