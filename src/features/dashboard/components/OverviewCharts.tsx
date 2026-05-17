import { memo, useMemo } from "react";
import ChartCard from "@dashboard/components/ChartCard";
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
  deadlineMetrics: DeadlineMetrics;
  onChartFocusChange?: (nextFocus: ChartFocusState | null) => void;
  siegeMode?: boolean;
}

const OverviewCharts = memo(function OverviewCharts({
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

  return (
    <div className="grid items-stretch gap-1.5 md:grid-cols-2 sm:gap-2">
      <ChartCard
        chartKey="deadline-burndown"
        className="h-full"
        data={deadlineBurndownData}
        description="Remaining backlog versus the ideal path to zero by the selected deadline."
        onHoverStateChange={onChartFocusChange}
        siegeMode={siegeMode}
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
        description="Active bugs by workflow state. Done, Cancelled, and Duplicated are excluded."
        onHoverStateChange={onChartFocusChange}
        siegeMode={siegeMode}
        title="Active bugs by status"
        variant="bar"
      />
      <ChartCard
        chartKey="open-age-breakdown"
        className="h-full"
        data={openAgeChartData}
        description="Open backlog by age, separating fresh intake from stale work."
        onHoverStateChange={onChartFocusChange}
        siegeMode={siegeMode}
        title="Active bug age"
        variant="bar"
      />
    </div>
  );
});

export default OverviewCharts;
