import { memo, useMemo } from "react";
import ChartCard from "@dashboard/components/ChartCard";
import { formatNumber } from "@dashboard/utils/dashboard";
import {
  buildDeadlineBurndownChartData,
  buildOpenAgeChartData,
  buildPriorityChartData,
  buildStatusChartData,
} from "@dashboard/utils/chartMetrics";
import type {
  ChartFocusState,
  DeadlineMetrics,
} from "../../../types/dashboard";

interface OverviewChartsProps {
  backlogSummary: string;
  deadlineMetrics: DeadlineMetrics;
  onChartFocusChange?: (nextFocus: ChartFocusState | null) => void;
  siegeMode?: boolean;
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
  const olderThanNinety = deadlineMetrics.openAgeDistribution
    .filter((entry) => entry.label === "91-180d" || entry.label === "181d+")
    .reduce((sum, entry) => sum + entry.count, 0);

  return `${formatNumber(olderThanNinety)} open bugs are older than 90 days, which helps separate fresh intake from long-running backlog.`;
}

const OverviewCharts = memo(function OverviewCharts({
  backlogSummary,
  deadlineMetrics,
  onChartFocusChange,
  siegeMode = false,
}: OverviewChartsProps) {
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
  const statusSummary = useMemo(
    () => getStatusDistributionSummary(deadlineMetrics),
    [deadlineMetrics],
  );
  const openAgeSummary = useMemo(
    () => getOpenAgeSummary(deadlineMetrics),
    [deadlineMetrics],
  );

  return (
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
  );
});

export default OverviewCharts;
