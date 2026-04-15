import { memo } from "react";
import Tooltip from "@shared/components/Tooltip";
import type { SiegeGameMode } from "@game/types";
import { HudShell } from "./shared";

interface SiegeHudStatsProps {
  bugsLabel: string;
  gameMode: SiegeGameMode;
  interactiveKills: number;
  interactivePoints: number;
  interactiveRemainingBugs: number;
  timerValue: string;
}

const SiegeHudStats = memo(function SiegeHudStats({
  bugsLabel,
  gameMode,
  interactiveKills,
  interactivePoints,
  interactiveRemainingBugs,
  timerValue,
}: SiegeHudStatsProps) {
  return (
    <div className="pointer-events-none fixed inset-x-0 top-[4.65rem] z-[220] flex justify-center px-3 sm:top-4">
      <div className="pointer-events-auto w-full max-w-[23rem] select-none !cursor-default [animation:hud-notch-arrive_320ms_cubic-bezier(0.22,1,0.36,1)_forwards]">
        <HudShell
          className="px-2 py-1.5 shadow-[0_18px_42px_rgba(0,0,0,0.34)]"
          data-testid="siege-hud"
        >
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(125,211,252,0.11),transparent_30%),linear-gradient(90deg,rgba(248,113,113,0.05),transparent_34%,rgba(251,191,36,0.05))]" />

          <div className="relative">
            <div className="flex items-stretch rounded-full border border-white/8 bg-black/18 px-1.5 py-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
              <div className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_7rem] gap-1">
                <div className="flex min-w-0 flex-col justify-center rounded-full px-2 py-1.5">
                  <span className="text-[0.43rem] font-semibold uppercase tracking-[0.12em] text-red-100/65">
                    {bugsLabel}
                  </span>
                  <strong className="mt-1 font-display text-[0.86rem] leading-none tracking-[-0.04em] text-stone-50 sm:text-[0.9rem]">
                    {interactiveRemainingBugs.toLocaleString()}
                  </strong>
                </div>
                <div className="flex min-w-0 flex-col justify-center rounded-full border-l border-white/6 px-2 py-1.5">
                  <span className="text-[0.43rem] font-semibold uppercase tracking-[0.12em] text-stone-500">
                    Kills
                  </span>
                  <strong className="mt-1 font-display text-[0.86rem] leading-none tracking-[-0.04em] text-stone-50 sm:text-[0.9rem]">
                    {interactiveKills.toLocaleString()}
                  </strong>
                </div>
                <div className="flex min-w-0 flex-col justify-center rounded-full border-l border-white/6 px-2 py-1.5">
                  <span className="text-[0.43rem] font-semibold uppercase tracking-[0.12em] text-amber-100/65">
                    Points
                  </span>
                  <strong className="mt-1 font-display text-[0.86rem] leading-none tracking-[-0.04em] text-stone-50 sm:text-[0.9rem]">
                    {interactivePoints.toLocaleString()}
                  </strong>
                </div>
                <Tooltip
                  content={
                    gameMode === "purge"
                      ? "Elapsed clear time."
                      : "Elapsed survival time."
                  }
                >
                  <div className="flex h-full w-[7rem] shrink-0 items-center justify-between rounded-full border border-cyan-300/12 bg-cyan-500/[0.08] px-2 py-1.5 text-center">
                    <span className="text-[0.43rem] font-semibold uppercase tracking-[0.12em] text-cyan-100/65">
                      Time
                    </span>
                    <strong className="font-display text-[0.94rem] leading-none tracking-[-0.05em] tabular-nums text-stone-50">
                      {timerValue}
                    </strong>
                  </div>
                </Tooltip>
              </div>
            </div>
          </div>
        </HudShell>
      </div>
    </div>
  );
});

export default SiegeHudStats;
