import { memo, useMemo } from "react";
import ChartCard from "@dashboard/components/ChartCard";
import MetricCard from "@dashboard/components/MetricCard";
import {
  formatNumber,
  formatPercent,
  formatSignedNumber,
  getTargetConfidenceTone,
  getTargetCurrentNetBurnTone,
  getTargetDaysLeftTone,
  getTargetOpenBugsTone,
} from "./utils/dashboard";
import {
  buildDeadlineBurndownChartData,
  buildOpenAgeChartData,
  buildPriorityChartData,
  buildStatusChartData,
} from "@dashboard/utils/metrics";
import type {
  ChartFocusState,
  DeadlineMetrics,
  SummaryMetrics,
  Tone,
  WorkdaySettings,
} from "../../types/dashboard";

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

function getStatusDistributionSummary(deadlineMetrics: DeadlineMetrics) {
  const leadingStatus = [...deadlineMetrics.statusDistribution].sort(
    (left, right) => right.count - left.count,
  )[0];
  if (!leadingStatus) {
    return "No workflow states are currently represented in the snapshot.";
  }

  return `${leadingStatus.label} is currently the largest active workflow state with ${formatNumber(leadingStatus.count)} bugs in it. Closed states like Done, Cancelled, and Duplicated are excluded from this chart. Done currently contains ${formatNumber(deadlineMetrics.doneCount)} bugs.`;
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
    () => buildOverviewMetricCards(summary, deadlineMetrics, isWorkdayMode),
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
        <ChartCard
          chartKey="deadline-burndown"
          className="h-full"
          data={deadlineBurndownData}
          description="Remaining backlog against the ideal path to zero by the selected deadline."
          onHoverStateChange={onChartFocusChange}
          siegeMode={siegeMode}
          summary={backlogSummary}
          title="Bug burndown"
        />
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
      </div>
    </div>
  );
});
