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
  void activeBugLimit;
  void focusLabel;
  void remainingSpawnBudget;
  void spawnRatePerSecond;
  void tacticLabel;
  const fillPercent = clampPercent(progressPercent);
  const countdownLabel =
    secondsUntilNextWave == null
      ? "--"
      : `${Math.max(0, secondsUntilNextWave)}s`;
  const ariaLabel = `Wave ${wave}, ${tacticLabel}. ${focusLabel}. Next surge in ${countdownLabel}. Cap ${activeBugLimit.toLocaleString()}, ${remainingSpawnBudget.toLocaleString()} queued at ${spawnRatePerSecond.toFixed(1)} per second.`;

  return (
    <div
      className={cn(
        "relative isolate overflow-hidden rounded-[14px] bg-[linear-gradient(180deg,rgba(8,11,16,0.9),rgba(9,12,16,0.72))] px-2 py-1.75 shadow-[0_12px_24px_rgba(0,0,0,0.16)] backdrop-blur-xl",
        className,
      )}
      data-testid="siege-wave-loader-pill"
      role="timer"
      aria-label={ariaLabel}
    >
      <div className="absolute inset-0 overflow-hidden rounded-[inherit]">
        <div
          className="absolute inset-y-0 left-0 rounded-[inherit] bg-[linear-gradient(90deg,rgba(56,189,248,0.24),rgba(52,211,153,0.2),rgba(251,191,36,0.18))] transition-[width] duration-300 ease-out"
          data-testid="siege-wave-loader-fill"
          style={{ width: `${fillPercent}%` }}
        />
      </div>
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),transparent)]" />

      <div className="relative flex items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[0.4rem] font-semibold uppercase tracking-[0.16em] text-sky-100/68">
            Wave
          </div>
          <strong className="mt-0.5 block font-display text-[1.18rem] leading-none tracking-[-0.05em] text-stone-50">
            {wave.toLocaleString()}
          </strong>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-[0.38rem] font-semibold uppercase tracking-[0.14em] text-stone-400">
            Next
          </div>
          <div className="mt-0.5 font-display text-[0.96rem] leading-none tracking-[-0.04em] text-stone-50 tabular-nums">
            {countdownLabel}
          </div>
        </div>
      </div>
    </div>
  );
}
