import type {
  CompareRangeOption,
  ComparisonMetrics,
  DeadlineMetrics,
  HistoryWindowMetrics,
  SummaryMetrics,
  TabItem,
  Tone,
} from "../../../types/dashboard";

export {
  formatNumber,
  formatSignedNumber,
  formatPercent,
} from "@shared/utils/formatters";

export const TAB_ITEMS: TabItem[] = [
  { id: "overview", label: "Target" },
  { id: "periods", label: "Trend" },
  { id: "insights", label: "SLAs" },
  { id: "history", label: "History" },
];

export const COMPARE_RANGE_OPTIONS: CompareRangeOption[] = [
  { label: "7D", value: "7" },
  { label: "30D", value: "30" },
  { label: "90D", value: "90" },
  { label: "All time", value: "all" },
  { label: "Custom", value: "custom" },
];

const METRIC_TONE_EPSILON = 0.01;
const CONFIDENCE_POSITIVE_THRESHOLD = 80;
const CONFIDENCE_NEUTRAL_THRESHOLD = 20;
const HISTORY_COMPLETED_SHARE_POSITIVE_THRESHOLD = 75;
const HISTORY_COMPLETED_SHARE_NEUTRAL_THRESHOLD = 60;
const HISTORY_CANCELLED_SHARE_POSITIVE_THRESHOLD = 10;
const HISTORY_CANCELLED_SHARE_NEUTRAL_THRESHOLD = 20;

export function getNetChangeTone(netChange: number): Tone {
  if (netChange > 0) {
    return "negative";
  }

  if (netChange < 0) {
    return "positive";
  }

  return "neutral";
}

function isApproximatelyEqual(left: number, right: number) {
  return Math.abs(left - right) < METRIC_TONE_EPSILON;
}

export function getMetricTone(
  currentValue: number,
  previousValue: number | null,
  higherIsBetter: boolean,
): Tone {
  if (previousValue == null) {
    return "neutral";
  }

  if (Math.abs(currentValue - previousValue) < 0.01) {
    return "neutral";
  }

  const improved = higherIsBetter
    ? currentValue > previousValue
    : currentValue < previousValue;
  return improved ? "positive" : "negative";
}

export function getDeltaTone(value: number): Tone {
  if (Math.abs(value) < 0.01) {
    return "neutral";
  }

  return value > 0 ? "positive" : "negative";
}

export function getTargetOpenBugsTone(deadlineMetrics: DeadlineMetrics): Tone {
  if (deadlineMetrics.remainingBugs === 0) {
    return "positive";
  }

  if (deadlineMetrics.remainingBugs > deadlineMetrics.trackingStartBacklog) {
    return "negative";
  }

  if (deadlineMetrics.daysUntilDeadline === 0) {
    return "negative";
  }

  return "neutral";
}

export function getTargetConfidenceTone(
  summary: SummaryMetrics,
  deadlineMetrics: DeadlineMetrics,
): Tone {
  if (summary.likelihoodScore >= CONFIDENCE_POSITIVE_THRESHOLD) {
    return "positive";
  }

  if (summary.likelihoodScore >= CONFIDENCE_NEUTRAL_THRESHOLD) {
    return "neutral";
  }

  return "negative";
}

export function getTargetCurrentNetBurnTone(
  deadlineMetrics: DeadlineMetrics,
): Tone {
  if (
    isApproximatelyEqual(
      deadlineMetrics.currentNetBurnRate,
      deadlineMetrics.neededNetBurnRate,
    )
  ) {
    return "neutral";
  }

  return deadlineMetrics.currentNetBurnRate >= deadlineMetrics.neededNetBurnRate
    ? "positive"
    : "negative";
}

export function getTargetDaysLeftTone(deadlineMetrics: DeadlineMetrics): Tone {
  if (deadlineMetrics.daysUntilDeadline > 0) {
    return "neutral";
  }

  return deadlineMetrics.remainingBugs === 0 ? "positive" : "negative";
}

export function getTrendClosureRateTone(
  comparisonMetrics: ComparisonMetrics,
): Tone {
  if (comparisonMetrics.currentWindow.completionRate > 100) {
    return "positive";
  }

  if (
    isApproximatelyEqual(comparisonMetrics.currentWindow.completionRate, 100)
  ) {
    return "neutral";
  }

  return "negative";
}

export function getTrendBugsClosedTone(
  comparisonMetrics: ComparisonMetrics,
): Tone {
  if (
    comparisonMetrics.currentWindow.fixed > comparisonMetrics.currentWindow.created
  ) {
    return "positive";
  }

  if (
    comparisonMetrics.currentWindow.fixed === comparisonMetrics.currentWindow.created
  ) {
    return "neutral";
  }

  return "negative";
}

export function getTrendBugsCreatedTone(
  comparisonMetrics: ComparisonMetrics,
): Tone {
  if (
    comparisonMetrics.currentWindow.created < comparisonMetrics.currentWindow.fixed
  ) {
    return "positive";
  }

  if (
    comparisonMetrics.currentWindow.created === comparisonMetrics.currentWindow.fixed
  ) {
    return "neutral";
  }

  return "negative";
}

export function getHistoryClosedWorkTone(): Tone {
  return "neutral";
}

export function getHistoryCompletedShareTone(
  currentWindow: HistoryWindowMetrics,
): Tone {
  if (
    currentWindow.completionRate >= HISTORY_COMPLETED_SHARE_POSITIVE_THRESHOLD
  ) {
    return "positive";
  }

  if (
    currentWindow.completionRate >= HISTORY_COMPLETED_SHARE_NEUTRAL_THRESHOLD
  ) {
    return "neutral";
  }

  return "negative";
}

export function getHistoryCancelledShareTone(
  currentWindow: HistoryWindowMetrics,
): Tone {
  if (
    currentWindow.cancellationRate <= HISTORY_CANCELLED_SHARE_POSITIVE_THRESHOLD
  ) {
    return "positive";
  }

  if (
    currentWindow.cancellationRate <= HISTORY_CANCELLED_SHARE_NEUTRAL_THRESHOLD
  ) {
    return "neutral";
  }

  return "negative";
}

export function getHistoryCycleTone(): Tone {
  return "neutral";
}

export function getStatusTagText(tone: Tone) {
  if (tone === "positive") {
    return "Ahead";
  }

  if (tone === "negative") {
    return "Behind";
  }

  return "Flat";
}

export function getDateInputBounds(min?: string, max?: string) {
  if (min && max && min > max) {
    return { max: undefined, min: undefined };
  }

  return { min, max };
}
