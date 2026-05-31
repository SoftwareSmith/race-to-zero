import type { SurvivalVariantWeights } from "@game/sim/survivalDirector";
import Tooltip from "@shared/components/Tooltip";
import { cn } from "@shared/utils/cn";
import WaveProgressPill from "./WaveProgressPill";

interface SurvivalHudMetric {
  id: "uptime" | "errors" | "speed";
  label: string;
  secondsToFail: number | null;
  status: "stable" | "warning" | "critical";
  value: number;
}

interface SiegeHudSurvivalStatusProps {
  activeBugLimit: number;
  focusLabel: string;
  metrics: SurvivalHudMetric[];
  progressPercent: number;
  remainingSpawnBudget: number;
  secondsUntilNextWave: number | null;
  spawnRatePerSecond: number;
  tacticLabel: string;
  variantWeights: SurvivalVariantWeights;
  wave: number;
}

function getSurvivalMetricTooltip(metric: SurvivalHudMetric) {
  const nextStep =
    metric.id === "errors"
      ? "Too many high and urgent bugs are active at once."
      : metric.id === "speed"
        ? "Medium, high, and urgent bugs are keeping the platform overloaded."
        : "The total live swarm load is breaking through the defenses.";
  const timing =
    metric.secondsToFail != null
      ? `Failure in about ${metric.secondsToFail}s if this pressure holds.`
      : "No failure timer is active right now.";

  return `${nextStep} ${timing}`;
}

function getSurvivalMetricToneClasses(metric: SurvivalHudMetric) {
  if (metric.status === "critical") {
    return {
      borderClassName: "border-red-300/24",
      dotClassName: "bg-red-300 shadow-[0_0_12px_rgba(248,113,113,0.58)]",
      glowClassName:
        "bg-[radial-gradient(circle_at_top,rgba(248,113,113,0.18),transparent_72%)]",
      pillClassName: "bg-red-500/[0.12]",
      valueClassName: "text-red-50",
    };
  }

  if (metric.status === "warning") {
    return {
      borderClassName: "border-amber-200/22",
      dotClassName: "bg-amber-300 shadow-[0_0_12px_rgba(251,191,36,0.46)]",
      glowClassName:
        "bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.16),transparent_72%)]",
      pillClassName: "bg-amber-400/[0.1]",
      valueClassName: "text-amber-50",
    };
  }

  return {
    borderClassName: "border-emerald-200/18",
    dotClassName: "bg-emerald-300 shadow-[0_0_12px_rgba(74,222,128,0.44)]",
    glowClassName:
      "bg-[radial-gradient(circle_at_top,rgba(74,222,128,0.15),transparent_72%)]",
    pillClassName: "bg-emerald-400/[0.08]",
    valueClassName: "text-emerald-50",
  };
}

function getSurvivalMetricDisplayValue(metric: SurvivalHudMetric) {
  if (
    metric.secondsToFail != null &&
    (metric.value <= 34 || metric.secondsToFail <= 12)
  ) {
    return `${metric.secondsToFail}s`;
  }

  if (metric.value < 100 && metric.value > 90) {
    return `${metric.value.toFixed(1)}%`;
  }

  return `${Math.round(metric.value)}%`;
}

export default function SiegeHudSurvivalStatus({
  activeBugLimit,
  focusLabel,
  metrics,
  progressPercent,
  remainingSpawnBudget,
  secondsUntilNextWave,
  spawnRatePerSecond,
  tacticLabel,
  variantWeights,
  wave,
}: SiegeHudSurvivalStatusProps) {
  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-[220] flex justify-start px-3 sm:top-4">
      <div className="pointer-events-auto grid w-full max-w-[25.8rem] min-w-0 grid-cols-[minmax(8.5rem,9.15rem)_minmax(15.7rem,1fr)] gap-[0.6rem] overflow-visible [animation:hud-notch-arrive_320ms_cubic-bezier(0.22,1,0.36,1)_forwards] sm:max-w-[26.8rem]">
        <div className="min-w-0">
          <WaveProgressPill
            activeBugLimit={activeBugLimit}
            className="min-w-0 w-full shadow-[0_12px_24px_rgba(0,0,0,0.2)]"
            focusLabel={focusLabel}
            progressPercent={progressPercent}
            remainingSpawnBudget={remainingSpawnBudget}
            secondsUntilNextWave={secondsUntilNextWave}
            spawnRatePerSecond={spawnRatePerSecond}
            tacticLabel={tacticLabel}
            wave={wave}
          />
          <div
            className="pointer-events-none mt-1.5 px-1 text-[0.54rem] uppercase tracking-[0.13em] text-stone-400/88"
            data-testid="siege-wave-debug-details"
          >
            <span data-testid="siege-wave-rate-detail">
              {`Rate ${Number(spawnRatePerSecond).toFixed(2)}/s`}
            </span>{" "}
            <span data-testid="siege-wave-weights-detail">
              {`Mix L${Math.round((variantWeights.low ?? 0.72) * 100)} M${Math.round((variantWeights.medium ?? 0.22) * 100)} H${Math.round((variantWeights.high ?? 0.05) * 100)} U${Math.round((variantWeights.urgent ?? 0.01) * 100)}`}
            </span>
          </div>
        </div>
        <div
          className="relative isolate h-[2.35rem] min-w-0 overflow-hidden rounded-[15px] border border-white/10 bg-[linear-gradient(180deg,rgba(8,11,16,0.92),rgba(9,12,16,0.76))] px-2.15 py-1.15 shadow-[0_12px_24px_rgba(0,0,0,0.18)] backdrop-blur-xl"
          data-testid="siege-offline-pressure"
        >
          <div className="pointer-events-none absolute inset-0 rounded-[inherit] bg-[radial-gradient(circle_at_top,rgba(125,211,252,0.08),transparent_42%),linear-gradient(90deg,rgba(248,113,113,0.03),transparent_40%,rgba(74,222,128,0.03))]" />
          <div className="relative grid h-full grid-cols-3 gap-[0.54rem]">
            {metrics.map((metric) => {
              const tone = getSurvivalMetricToneClasses(metric);

              return (
                <Tooltip
                  key={metric.id}
                  content={getSurvivalMetricTooltip(metric)}
                  triggerClassName="relative min-w-0 px-[0.04rem]"
                >
                  <span className="mb-[0.18rem] flex items-center justify-center gap-[0.2rem] text-[0.37rem] font-semibold uppercase tracking-[0.14em] text-stone-400">
                    <span
                      className={cn(
                        "h-1.45 w-1.45 rounded-full",
                        tone.dotClassName,
                      )}
                    />
                    {metric.label}
                  </span>
                  <span
                    className={cn(
                      "relative flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-full border px-[0.45rem] py-[0.18rem] text-center shadow-[0_10px_18px_rgba(0,0,0,0.16)]",
                      tone.borderClassName,
                      tone.glowClassName,
                      tone.pillClassName,
                    )}
                  >
                    <strong
                      className={cn(
                        "relative block font-display text-[0.9rem] leading-none tracking-[-0.04em]",
                        tone.valueClassName,
                      )}
                      data-testid={`siege-survival-metric-${metric.id}`}
                    >
                      {getSurvivalMetricDisplayValue(metric)}
                    </strong>
                  </span>
                </Tooltip>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
