import StatusTag from "@shared/components/StatusTag";
import Surface from "@shared/components/Surface";
import { cn } from "@shared/utils/cn";
import {
  formatNumber,
  formatSignedNumber,
  getDeltaTone,
  getStatusTagText,
} from "../utils/dashboard";
import type {
  DeadlineMetrics,
  SummaryMetrics,
  ActiveTab,
  ComparisonMetrics,
} from "../../../types/dashboard";

interface CommandCenterProps {
  activeTab: ActiveTab;
  comparisonMetrics?: ComparisonMetrics | null;
  deadlineMetrics: DeadlineMetrics;
  siegeMode?: boolean;
  summary: SummaryMetrics;
}

function CommandCenter({
  activeTab,
  comparisonMetrics = null,
  deadlineMetrics,
  siegeMode = false,
  summary,
}: CommandCenterProps) {
  const isPeriods = activeTab === "periods" && comparisonMetrics;

  // choose period or overview values
  const periodWindow = isPeriods ? comparisonMetrics!.currentWindow : null;

  const paceGap = isPeriods
    ? periodWindow!.fixRate - periodWindow!.addRate
    : summary.currentFixRate - summary.bugsPerDayRequired;

  const paceTone = getDeltaTone(paceGap);
  const metricShellClassName =
    {
      positive: "border-emerald-400/18 bg-emerald-500/[0.05] text-emerald-100",
      negative: "border-red-400/18 bg-red-500/[0.05] text-red-100",
      neutral: "border-sky-400/18 bg-sky-500/[0.05] text-sky-100",
    }[paceTone] ?? "border-sky-400/18 bg-sky-500/[0.05] text-sky-100";

  const statusTone = isPeriods
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

  const title = isPeriods ? "Period Outlook" : "Delivery outlook";

  return (
    <Surface
      data-siege-panel="command-center"
      className={cn(
        "relative overflow-hidden border-0 px-3.5 py-2.5 before:pointer-events-none before:absolute before:inset-0 before:rounded-[28px] before:opacity-100 after:pointer-events-none after:absolute after:inset-0 after:rounded-[28px] after:opacity-100",
        statusGlowClassName,
      )}
      tone="strong"
    >
      <div className="relative">
        <div className="flex flex-col gap-2.5 xl:flex-row xl:items-center xl:justify-between">
          <div className="w-full">
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-[0.62rem] font-semibold uppercase tracking-[0.28em] text-stone-500">
                {title}
              </p>
              <StatusTag tone={statusTone}>
                {getStatusTagText(statusTone)}
              </StatusTag>
            </div>
          </div>

          <div className="grid gap-2 md:grid-cols-3 xl:min-w-[36rem]">
            <div
              className={cn(
                "rounded-[18px] border px-3 py-2.5",
                metricShellClassName,
              )}
            >
              <div className="text-[0.58rem] font-semibold uppercase tracking-[0.16em] text-stone-400">
                Fix velocity
              </div>
              <div className="mt-1 font-display text-[1.45rem] leading-none tracking-[-0.04em]">
                {isPeriods
                  ? `${formatNumber(periodWindow!.fixRate, 2)}/day`
                  : `${formatNumber(summary.currentFixRate, 2)}/day`}
              </div>
            </div>
            <div className="rounded-[18px] border border-white/10 bg-white/[0.03] px-3 py-2.5 text-stone-100">
              <div className="text-[0.58rem] font-semibold uppercase tracking-[0.16em] text-stone-400">
                Required pace
              </div>
              <div className="mt-1 font-display text-[1.45rem] leading-none tracking-[-0.04em]">
                {isPeriods
                  ? `${formatNumber(periodWindow!.addRate, 2)}/day`
                  : `${formatNumber(summary.bugsPerDayRequired, 2)}/day`}
              </div>
            </div>
            <div
              className={cn(
                "rounded-[18px] border px-3 py-2.5",
                metricShellClassName,
              )}
            >
              <div className="text-[0.58rem] font-semibold uppercase tracking-[0.16em] text-stone-400">
                Net difference
              </div>
              <div className="mt-1 font-display text-[1.45rem] leading-none tracking-[-0.04em]">
                {isPeriods
                  ? `${formatSignedNumber(periodWindow!.netBurnRate, 2)}/day`
                  : `${formatSignedNumber(paceGap, 2)}/day`}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Surface>
  );
}

export default CommandCenter;
