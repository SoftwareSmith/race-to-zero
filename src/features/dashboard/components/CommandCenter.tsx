import { memo } from "react";
import StatusTag from "@shared/components/StatusTag";
import Surface from "@shared/components/Surface";
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

  // choose period or overview values
  const periodWindow = isPeriods ? comparisonMetrics!.currentWindow : null;

  const paceGap = isInsights
    ? insightsMetrics!.eligibleCompleted > 0
      ? insightsMetrics!.slaHitRate - 85
      : 0
    : isPeriods
      ? periodWindow!.fixRate - periodWindow!.addRate
      : summary.currentFixRate - summary.bugsPerDayRequired;

  const paceTone = isInsights ? insightsMetrics!.tone : getDeltaTone(paceGap);
  const metricShellClassName =
    {
      positive: "border-emerald-400/18 bg-emerald-500/[0.05] text-emerald-100",
      negative: "border-red-400/18 bg-red-500/[0.05] text-red-100",
      neutral: "border-sky-400/18 bg-sky-500/[0.05] text-sky-100",
    }[paceTone] ?? "border-sky-400/18 bg-sky-500/[0.05] text-sky-100";

  const statusTone = isInsights
    ? insightsMetrics!.tone
    : isPeriods
      ? comparisonMetrics!.tone
      : deadlineMetrics.statusTone;
  const statusGlowClassName =
    {
      positive:
        "before:bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.14),transparent_42%)] after:bg-[radial-gradient(circle_at_bottom_right,rgba(56,189,248,0.1),transparent_38%)]",
      negative:
        "before:bg-[radial-gradient(circle_at_top_left,rgba(239,68,68,0.14),transparent_42%)] after:bg-[radial-gradient(circle_at_bottom_right,rgba(56,189,248,0.08),transparent_38%)]",
      neutral:
        "before:bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.14),transparent_42%)] after:bg-[radial-gradient(circle_at_bottom_right,rgba(20,184,166,0.08),transparent_38%)]",
    }[statusTone] ??
    "before:bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.14),transparent_42%)] after:bg-[radial-gradient(circle_at_bottom_right,rgba(20,184,166,0.08),transparent_38%)]";

  const title = isInsights
    ? "SLA Insights"
    : isPeriods
      ? "Period Outlook"
      : "Delivery outlook";
  const primaryLabel = isInsights ? "SLA hit rate" : "Fix velocity";
  const primaryValue = isInsights
    ? formatPercent(insightsMetrics!.slaHitRate, 1)
    : isPeriods
      ? `${formatNumber(periodWindow!.fixRate, 2)}/day`
      : `${formatNumber(summary.currentFixRate, 2)}/day`;
  const secondaryLabel = isInsights ? "Breaches" : "Required pace";
  const secondaryValue = isInsights
    ? formatNumber(insightsMetrics!.breachedCompleted)
    : isPeriods
      ? `${formatNumber(periodWindow!.addRate, 2)}/day`
      : `${formatNumber(summary.bugsPerDayRequired, 2)}/day`;
  const tertiaryLabel = isInsights ? "Open overdue" : "Net difference";
  const tertiaryValue = isInsights
    ? formatNumber(insightsMetrics!.openOverdue)
    : isPeriods
      ? `${formatSignedNumber(periodWindow!.netBurnRate, 2)}/day`
      : `${formatSignedNumber(paceGap, 2)}/day`;

  return (
    <Surface
      data-siege-panel="command-center"
      className={cn(
        "relative overflow-hidden border-0 px-2.5 py-[0.4375rem] before:pointer-events-none before:absolute before:inset-0 before:rounded-[20px] before:opacity-100 after:pointer-events-none after:absolute after:inset-0 after:rounded-[20px] after:opacity-100 sm:px-3 sm:py-2 sm:before:rounded-[24px] sm:after:rounded-[24px]",
        statusGlowClassName,
      )}
      tone="strong"
    >
      <div className="relative">
        <div className="flex flex-col gap-1.5 xl:flex-row xl:items-center xl:justify-between">
          <div className="w-full">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[0.52rem] font-semibold uppercase tracking-[0.2em] text-stone-500 sm:text-[0.56rem]">
                {title}
              </p>
              <StatusTag size="compact" tone={statusTone}>
                {getStatusTagText(statusTone)}
              </StatusTag>
            </div>
          </div>

          <div className="grid gap-1.5 sm:grid-cols-3 xl:min-w-[29rem]">
            <div
              data-siege-panel="fix-velocity"
              className={cn(
                "rounded-[14px] border px-2.5 py-1.75 sm:rounded-[16px] sm:py-2",
                metricShellClassName,
              )}
            >
              <div className="text-[0.5rem] font-semibold uppercase tracking-[0.12em] text-stone-400 sm:text-[0.54rem]">
                {primaryLabel}
              </div>
              <strong className="mt-[0.1875rem] block font-display text-[1.12rem] leading-none tracking-[-0.035em] sm:text-[1.28rem]">
                {primaryValue}
              </strong>
            </div>
            <div
              data-siege-panel="required-pace"
              className="rounded-[14px] border border-white/10 bg-white/[0.03] px-2.5 py-1.75 text-stone-100 sm:rounded-[16px] sm:py-2"
            >
              <div className="text-[0.5rem] font-semibold uppercase tracking-[0.12em] text-stone-400 sm:text-[0.54rem]">
                {secondaryLabel}
              </div>
              <strong className="mt-[0.1875rem] block font-display text-[1.12rem] leading-none tracking-[-0.035em] sm:text-[1.28rem]">
                {secondaryValue}
              </strong>
            </div>
            <div
              data-siege-panel="net-difference"
              className={cn(
                "rounded-[14px] border px-2.5 py-1.75 sm:rounded-[16px] sm:py-2",
                metricShellClassName,
              )}
            >
              <div className="text-[0.5rem] font-semibold uppercase tracking-[0.12em] text-stone-400 sm:text-[0.54rem]">
                {tertiaryLabel}
              </div>
              <strong className="mt-[0.1875rem] block font-display text-[1.12rem] leading-none tracking-[-0.035em] sm:text-[1.28rem]">
                {tertiaryValue}
              </strong>
            </div>
          </div>
        </div>
      </div>
    </Surface>
  );
});

export default CommandCenter;
