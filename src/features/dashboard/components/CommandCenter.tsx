import { memo } from "react";
import StatusTag from "@shared/components/StatusTag";
import { cn } from "@shared/utils/cn";
import {
  formatNumber,
  formatPercent,
  formatSignedNumber,
  getDeltaTone,
  getStatusTagText,
} from "../utils/dashboard";
import type {
  DeadlineMetrics,
  SummaryMetrics,
  ActiveTab,
  ComparisonMetrics,
  InsightsMetrics,
} from "../../../types/dashboard";

interface CommandCenterProps {
  activeTab: ActiveTab;
  comparisonMetrics?: ComparisonMetrics | null;
  deadlineMetrics: DeadlineMetrics;
  insightsMetrics?: InsightsMetrics | null;
  siegeMode?: boolean;
  summary: SummaryMetrics;
}

function buildOutcomeSentence(
  activeTab: ActiveTab,
  summary: SummaryMetrics,
  deadlineMetrics: DeadlineMetrics,
  comparisonMetrics: ComparisonMetrics | null,
  insightsMetrics: InsightsMetrics | null,
): string {
  if (activeTab === "insights" && insightsMetrics) {
    const { openOverdue, openPending, eligibleCompleted } = insightsMetrics;
    if (eligibleCompleted === 0) {
      return "No due-dated bugs completed yet — SLA coverage is building.";
    }
    if (openOverdue > 0) {
      return `${formatNumber(openOverdue)} overdue and ${formatNumber(openPending)} pending — review open SLA risk.`;
    }
    return `${formatNumber(openPending)} bugs pending due dates. No currently overdue open items.`;
  }

  if (activeTab === "periods" && comparisonMetrics) {
    const { netChange, completionRate } = comparisonMetrics.currentWindow;
    if (netChange < 0) {
      return `Backlog shrank by ${formatNumber(Math.abs(netChange))} this period. Completion rate ${formatPercent(completionRate, 0)}.`;
    }
    if (netChange > 0) {
      return `Backlog grew by ${formatNumber(netChange)} this period. Completion rate ${formatPercent(completionRate, 0)}.`;
    }
    return `Backlog held flat this period. Completion rate ${formatPercent(completionRate, 0)}.`;
  }

  // Overview / Target
  const gap = summary.currentFixRate - summary.bugsPerDayRequired;
  const absBugs = formatNumber(deadlineMetrics.remainingBugs);
  if (gap >= 0) {
    return `${absBugs} open — current burn is ${formatSignedNumber(gap, 2)}/day ahead of target pace.`;
  }
  return `${absBugs} open — ${formatNumber(Math.abs(gap), 2)}/day below target pace to close by deadline.`;
}

const CommandCenter = memo(function CommandCenter({
  activeTab,
  comparisonMetrics = null,
  deadlineMetrics,
  insightsMetrics = null,
  siegeMode = false,
  summary,
}: CommandCenterProps) {
  void siegeMode;
  const isPeriods = activeTab === "periods" && comparisonMetrics;
  const isInsights = activeTab === "insights" && insightsMetrics;

  const paceGap = isInsights
    ? insightsMetrics!.eligibleCompleted > 0
      ? insightsMetrics!.slaHitRate - 85
      : 0
    : isPeriods
      ? comparisonMetrics!.currentWindow.fixRate - comparisonMetrics!.currentWindow.addRate
      : summary.currentFixRate - summary.bugsPerDayRequired;

  const statusTone = isInsights
    ? insightsMetrics!.tone
    : isPeriods
      ? comparisonMetrics!.tone
      : deadlineMetrics.statusTone;

  void getDeltaTone;

  const outcomeSentence = buildOutcomeSentence(
    activeTab,
    summary,
    deadlineMetrics,
    comparisonMetrics,
    insightsMetrics,
  );

  return (
    <div
      data-siege-panel="command-center"
      className="flex flex-wrap items-center gap-2 rounded-[16px] border border-white/8 bg-zinc-950/60 px-3 py-2 sm:rounded-[18px] sm:px-3.5 sm:py-2.5"
    >
      <StatusTag size="compact" tone={statusTone}>
        {getStatusTagText(statusTone)}
      </StatusTag>
      <p className="text-[0.72rem] leading-snug text-stone-300 sm:text-[0.76rem]">
        {outcomeSentence}
      </p>
    </div>
  );
});

export default CommandCenter;
