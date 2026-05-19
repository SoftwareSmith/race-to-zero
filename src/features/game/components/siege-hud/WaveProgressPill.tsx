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
  const countdownToneClass =
    secondsUntilNextWave != null && secondsUntilNextWave <= 8
      ? "bg-red-500/10 text-red-50"
      : "bg-black/18 text-stone-50";
  const countdownLabel =
    secondsUntilNextWave == null
      ? "--"
      : `${Math.max(0, secondsUntilNextWave)}s`;
  const ariaLabel = `Wave ${wave}, ${tacticLabel}. ${focusLabel}. Next surge in ${countdownLabel}. Cap ${activeBugLimit.toLocaleString()}, ${remainingSpawnBudget.toLocaleString()} queued at ${spawnRatePerSecond.toFixed(1)} per second.`;

  return (
    <div
      className={cn(
        "relative isolate h-[2.35rem] overflow-hidden rounded-[14px] border border-white/10 bg-[linear-gradient(180deg,rgba(8,11,16,0.92),rgba(9,12,16,0.74))] px-2 py-0 shadow-[0_12px_24px_rgba(0,0,0,0.18)] backdrop-blur-xl",
        className,
      )}
      data-testid="siege-wave-loader-pill"
      role="timer"
      aria-label={ariaLabel}
    >
      <div className="absolute inset-0 overflow-hidden rounded-[inherit]">
        <div
          className="absolute inset-y-0 left-0 rounded-[inherit] bg-[linear-gradient(90deg,rgba(56,189,248,0.22),rgba(34,197,94,0.18),rgba(251,191,36,0.16))] transition-[width] duration-300 ease-out"
          data-testid="siege-wave-loader-fill"
          style={{ width: `${fillPercent}%` }}
        />
      </div>
      <div className="pointer-events-none absolute inset-0 rounded-[inherit] bg-[radial-gradient(circle_at_top_left,rgba(125,211,252,0.12),transparent_44%),linear-gradient(180deg,rgba(255,255,255,0.05),transparent)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-white/12" />
      <div className="pointer-events-none absolute -left-5 top-0 h-10 w-10 rounded-full bg-sky-300/8 blur-2xl" />

      <div className="relative grid h-full min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-0">
        <div className="flex min-w-0 items-center gap-2 pr-2">
          <div className="min-w-0 flex-1">
            <div className="text-[0.41rem] font-semibold uppercase tracking-[0.13em] text-sky-100/72">
              Wave
            </div>
            <strong className="mt-0.3 block truncate font-display text-[0.94rem] leading-none tracking-[-0.05em] text-stone-50">
              {wave.toLocaleString()}
            </strong>
          </div>
        </div>
        <div className="relative flex h-full min-w-[3.2rem] flex-col justify-center pl-2.5 text-right before:absolute before:bottom-[0.42rem] before:left-0 before:top-[0.42rem] before:w-px before:bg-white/10">
          <div className="text-[0.34rem] font-semibold uppercase tracking-[0.12em] text-stone-400">
            Next
          </div>
          <div
            className={cn(
              "mt-0.3 inline-flex min-w-[2.35rem] justify-end rounded-full px-1.15 py-[0.22rem] font-display text-[0.88rem] leading-none tracking-[-0.04em] tabular-nums",
              countdownToneClass,
            )}
          >
            {countdownLabel}
          </div>
        </div>
      </div>
    </div>
  );
}
