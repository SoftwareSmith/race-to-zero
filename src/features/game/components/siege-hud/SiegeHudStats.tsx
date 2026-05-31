import { memo } from "react";
import { cn } from "@shared/utils/cn";
import { HudShell } from "./shared";

interface SiegeHudStatsProps {
  interactiveKills: number;
  interactiveRemainingBugs: number;
  isSurvival: boolean;
  timerValue: string;
}

const SiegeHudStats = memo(function SiegeHudStats({
  interactiveKills,
  interactiveRemainingBugs,
  isSurvival,
  timerValue,
}: SiegeHudStatsProps) {
  const middleTimeLabel = isSurvival ? "Survived" : "Clear time";

  return (
    <div className="pointer-events-none fixed inset-x-0 top-[4.65rem] z-[220] flex justify-center px-3 sm:top-4">
      <HudShell
        className={cn(
          "pointer-events-auto border-transparent bg-[linear-gradient(180deg,rgba(8,11,16,0.9),rgba(9,12,16,0.72))] overflow-visible px-2 py-1.5 shadow-[0_14px_34px_rgba(0,0,0,0.3)] [animation:hud-notch-arrive_320ms_cubic-bezier(0.22,1,0.36,1)_forwards]",
          "w-full max-w-[20.5rem]",
        )}
        data-testid="siege-hud"
      >
        <div className="pointer-events-none absolute inset-0 rounded-[inherit] bg-[radial-gradient(circle_at_top,rgba(125,211,252,0.09),transparent_34%),linear-gradient(90deg,rgba(248,113,113,0.04),transparent_34%,rgba(251,191,36,0.04))]" />
        <div className="pointer-events-none absolute inset-x-5 top-0 h-px bg-white/12" />

        <div className="relative">
          <div className="grid min-w-0 grid-cols-[4.5rem_minmax(6.5rem,1fr)_4.5rem] items-center gap-0">
            <div
              className="flex min-w-0 flex-col justify-center px-1.5 py-0.5"
              data-testid="siege-remaining-stat"
            >
              <span className="block text-[0.42rem] font-semibold uppercase tracking-[0.14em] text-red-100/68">
                {isSurvival ? "Alive" : "Bugs"}
              </span>
              <strong className="mt-0.5 block font-display text-[0.98rem] leading-none tracking-[-0.05em] text-stone-50 sm:text-[1.02rem]">
                {interactiveRemainingBugs.toLocaleString()}
              </strong>
            </div>

            <div
              className="relative flex min-w-0 flex-col items-center px-1 py-0.5 text-center before:absolute before:bottom-1 before:left-0 before:top-1 before:w-px before:bg-white/8 after:absolute after:bottom-1 after:right-0 after:top-1 after:w-px after:bg-white/8"
              data-testid="siege-time-stat"
            >
              <span className="block text-[0.4rem] font-semibold uppercase tracking-[0.16em] text-cyan-100/66">
                {middleTimeLabel}
              </span>
              <strong className="mt-0.5 block font-display text-[1.1rem] leading-none tracking-[-0.06em] tabular-nums text-stone-50 sm:text-[1.18rem]">
                {timerValue}
              </strong>
            </div>

            <div
              className="flex min-w-0 flex-col justify-center px-1.5 py-0.5 text-right"
              data-testid="siege-kills-stat"
            >
              <span className="block text-[0.42rem] font-semibold uppercase tracking-[0.14em] text-amber-100/62">
                Kills
              </span>
              <strong className="mt-0.5 block font-display text-[0.98rem] leading-none tracking-[-0.05em] text-stone-50 sm:text-[1.02rem]">
                {interactiveKills.toLocaleString()}
              </strong>
            </div>
          </div>
        </div>
      </HudShell>
    </div>
  );
});

export default SiegeHudStats;
