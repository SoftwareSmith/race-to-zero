import { cn } from "@shared/utils/cn";

interface WaveProgressPillProps {
  activeBugLimit: number;
  className?: string;
  focusLabel: string;
  progressPercent: number;
  remainingSpawnBudget: number;
  secondsUntilNextWave: number | null;
  spawnRatePerSecond: number;
  tacticLabel: string;
  wave: number;
}

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export default function WaveProgressPill({
  activeBugLimit,
  className,
  focusLabel,
  progressPercent,
  remainingSpawnBudget,
  secondsUntilNextWave,
  spawnRatePerSecond,
  tacticLabel,
  wave,
}: WaveProgressPillProps) {
  const fillPercent = clampPercent(progressPercent);
  const countdownLabel =
    secondsUntilNextWave == null
      ? "--"
      : `${Math.max(0, secondsUntilNextWave)}s`;

  return (
    <div
      className={cn(
        "relative isolate overflow-hidden rounded-full border border-sky-300/14 bg-[linear-gradient(180deg,rgba(8,11,16,0.88),rgba(9,12,16,0.68))] px-3 py-2 shadow-[0_16px_34px_rgba(0,0,0,0.28),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-xl",
        className,
      )}
      data-testid="siege-wave-loader-pill"
      role="timer"
      aria-label={`Wave ${wave} advances in ${countdownLabel}`}
    >
      <div
        className="absolute inset-y-0 left-0 -z-10 rounded-full bg-[linear-gradient(90deg,rgba(56,189,248,0.34),rgba(52,211,153,0.28),rgba(251,191,36,0.24))] transition-[width] duration-300 ease-out"
        data-testid="siege-wave-loader-fill"
        style={{ width: `${fillPercent}%` }}
      />
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_18%_0%,rgba(255,255,255,0.16),transparent_32%),linear-gradient(180deg,rgba(255,255,255,0.06),transparent)]" />

      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[0.5rem] font-semibold uppercase tracking-[0.16em] text-sky-100/70">
              Wave
            </span>
            <strong className="font-display text-[0.95rem] leading-none tracking-[-0.04em] text-stone-50">
              {wave.toLocaleString()}
            </strong>
            <span className="truncate text-[0.56rem] font-semibold uppercase tracking-[0.14em] text-emerald-100/70">
              {tacticLabel}
            </span>
          </div>
          <div className="mt-1 truncate text-[0.58rem] font-medium text-stone-200/78">
            {focusLabel} • {spawnRatePerSecond.toFixed(1)}/s •{" "}
            {remainingSpawnBudget.toLocaleString()} queued
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="font-display text-[0.92rem] leading-none tracking-[-0.04em] text-stone-50 tabular-nums">
            {countdownLabel}
          </div>
          <div className="mt-1 text-[0.5rem] font-semibold uppercase tracking-[0.14em] text-stone-400">
            cap {activeBugLimit.toLocaleString()}
          </div>
        </div>
      </div>
    </div>
  );
}
