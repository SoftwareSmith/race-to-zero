// Metric calculation functions now live in src/features/dashboard/utils/metrics.ts.
// Re-exported here so existing relative imports continue to resolve.
export {
  getDeadlineMetrics,
  buildDeadlineBurndownChartData,
  buildPriorityChartData,
  getComparisonMetrics,
  buildComparisonTimelineChartData,
  buildComparisonSummaryChartData,
  getSummaryMetrics,
} from "@dashboard/utils/metrics";
