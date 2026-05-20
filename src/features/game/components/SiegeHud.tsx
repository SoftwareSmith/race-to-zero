import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { getSiegeWeaponLabel } from "@game/progression/progression";
import type { SurvivalVariantWeights } from "@game/sim/survivalDirector";
import Tooltip from "@shared/components/Tooltip";
import { cn } from "@shared/utils/cn";
import type {
  SiegeGameMode,
  SiegeWeaponId,
  WeaponProgressSnapshot,
} from "@game/types";
import SiegeHudControls from "./siege-hud/SiegeHudControls";
import SiegeHudLoadout from "./siege-hud/SiegeHudLoadout";
import WaveProgressPill from "./siege-hud/WaveProgressPill";
import { HudEventPill, HudShell } from "./siege-hud/shared";
import { formatElapsedTime } from "./siege-hud/formatElapsedTime";

type SurvivalHudMetric = NonNullable<
  SiegeHudProps["survivalStatus"]
>["metrics"]["uptime"];

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

interface SiegeHudProps {
  className?: string;
  codexMenuRef?: RefObject<HTMLDivElement | null>;
  codexOpen?: boolean;
  debugMode?: boolean;
  elapsedMs?: number;
  gameMode: SiegeGameMode;
  interactiveKills: number;
  interactivePoints: number;
  interactiveRemainingBugs: number;
  justEvolvedWeaponId?: SiegeWeaponId | null;
  killStreak: number;
  lastFireTimes?: Partial<Record<SiegeWeaponId, number>>;
  nextWeaponUnlock?: {
    current: number;
    remaining: number;
    unlockKills: number;
    weaponId: SiegeWeaponId;
    weaponTitle: string;
  } | null;
  onChangeGameMode?: (mode: SiegeGameMode) => void;
  onExit: () => void;
  onEndSurvival?: () => void;
  onKillAllBugs?: () => void;
  onToggleCodex?: () => void;
  onSelectWeapon: (id: SiegeWeaponId) => void;
  onToggleDebugMode?: () => void;
  selectedWeaponId: SiegeWeaponId;
  streakMultiplier: number;
  survivalStatus?: {
    activeBugLimit: number;
    failureKind?: "uptimeFailure" | "errorFlood" | "speedCollapse" | null;
    focusLabel: string;
    metrics: Record<
      "uptime" | "errors" | "speed",
      {
        id: "uptime" | "errors" | "speed";
        label: string;
        secondsToFail: number | null;
        status: "stable" | "warning" | "critical";
        value: number;
      }
    >;
    pressurePercent: number;
    remainingSpawnBudget: number;
    runtimeSpeedMultiplier: number;
    secondsUntilNextWave: number | null;
    secondsUntilOffline: number | null;
    siteIntegrity: number;
    spawnRatePerSecond: number;
    tacticLabel: string;
    variantWeights: SurvivalVariantWeights;
    wave: number;
    waveDurationMs: number;
    waveEndsAt: number | null;
    waveProgressPercent: number;
    waveStartedAt: number | null;
  };
  upgradeToast?: string | null;
  weaponSnapshots: WeaponProgressSnapshot[];
}

export default function SiegeHud({
  className,
  codexMenuRef,
  codexOpen = false,
  debugMode = false,
  elapsedMs = 0,
  gameMode,
  interactiveKills,
  interactivePoints,
  interactiveRemainingBugs,
  justEvolvedWeaponId,
  killStreak,
  lastFireTimes,
  onChangeGameMode,
  onEndSurvival,
  onExit,
  onKillAllBugs,
  onToggleCodex,
  onSelectWeapon,
  onToggleDebugMode,
  selectedWeaponId,
  streakMultiplier,
  survivalStatus,
  upgradeToast,
  weaponSnapshots,
}: SiegeHudProps) {
  const [justUnlockedWeaponIds, setJustUnlockedWeaponIds] = useState<
    SiegeWeaponId[]
  >([]);
  const [progressExpanded, setProgressExpanded] = useState(false);
  const previousUnlockedWeaponIdsRef = useRef<Set<SiegeWeaponId>>(new Set());
  const selectedSnapshot =
    weaponSnapshots.find((snapshot) => snapshot.id === selectedWeaponId) ??
    weaponSnapshots[0];
  const unlockedWeaponIds = useMemo(
    () =>
      weaponSnapshots
        .filter((snapshot) => !snapshot.locked)
        .map((snapshot) => snapshot.id),
    [weaponSnapshots],
  );
  const unlockToast = useMemo(() => {
    if (justUnlockedWeaponIds.length === 0) {
      return null;
    }

    return `New ${getSiegeWeaponLabel(
      justUnlockedWeaponIds[justUnlockedWeaponIds.length - 1],
    )} weapon unlocked`;
  }, [justUnlockedWeaponIds]);
  const timerValue = formatElapsedTime(elapsedMs);
  const isSurvival = gameMode === "outbreak";
  const [survivalWaveToast, setSurvivalWaveToast] = useState<string | null>(
    null,
  );
  const survivalIntegrityPercent = Math.max(
    0,
    Math.min(100, Math.round(survivalStatus?.siteIntegrity ?? 100)),
  );
  const waveLabel = `${survivalStatus?.wave ?? 1}`;
  const liveWaveNow =
    typeof performance !== "undefined" ? performance.now() : null;
  const liveWaveStartedAt =
    survivalStatus?.waveStartedAt ??
    (survivalStatus?.waveEndsAt != null && survivalStatus.waveDurationMs > 0
      ? survivalStatus.waveEndsAt - survivalStatus.waveDurationMs
      : null);
  const liveWaveProgressPercent =
    liveWaveNow != null &&
    liveWaveStartedAt != null &&
    (survivalStatus?.waveDurationMs ?? 0) > 0
      ? Math.max(
          0,
          Math.min(
            100,
            ((liveWaveNow - liveWaveStartedAt) /
              Math.max(1, survivalStatus?.waveDurationMs ?? 1)) *
              100,
          ),
        )
      : (survivalStatus?.waveProgressPercent ?? 0);
  const liveSecondsUntilNextWave =
    liveWaveNow != null && survivalStatus?.waveEndsAt != null
      ? Math.max(0, Math.ceil((survivalStatus.waveEndsAt - liveWaveNow) / 1000))
      : (survivalStatus?.secondsUntilNextWave ?? null);
  const previousSurvivalWaveRef = useRef<number | null>(null);
  const survivalWarningLabel =
    isSurvival &&
    survivalStatus?.failureKind == null &&
    survivalStatus?.metrics.uptime.secondsToFail != null &&
    survivalStatus.metrics.uptime.secondsToFail <= 12 &&
    survivalIntegrityPercent > 0
      ? `Uptime critical • ${survivalStatus.metrics.uptime.secondsToFail}s to fail`
      : null;
  const middleTimeLabel = isSurvival ? "Survived" : "Clear time";
  const survivalMetricList = useMemo(
    () => [
      survivalStatus?.metrics.uptime ?? {
        id: "uptime",
        label: "Uptime",
        secondsToFail: null,
        status: "stable",
        value: 100,
      },
      survivalStatus?.metrics.errors ?? {
        id: "errors",
        label: "Errors",
        secondsToFail: null,
        status: "stable",
        value: 100,
      },
      survivalStatus?.metrics.speed ?? {
        id: "speed",
        label: "Speed",
        secondsToFail: null,
        status: "stable",
        value: 100,
      },
    ],
    [
      survivalStatus?.metrics.errors,
      survivalStatus?.metrics.speed,
      survivalStatus?.metrics.uptime,
    ],
  );
  useEffect(() => {
    return () => {
      document.body.classList.remove("hud-system-cursor-active");
    };
  }, []);

  const showSystemCursor = () => {
    document.body.classList.add("hud-system-cursor-active");
  };

  const hideSystemCursor = () => {
    document.body.classList.remove("hud-system-cursor-active");
  };

  useEffect(() => {
    const currentUnlockedWeaponIds = new Set(unlockedWeaponIds);
    const previousUnlockedWeaponIds = previousUnlockedWeaponIdsRef.current;
    const newlyUnlockedWeaponIds = unlockedWeaponIds.filter(
      (weaponId) => !previousUnlockedWeaponIds.has(weaponId),
    );

    if (
      previousUnlockedWeaponIds.size > 0 &&
      newlyUnlockedWeaponIds.length > 0
    ) {
      setJustUnlockedWeaponIds(newlyUnlockedWeaponIds);
      window.setTimeout(() => setJustUnlockedWeaponIds([]), 1400);
    }

    previousUnlockedWeaponIdsRef.current = currentUnlockedWeaponIds;
  }, [unlockedWeaponIds]);

  useEffect(() => {
    if (!isSurvival) {
      previousSurvivalWaveRef.current = null;
      setSurvivalWaveToast(null);
      return undefined;
    }

    const nextWave = survivalStatus?.wave ?? 1;
    if (previousSurvivalWaveRef.current === nextWave) {
      return undefined;
    }

    previousSurvivalWaveRef.current = nextWave;
    const nextToast = [
      `Wave ${nextWave}`,
      survivalStatus?.tacticLabel,
      survivalStatus?.focusLabel,
    ]
      .filter(Boolean)
      .join(" • ");
    const showTimeoutId = window.setTimeout(() => {
      setSurvivalWaveToast(nextToast);
    }, 0);
    const timeoutId = window.setTimeout(() => {
      setSurvivalWaveToast((current) =>
        current === nextToast ? null : current,
      );
    }, 2200);

    return () => {
      window.clearTimeout(showTimeoutId);
      window.clearTimeout(timeoutId);
    };
  }, [
    isSurvival,
    survivalStatus?.focusLabel,
    survivalStatus?.tacticLabel,
    survivalStatus?.wave,
  ]);

  return (
    <div
      data-hud-cursor="default"
      data-no-hammer
      className={cn("pointer-events-none fixed inset-0 select-none", className)}
    >
      {isSurvival ? (
        <div className="pointer-events-none fixed inset-x-0 top-3 z-[220] flex justify-start px-3 sm:top-4">
          <div className="pointer-events-auto grid w-full max-w-[25.8rem] min-w-0 grid-cols-[minmax(8.5rem,9.15rem)_minmax(15.7rem,1fr)] gap-[0.6rem] overflow-visible [animation:hud-notch-arrive_320ms_cubic-bezier(0.22,1,0.36,1)_forwards] sm:max-w-[26.8rem]">
            <div className="min-w-0">
              <WaveProgressPill
                activeBugLimit={survivalStatus?.activeBugLimit ?? 0}
                className="min-w-0 w-full shadow-[0_12px_24px_rgba(0,0,0,0.2)]"
                focusLabel={survivalStatus?.focusLabel ?? "Bug rush"}
                progressPercent={liveWaveProgressPercent}
                remainingSpawnBudget={survivalStatus?.remainingSpawnBudget ?? 0}
                secondsUntilNextWave={liveSecondsUntilNextWave}
                spawnRatePerSecond={survivalStatus?.spawnRatePerSecond ?? 0}
                tacticLabel={survivalStatus?.tacticLabel ?? "Opening wave"}
                wave={survivalStatus?.wave ?? 1}
              />
              <div
                className="pointer-events-none mt-1.5 px-1 text-[0.54rem] uppercase tracking-[0.13em] text-stone-400/88"
                data-testid="siege-wave-debug-details"
              >
                <span data-testid="siege-wave-rate-detail">
                  {`Rate ${Number(survivalStatus?.spawnRatePerSecond ?? 0).toFixed(2)}/s`}
                </span>{" "}
                <span data-testid="siege-wave-weights-detail">
                  {`Mix L${Math.round((survivalStatus?.variantWeights.low ?? 0.72) * 100)} M${Math.round((survivalStatus?.variantWeights.medium ?? 0.22) * 100)} H${Math.round((survivalStatus?.variantWeights.high ?? 0.05) * 100)} U${Math.round((survivalStatus?.variantWeights.urgent ?? 0.01) * 100)}`}
                </span>
              </div>
            </div>
            <div
              className="relative isolate h-[2.35rem] min-w-0 overflow-hidden rounded-[15px] border border-white/10 bg-[linear-gradient(180deg,rgba(8,11,16,0.92),rgba(9,12,16,0.76))] px-2.15 py-1.15 shadow-[0_12px_24px_rgba(0,0,0,0.18)] backdrop-blur-xl"
              data-testid="siege-offline-pressure"
            >
              <div className="pointer-events-none absolute inset-0 rounded-[inherit] bg-[radial-gradient(circle_at_top,rgba(125,211,252,0.08),transparent_42%),linear-gradient(90deg,rgba(248,113,113,0.03),transparent_40%,rgba(74,222,128,0.03))]" />
              <div className="relative grid h-full grid-cols-3 gap-[0.54rem]">
                {survivalMetricList.map((metric) => {
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
      ) : null}

      <div className="pointer-events-none fixed inset-x-0 top-3 z-[220] flex justify-end px-3 sm:top-4">
        <div className="pointer-events-auto overflow-visible [animation:hud-notch-arrive_320ms_cubic-bezier(0.22,1,0.36,1)_forwards]">
          <SiegeHudControls
            codexMenuRef={codexMenuRef}
            codexOpen={codexOpen}
            debugMode={debugMode}
            gameMode={gameMode}
            onChangeGameMode={onChangeGameMode}
            onExit={onExit}
            onEndSurvival={onEndSurvival}
            onKillAllBugs={onKillAllBugs}
            onToggleCodex={onToggleCodex}
            onToggleDebugMode={onToggleDebugMode}
            onPointerEnterHud={showSystemCursor}
            onPointerLeaveHud={hideSystemCursor}
          />
        </div>
      </div>

      <div className="pointer-events-none fixed inset-x-0 top-[4.65rem] z-[220] flex justify-center px-3 sm:top-4">
        <HudShell
          className={cn(
            "pointer-events-auto border-transparent bg-[linear-gradient(180deg,rgba(8,11,16,0.9),rgba(9,12,16,0.72))] overflow-visible px-2 py-1.5 shadow-[0_14px_34px_rgba(0,0,0,0.3)] [animation:hud-notch-arrive_320ms_cubic-bezier(0.22,1,0.36,1)_forwards]",
            "w-full max-w-[20.5rem]",
          )}
          data-testid="siege-hud"
          onPointerEnter={showSystemCursor}
          onPointerLeave={hideSystemCursor}
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
                  {gameMode === "outbreak" ? "Alive" : "Left"}
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

      {killStreak >= 3 ||
      unlockToast ||
      upgradeToast ||
      survivalWaveToast ||
      survivalWarningLabel ? (
        <div className="pointer-events-none fixed inset-x-0 top-[6.05rem] z-[220] flex justify-center px-3 sm:top-[4.95rem]">
          <div className="mt-0.25 flex flex-wrap items-center justify-center gap-1.25 text-center">
            {killStreak >= 3 ? (
              <HudEventPill className="border-amber-300/24 bg-amber-400/10 text-amber-100">
                {`Streak x${streakMultiplier.toFixed(1)}`}
              </HudEventPill>
            ) : null}
            {unlockToast ? (
              <HudEventPill className="border-emerald-300/24 bg-emerald-400/10 text-emerald-100 [animation:evolve-toast_2200ms_ease_forwards]">
                {unlockToast}
              </HudEventPill>
            ) : null}
            {upgradeToast ? (
              <HudEventPill className="border-orange-300/24 bg-red-500/10 text-orange-100 [animation:evolve-toast_2200ms_ease_forwards]">
                {upgradeToast}
              </HudEventPill>
            ) : null}
            {survivalWaveToast ? (
              <HudEventPill className="border-sky-300/24 bg-sky-300/10 text-sky-100">
                <span data-testid="siege-wave-toast">{survivalWaveToast}</span>
              </HudEventPill>
            ) : null}
            {survivalWarningLabel ? (
              <HudEventPill className="border-red-300/24 bg-red-500/10 text-red-100 [animation:heat-tier-pulse_1400ms_ease-in-out_infinite]">
                <span data-testid="siege-offline-warning">
                  {survivalWarningLabel}
                </span>
              </HudEventPill>
            ) : null}
          </div>
        </div>
      ) : null}

      <SiegeHudLoadout
        justEvolvedWeaponId={justEvolvedWeaponId}
        justUnlockedWeaponIds={justUnlockedWeaponIds}
        lastFireTimes={lastFireTimes}
        onSelectWeapon={onSelectWeapon}
        progressExpanded={progressExpanded}
        selectedSnapshot={selectedSnapshot}
        selectedWeaponId={selectedWeaponId}
        setProgressExpanded={setProgressExpanded}
        weaponSnapshots={weaponSnapshots}
      />
    </div>
  );
}
