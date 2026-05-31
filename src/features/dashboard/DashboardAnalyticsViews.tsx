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
  const otherClosures = Math.max(
    comparisonMetrics.currentWindow.closed -
      comparisonMetrics.currentWindow.completed,
    0,
  );

  return [
    {
      hint: "Created minus closed bugs during the selected period. Closures include completed, canceled, duplicate, archived, and auto-closed outcomes.",
      label: "Net change",
      tone: getNetChangeTone(comparisonMetrics.currentWindow.netChange),
      value: formatSignedNumber(comparisonMetrics.currentWindow.netChange),
    },
    {
      hint: "Bugs completed in the selected period. This is the fixed-by-engineering subset of all closed bugs.",
      label: "Bugs completed",
      tone: "neutral",
      value: formatNumber(comparisonMetrics.currentWindow.completed),
    },
    {
      hint: "Bugs that closed without being completed, including cancelled, duplicated, archived, and auto-closed work.",
      label: "Other closures",
      tone: "neutral",
      value: formatNumber(otherClosures),
    },
    {
      hint: "All bugs closed during the selected period, including completed, cancelled, duplicated, archived, and auto-closed work.",
      label: "Bugs closed",
      tone: getTrendBugsClosedTone(comparisonMetrics),
      value: formatNumber(comparisonMetrics.currentWindow.closed),
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
      hint: "Completed bugs in the selected period that had a due date and therefore count toward SLA performance.",
      label: "SLA bugs resolved",
      tone: "neutral",
      value: formatNumber(insightsMetrics.eligibleCompleted),
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
          chartKey="comparison-timeline"
          className="h-full"
          data={comparisonTimelineData}
          description="Daily intake versus total closed bugs across the selected period."
          onHoverStateChange={onChartFocusChange}
          siegeMode={siegeMode}
          title="Created vs closed"
        />
        <ChartCard
          chartKey="comparison-summary"
          className="h-full"
          data={comparisonSummaryData}
          description="Current vs previous period across intake, completed work, total closed bugs, net change, and closure rate."
          onHoverStateChange={onChartFocusChange}
          siegeMode={siegeMode}
          title="Current vs previous window"
          variant="bar"
        />
        <ChartCard
          chartKey="period-window-history"
          className="h-full"
          data={comparisonWindowHistoryData}
          description={`Each bar is one ${comparisonMetrics.currentWindow.dayCount}-day window. Green bars reduced backlog, red bars increased it.`}
          onHoverStateChange={onChartFocusChange}
          siegeMode={siegeMode}
          title="Period-by-period net change"
          variant="bar"
        />
        <ChartCard
          chartKey="period-rate-history"
          className="h-full"
          data={comparisonRateHistoryData}
          description={`Historical intake rate versus closure rate across matching ${comparisonMetrics.currentWindow.dayCount}-day windows.`}
          onHoverStateChange={onChartFocusChange}
          siegeMode={siegeMode}
          title="Creation vs closure rate trend"
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
          description={`On-time share of due-dated completions in ${insightsMetrics.rangeLabel}, grouped by severity.`}
          onHoverStateChange={onChartFocusChange}
          siegeMode={siegeMode}
          title="SLA hit rate by severity"
          variant="bar"
        />
        <ChartCard
          chartKey="sla-outcomes-by-priority"
          className="h-full"
          data={slaOutcomeData}
          description={`On-time, breached, and missing due-date completions in ${insightsMetrics.rangeLabel}, grouped by severity.`}
          onHoverStateChange={onChartFocusChange}
          siegeMode={siegeMode}
          title="SLA outcomes by severity"
          variant="bar"
        />
        <ChartCard
          chartKey="sla-outcome-trend"
          className="h-full"
          data={slaTrendData}
          description={`Daily on-time versus overdue completions across ${insightsMetrics.rangeLabel}.`}
          onHoverStateChange={onChartFocusChange}
          siegeMode={siegeMode}
          title="SLA outcome trend"
        />
        <ChartCard
          chartKey="resolution-time-by-priority"
          className="h-full"
          data={resolutionTimeData}
          description={`Average resolution days versus average overdue days for completions in ${insightsMetrics.rangeLabel}.`}
          onHoverStateChange={onChartFocusChange}
          siegeMode={siegeMode}
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
          description={`Completed, cancelled, duplicated, auto-closed, and archived outcomes in ${historyMetrics.rangeLabel}.`}
          onHoverStateChange={onChartFocusChange}
          siegeMode={siegeMode}
          title="Terminal outcomes"
          variant="bar"
        />
        <ChartCard
          chartKey="history-outcome-trend"
          className="h-full"
          data={trendChartData}
          description={`Daily completed and non-completion outcomes across ${historyMetrics.rangeLabel}.`}
          onHoverStateChange={onChartFocusChange}
          siegeMode={siegeMode}
          title="Closed outcomes over time"
        />
        <ChartCard
          chartKey="history-cycle-time"
          className="h-full"
          data={cycleTimeChartData}
          description={`Median, P75, and P90 cycle time by priority for work closed in ${historyMetrics.rangeLabel}.`}
          onHoverStateChange={onChartFocusChange}
          siegeMode={siegeMode}
          title="Cycle time by priority"
          variant="bar"
        />
        <ChartCard
          chartKey="history-cycle-buckets"
          className="h-full"
          data={cycleBucketChartData}
          description={`Distribution of closure times from creation to terminal outcome in ${historyMetrics.rangeLabel}.`}
          onHoverStateChange={onChartFocusChange}
          siegeMode={siegeMode}
          title="Cycle time distribution"
          variant="bar"
        />
      </div>
    </div>
  );
});
