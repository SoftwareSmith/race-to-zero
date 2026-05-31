import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { getSiegeWeaponLabel } from "@game/progression/progression";
import type { SurvivalVariantWeights } from "@game/sim/survivalDirector";
import { cn } from "@shared/utils/cn";
import type {
  SiegeGameMode,
  SiegeWeaponId,
  WeaponProgressSnapshot,
} from "@game/types";
import SiegeHudControls from "./siege-hud/SiegeHudControls";
import SiegeHudEvents from "./siege-hud/SiegeHudEvents";
import SiegeHudLoadout from "./siege-hud/SiegeHudLoadout";
import SiegeHudStats from "./siege-hud/SiegeHudStats";
import SiegeHudSurvivalStatus from "./siege-hud/SiegeHudSurvivalStatus";
import { formatElapsedTime } from "./siege-hud/formatElapsedTime";

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
  interactivePoints: _interactivePoints,
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
        <SiegeHudSurvivalStatus
          activeBugLimit={survivalStatus?.activeBugLimit ?? 0}
          focusLabel={survivalStatus?.focusLabel ?? "Bug rush"}
          metrics={survivalMetricList}
          progressPercent={liveWaveProgressPercent}
          remainingSpawnBudget={survivalStatus?.remainingSpawnBudget ?? 0}
          secondsUntilNextWave={liveSecondsUntilNextWave}
          spawnRatePerSecond={survivalStatus?.spawnRatePerSecond ?? 0}
          tacticLabel={survivalStatus?.tacticLabel ?? "Opening wave"}
          variantWeights={
            survivalStatus?.variantWeights ?? {
              high: 0.05,
              low: 0.72,
              medium: 0.22,
              urgent: 0.01,
            }
          }
          wave={survivalStatus?.wave ?? 1}
        />
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

      <div onPointerEnter={showSystemCursor} onPointerLeave={hideSystemCursor}>
        <SiegeHudStats
          interactiveKills={interactiveKills}
          interactiveRemainingBugs={interactiveRemainingBugs}
          isSurvival={isSurvival}
          timerValue={timerValue}
        />
      </div>

      <SiegeHudEvents
        killStreak={killStreak}
        streakMultiplier={streakMultiplier}
        survivalWarningLabel={survivalWarningLabel}
        survivalWaveToast={survivalWaveToast}
        unlockToast={unlockToast}
        upgradeToast={upgradeToast}
      />

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
