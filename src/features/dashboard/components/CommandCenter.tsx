import MetricCard from "@dashboard/components/MetricCard";
import StatusTag from "@shared/components/StatusTag";
import Surface from "@shared/components/Surface";
import { cn } from "@shared/utils/cn";
import {
  formatNumber,
  formatSignedNumber,
  getDeltaTone,
  getStatusTagText,
} from "../utils/dashboard";
import type { DeadlineMetrics, SummaryMetrics } from "../../../types/dashboard";

interface CommandCenterProps {
  deadlineMetrics: DeadlineMetrics;
  siegeMode?: boolean;
  summary: SummaryMetrics;
}

function CommandCenter({
  deadlineMetrics,
  siegeMode = false,
  summary,
}: CommandCenterProps) {
  const paceGap = summary.currentFixRate - summary.bugsPerDayRequired;
  const paceTone = getDeltaTone(paceGap);
  const glowStyles =
    {
      positive:
        "before:bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.14),transparent_42%)] after:bg-[radial-gradient(circle_at_bottom_right,rgba(56,189,248,0.1),transparent_38%)]",
      negative:
        "before:bg-[radial-gradient(circle_at_top_left,rgba(239,68,68,0.14),transparent_42%)] after:bg-[radial-gradient(circle_at_bottom_right,rgba(56,189,248,0.08),transparent_38%)]",
      neutral:
        "before:bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.14),transparent_42%)] after:bg-[radial-gradient(circle_at_bottom_right,rgba(20,184,166,0.08),transparent_38%)]",
    }[deadlineMetrics.statusTone] ??
    "before:bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.14),transparent_42%)] after:bg-[radial-gradient(circle_at_bottom_right,rgba(20,184,166,0.08),transparent_38%)]";

  return (
    <Surface
      data-siege-panel="command-center"
      className={cn(
        "relative border-white/10 p-5 before:pointer-events-none before:absolute before:inset-0 before:rounded-[28px] before:opacity-100 after:pointer-events-none after:absolute after:inset-0 after:rounded-[28px] after:opacity-100",
        siegeMode
          ? "overflow-hidden border-red-500/18 before:bg-[radial-gradient(circle_at_top_left,rgba(248,113,113,0.16),transparent_42%)] after:bg-[linear-gradient(180deg,transparent,rgba(12,14,20,0.34))]"
          : "",
        glowStyles,
      )}
      tone="strong"
    >
      {siegeMode ? (
        <div className="pointer-events-none absolute right-5 top-5 rounded-full border border-red-200/20 bg-red-500/10 px-2 py-1 text-[0.54rem] font-semibold uppercase tracking-[0.22em] text-red-100/78">
          Threat focus
        </div>
      ) : null}
      <div className="relative">
        <div className="w-full">
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.28em] text-stone-500">
              Delivery outlook
            </p>
            <StatusTag tone={deadlineMetrics.statusTone}>
              {getStatusTagText(deadlineMetrics.statusTone)}
            </StatusTag>
          </div>
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-3">
          <MetricCard
            hint="Average bugs completed per day across the active deadline tracking window."
            label="Fix velocity"
            tone={paceTone}
            value={`${formatNumber(summary.currentFixRate, 2)}/day`}
          />
          <MetricCard
            hint="Target daily completion pace needed to reach zero if current intake continues."
            label="Required pace"
            tone="neutral"
            value={`${formatNumber(summary.bugsPerDayRequired, 2)}/day`}
          />
          <MetricCard
            hint="Fix velocity minus required pace. Positive means delivery is ahead of the current target."
            label="Net difference"
            tone={paceTone}
            value={`${formatSignedNumber(paceGap, 2)}/day`}
          />
        </div>
      </div>
    </Surface>
  );
}

export default CommandCenter;
