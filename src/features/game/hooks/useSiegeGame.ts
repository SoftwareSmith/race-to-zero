import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { BugCounts } from "../../../types/dashboard";
import {
  getSiegeCombatStats,
  getNextWeaponUnlock,
  getSiegeWeaponSnapshots,
} from "@game/progression/progression";
import { WEAPON_DEFS } from "@config/weaponConfig";
import { useSiegeGameDebug } from "./useSiegeGameDebug";
import { useSiegeGameLifecycle } from "./useSiegeGameLifecycle";
import { useSiegeGameTimer } from "./useSiegeGameTimer";
import { useSiegeRunCompletion } from "./useSiegeRunCompletion";
import {
  createSurvivalBurstCounts,
  getSurvivalPressure,
  getSurvivalRuntimeSpeedMultiplier,
  getSurvivalWavePlan,
  type SurvivalSpawnPlan,
} from "@game/sim/survivalDirector";
import type {
  SiegeGameMode,
  SiegePhase,
  SiegeWeaponId,
  WeaponEvolutionState,
} from "@game/types";
import { SIEGE_GAME_MODE_META } from "@game/types";

const SIEGE_ENTER_DURATION_MS = 520;
const SIEGE_EXIT_DURATION_MS = 220;

function scheduleTimeout(callback: () => void, delay: number): number {
  if (typeof window !== "undefined") {
    return window.setTimeout(callback, delay);
  }

  return globalThis.setTimeout(callback, delay) as unknown as number;
}

function cancelTimeout(timeoutId: number | null): void {
  if (timeoutId == null) {
    return;
  }

  globalThis.clearTimeout(timeoutId);
}

function scheduleAnimationFrame(callback: (timestamp: number) => void): number {
  if (
    typeof window !== "undefined" &&
    typeof window.requestAnimationFrame === "function"
  ) {
    return window.requestAnimationFrame(callback);
  }

  return globalThis.setTimeout(
    () => callback(globalThis.performance.now()),
    16,
  ) as unknown as number;
}

function cancelScheduledAnimationFrame(frameId: number | null): void {
  if (frameId == null) {
    return;
  }

  if (
    typeof window !== "undefined" &&
    typeof window.cancelAnimationFrame === "function"
  ) {
    window.cancelAnimationFrame(frameId);
    return;
  }

  globalThis.clearTimeout(frameId);
}

function getBugCountTotal(bugCounts: BugCounts): number {
  return Object.values(bugCounts).reduce((total, value) => total + value, 0);
}

function scaleBugCounts(
  bugCounts: BugCounts,
  multiplier: number,
): BugCounts {
  return Object.fromEntries(
    Object.entries(bugCounts).map(([variant, count]) => [
      variant,
      Math.max(0, Math.round(count * multiplier)),
    ]),
  ) as BugCounts;
}

interface UseSiegeGameOptions {
  currentBugCount: number;
  currentBugCounts: BugCounts;
  evolutionStates?: Partial<Record<SiegeWeaponId, WeaponEvolutionState>>;
  onEscape?: () => boolean;
  pauseTimer?: boolean;
}

interface SiegeRuntimeSnapshot {
  elapsedMs: number;
  killStreak: number;
  kills: number;
  lastFireTimes: Record<SiegeWeaponId, number>;
  points: number;
  remainingBugs: number;
  streakMultiplier: number;
}

interface SurvivalRuntimeStatus {
  focusLabel: string;
  offlineReason: string | null;
  pressurePercent: number;
  secondsUntilNextWave: number | null;
  secondsUntilOffline: number | null;
  siteIntegrity: number;
  spawnRatePerSecond: number;
  tacticLabel: string;
  wave: number;
}

function createRuntimeSnapshot(
  remainingBugs = 0,
): SiegeRuntimeSnapshot {
  return {
    elapsedMs: 0,
    killStreak: 0,
    kills: 0,
    lastFireTimes: {} as Record<SiegeWeaponId, number>,
    points: 0,
    remainingBugs,
    streakMultiplier: 1,
  };
}

function areRuntimeSnapshotsEqual(
  left: SiegeRuntimeSnapshot,
  right: SiegeRuntimeSnapshot,
): boolean {
  return (
    left.elapsedMs === right.elapsedMs &&
    left.killStreak === right.killStreak &&
    left.kills === right.kills &&
    left.lastFireTimes === right.lastFireTimes &&
    left.points === right.points &&
    left.remainingBugs === right.remainingBugs &&
    left.streakMultiplier === right.streakMultiplier
  );
}

function getSurvivalOpeningCounts(plan: SurvivalSpawnPlan): BugCounts {
  return createSurvivalBurstCounts(
    plan,
    Math.min(plan.spawnBudget, plan.burstSize * 2),
  );
}

export function useSiegeGame({
  currentBugCount: _currentBugCount,
  currentBugCounts,
  evolutionStates,
  onEscape,
  pauseTimer = false,
}: UseSiegeGameOptions) {
  void _currentBugCount;
  const [siegePhase, setSiegePhase] = useState<SiegePhase>("idle");
  const [gameMode, setGameMode] = useState<SiegeGameMode>("purge");
  const [interactiveInitialBugCounts, setInteractiveInitialBugCounts] =
    useState<BugCounts>(currentBugCounts);
  const [interactiveStartedAt, setInteractiveStartedAt] = useState<number | null>(null);
  const [interactiveSessionKey, setInteractiveSessionKey] = useState<
    string | null
  >(null);
  const [selectedWeaponId, setSelectedWeaponId] =
    useState<SiegeWeaponId>("hammer");
  const [runtimeSnapshot, setRuntimeSnapshot] = useState<SiegeRuntimeSnapshot>(
    () => createRuntimeSnapshot(),
  );
  const [survivalStatus, setSurvivalStatus] = useState<SurvivalRuntimeStatus>(() => {
    const plan = getSurvivalWavePlan(1);
    return {
      focusLabel: plan.focusLabel ?? "Bug rush",
      offlineReason: null,
      pressurePercent: 0,
      secondsUntilNextWave: Math.ceil(plan.waveDurationMs / 1000),
      secondsUntilOffline: null,
      siteIntegrity: 100,
      spawnRatePerSecond: plan.spawnRatePerSecond,
      tacticLabel: plan.tacticLabel ?? "Opening wave",
      wave: 1,
    };
  });
  const [survivalSpawnPlan, setSurvivalSpawnPlan] = useState<
    (SurvivalSpawnPlan & { sequenceId: number }) | null
  >(null);
  const phaseTimerRef = useRef<number | null>(null);
  const snapshotFrameRef = useRef<number | null>(null);
  const survivalPressureTimerRef = useRef<number | null>(null);
  const survivalSpawnTimerRef = useRef<number | null>(null);
  const survivalWaveEndsAtRef = useRef<number | null>(null);
  const lastKillAtRef = useRef<number | null>(null);
  const interactiveBaseElapsedMsRef = useRef(0);
  const interactiveRunningSinceRef = useRef<number | null>(null);
  const runtimeSnapshotRef = useRef<SiegeRuntimeSnapshot>(runtimeSnapshot);
  const survivalStatusRef = useRef(survivalStatus);
  const survivalRemainingBudgetRef = useRef(0);
  const survivalSpawnSequenceRef = useRef(0);

  const interactiveMode = siegePhase !== "idle";

  const flushRuntimeSnapshot = useCallback((force = false) => {
    const applySnapshot = () => {
      setRuntimeSnapshot((current) => {
        const next = runtimeSnapshotRef.current;
        return areRuntimeSnapshotsEqual(current, next) ? current : next;
      });
    };

    if (force) {
      cancelScheduledAnimationFrame(snapshotFrameRef.current);
      snapshotFrameRef.current = null;
      applySnapshot();
      return;
    }

    if (snapshotFrameRef.current != null) {
      return;
    }

    snapshotFrameRef.current = scheduleAnimationFrame(() => {
      snapshotFrameRef.current = null;
      applySnapshot();
    });
  }, []);

  const updateRuntimeSnapshot = useCallback(
    (
      updater: (current: SiegeRuntimeSnapshot) => SiegeRuntimeSnapshot,
      force = false,
    ) => {
      runtimeSnapshotRef.current = updater(runtimeSnapshotRef.current);
      flushRuntimeSnapshot(force);
    },
    [flushRuntimeSnapshot],
  );

  const resetSurvivalRuntime = useCallback(() => {
    const plan = getSurvivalWavePlan(1);
    survivalRemainingBudgetRef.current = 0;
    survivalSpawnSequenceRef.current += 1;
    setSurvivalSpawnPlan(null);
    setSurvivalStatus({
      focusLabel: plan.focusLabel ?? "Bug rush",
      offlineReason: null,
      pressurePercent: 0,
      secondsUntilNextWave: Math.ceil(plan.waveDurationMs / 1000),
      secondsUntilOffline: null,
      siteIntegrity: 100,
      spawnRatePerSecond: plan.spawnRatePerSecond,
      tacticLabel: plan.tacticLabel ?? "Opening wave",
      wave: 1,
    });
  }, []);

  const queueSurvivalSpawn = useCallback(
    (plan: SurvivalSpawnPlan, requestedCount = plan.burstSize) => {
      const safeCount = Math.max(0, Math.floor(requestedCount));
      if (safeCount <= 0) {
        return;
      }

      const counts = createSurvivalBurstCounts(plan, safeCount);
      const spawnedCount = getBugCountTotal(counts);
      if (spawnedCount <= 0) {
        return;
      }

      survivalSpawnSequenceRef.current += 1;
      setSurvivalSpawnPlan({
        ...plan,
        counts,
        sequenceId: survivalSpawnSequenceRef.current,
      });
      updateRuntimeSnapshot(
        (current) => ({
          ...current,
          remainingBugs: current.remainingBugs + spawnedCount,
        }),
        true,
      );
    },
    [updateRuntimeSnapshot],
  );

  const startSurvivalWave = useCallback(
    (wave: number, spawnImmediately = true) => {
      const plan = getSurvivalWavePlan(wave);
      const openingCounts = getSurvivalOpeningCounts(plan);
      const openingCount = getBugCountTotal(openingCounts);

      survivalRemainingBudgetRef.current = Math.max(
        0,
        plan.spawnBudget - (spawnImmediately ? openingCount : 0),
      );
      setSurvivalStatus((current) => ({
        ...current,
        focusLabel: plan.focusLabel ?? current.focusLabel,
        offlineReason: null,
        pressurePercent: 0,
        secondsUntilNextWave: Math.ceil(plan.waveDurationMs / 1000),
        secondsUntilOffline: null,
        spawnRatePerSecond: plan.spawnRatePerSecond,
        tacticLabel: plan.tacticLabel ?? current.tacticLabel,
        wave: plan.wave,
      }));
      survivalWaveEndsAtRef.current = performance.now() + plan.waveDurationMs;

      if (spawnImmediately) {
        queueSurvivalSpawn(plan, openingCount);
      }
    },
    [queueSurvivalSpawn],
  );

  const {
    elapsedMs: interactiveElapsedMs,
    killStreak,
    kills: interactiveKills,
    lastFireTimes,
    points: interactivePoints,
    remainingBugs: runtimeRemainingBugs,
    streakMultiplier,
  } = runtimeSnapshot;
  const sessionBugCount = useMemo(
    () => getBugCountTotal(interactiveInitialBugCounts),
    [interactiveInitialBugCounts],
  );
  const effectiveInteractiveRemainingBugs =
    interactiveMode && interactiveKills === 0 && runtimeRemainingBugs === 0
      ? sessionBugCount
      : runtimeRemainingBugs;

  const { completionSummary, leaderboard, resetCompletion } =
    useSiegeRunCompletion({
      evolutionStates,
      gameMode,
      interactiveKills,
      interactiveMode,
      interactiveRemainingBugs: effectiveInteractiveRemainingBugs,
      interactiveBaseElapsedMsRef,
      interactiveRunningSinceRef,
      offlineReason: survivalStatus.offlineReason,
      selectedWeaponId,
      siegePhase,
      siteOffline: gameMode === "outbreak" && survivalStatus.siteIntegrity <= 0,
      updateRuntimeSnapshot,
      waveReached: survivalStatus.wave,
    });

  const resetInactiveRuntime = useCallback(() => {
    interactiveBaseElapsedMsRef.current = 0;
    interactiveRunningSinceRef.current = null;
    runtimeSnapshotRef.current = createRuntimeSnapshot();
    resetSurvivalRuntime();
    flushRuntimeSnapshot(true);
  }, [flushRuntimeSnapshot, resetSurvivalRuntime]);

  useSiegeGameTimer({
    completionSummary,
    interactiveBaseElapsedMsRef,
    interactiveMode,
    interactiveRunningSinceRef,
    interactiveStartedAt,
    pauseTimer,
    resetInactiveRuntime,
    updateRuntimeSnapshot,
  });

  const { clearSwarmRequestId, debugMode, killAllBugs, toggleDebugMode } = useSiegeGameDebug({
    interactiveInitialBugCounts,
    interactiveMode,
    lastKillAtRef,
    updateRuntimeSnapshot,
  });

  const enterInteractiveMode = useCallback((
    nextMode: SiegeGameMode = gameMode,
    options?: { baseBugCounts?: BugCounts; bugMultiplier?: number },
  ) => {
    const survivalPlan = getSurvivalWavePlan(1);
    const baseBugCounts =
      nextMode === "outbreak"
        ? getSurvivalOpeningCounts(survivalPlan)
        : options?.baseBugCounts ?? currentBugCounts;
    const bugMultiplier = Math.max(1, options?.bugMultiplier ?? 1);
    const scaledBugCounts = scaleBugCounts(baseBugCounts, bugMultiplier);
    const totalBugCount = getBugCountTotal(scaledBugCounts);
    const startedAt = Date.now();
    cancelTimeout(phaseTimerRef.current);
    setGameMode(nextMode);
    setInteractiveInitialBugCounts(scaledBugCounts);
    setInteractiveStartedAt(startedAt);
    interactiveRunningSinceRef.current = startedAt;
    interactiveBaseElapsedMsRef.current = 0;
    setInteractiveSessionKey(`${Date.now()}`);
    runtimeSnapshotRef.current = createRuntimeSnapshot(totalBugCount);
    flushRuntimeSnapshot(true);
    lastKillAtRef.current = null;
    resetCompletion();
    setSelectedWeaponId("hammer");
    if (nextMode === "outbreak") {
      survivalRemainingBudgetRef.current = Math.max(
        0,
        survivalPlan.spawnBudget - totalBugCount,
      );
      setSurvivalSpawnPlan(null);
      setSurvivalStatus({
        focusLabel: survivalPlan.focusLabel ?? "Bug rush",
        offlineReason: null,
        pressurePercent: 0,
        secondsUntilNextWave: Math.ceil(survivalPlan.waveDurationMs / 1000),
        secondsUntilOffline: null,
        siteIntegrity: 100,
        spawnRatePerSecond: survivalPlan.spawnRatePerSecond,
        tacticLabel: survivalPlan.tacticLabel ?? "Opening wave",
        wave: 1,
      });
      survivalWaveEndsAtRef.current = performance.now() + survivalPlan.waveDurationMs;
    } else {
      resetSurvivalRuntime();
    }
    setSiegePhase("entering");
    phaseTimerRef.current = scheduleTimeout(() => {
      phaseTimerRef.current = null;
      setSiegePhase("active");
    }, SIEGE_ENTER_DURATION_MS);
  }, [currentBugCounts, flushRuntimeSnapshot, gameMode, resetCompletion, resetSurvivalRuntime]);

  const exitInteractiveMode = useCallback(() => {
    cancelTimeout(phaseTimerRef.current);
    setSiegePhase("exiting");
    phaseTimerRef.current = scheduleTimeout(() => {
      phaseTimerRef.current = null;
      setInteractiveStartedAt(null);
      resetCompletion();
      setSiegePhase("idle");
    }, SIEGE_EXIT_DURATION_MS);
  }, [resetCompletion]);

  const handleLifecycleEscape = useCallback(() => {
    if (onEscape?.()) {
      return;
    }

    exitInteractiveMode();
  }, [exitInteractiveMode, onEscape]);

  const handleLifecycleSlotSelect = useCallback((slotIndex: number) => {
    const stats = getSiegeCombatStats(runtimeSnapshotRef.current.kills, debugMode);
    const weaponAtSlot = WEAPON_DEFS[slotIndex];
    if (weaponAtSlot && stats.unlockedWeapons.includes(weaponAtSlot.id)) {
      setSelectedWeaponId(weaponAtSlot.id);
    }
  }, [debugMode]);

  useSiegeGameLifecycle({
    interactiveMode,
    onEscape: handleLifecycleEscape,
    onSelectSlot: handleLifecycleSlotSelect,
  });

  const selectWeapon = useCallback(
    (id: SiegeWeaponId) => {
      if (siegePhase === "idle") return;
      const stats = getSiegeCombatStats(runtimeSnapshotRef.current.kills, debugMode);
      if (!stats.unlockedWeapons.includes(id)) return;
      setSelectedWeaponId(id);
    },
    [debugMode, siegePhase],
  );

  const handleInteractiveHit = useCallback(
    (payload: {
      credited?: boolean;
      defeated: boolean;
      pointValue?: number;
      frozen?: boolean;
    }) => {
      if (!payload.defeated || payload.credited === false) {
        return;
      }
      const now = performance.now();
      const nextStreak =
        lastKillAtRef.current != null && now - lastKillAtRef.current <= 1200
          ? runtimeSnapshotRef.current.killStreak + 1
          : 1;
      lastKillAtRef.current = now;

      const earned = payload.pointValue ?? 1;
      const frozenBonus = payload.frozen ? 1 : 0;
      updateRuntimeSnapshot(
        (current) => ({
          ...current,
          killStreak: nextStreak,
          kills: current.kills + 1,
          points: current.points + earned + frozenBonus,
          remainingBugs: Math.max(0, current.remainingBugs - 1),
          streakMultiplier:
            nextStreak >= 10 ? 2 : nextStreak >= 5 ? 1.5 : nextStreak >= 3 ? 1.2 : 1,
        }),
        true,
      );
    },
    [updateRuntimeSnapshot],
  );

  useEffect(() => {
    return () => {
      cancelTimeout(phaseTimerRef.current);
      cancelTimeout(survivalPressureTimerRef.current);
      cancelTimeout(survivalSpawnTimerRef.current);
      cancelScheduledAnimationFrame(snapshotFrameRef.current);
    };
  }, []);

  useEffect(() => {
    if (!interactiveMode || killStreak === 0) {
      return undefined;
    }

    const timeoutId = scheduleTimeout(() => {
      if (
        lastKillAtRef.current != null &&
        performance.now() - lastKillAtRef.current >= 1200
      ) {
        updateRuntimeSnapshot((current) => ({
          ...current,
          killStreak: 0,
          streakMultiplier: 1,
        }));
      }
    }, 1250);

    return () => {
      cancelTimeout(timeoutId);
    };
  }, [interactiveMode, killStreak, updateRuntimeSnapshot]);

  useEffect(() => {
    survivalStatusRef.current = survivalStatus;
  }, [survivalStatus]);

  useEffect(() => {
    if (
      !interactiveMode ||
      siegePhase !== "active" ||
      gameMode !== "outbreak" ||
      survivalStatus.offlineReason != null
    ) {
      return undefined;
    }

    survivalPressureTimerRef.current = scheduleTimeout(function tickPressure() {
      const currentStatus = survivalStatusRef.current;
      const waveEndsAt = survivalWaveEndsAtRef.current;
      const secondsUntilNextWave =
        waveEndsAt != null
          ? Math.max(0, Math.ceil((waveEndsAt - performance.now()) / 1000))
          : null;
      const pressure = getSurvivalPressure({
        activeBugCount: runtimeSnapshotRef.current.remainingBugs,
        siteIntegrity: currentStatus.siteIntegrity,
        wave: currentStatus.wave,
      });
      const nextIntegrity = Math.max(
        0,
        pressure.damagePerSecond > 0
          ? currentStatus.siteIntegrity - pressure.damagePerSecond * 0.5
          : Math.min(100, currentStatus.siteIntegrity + 0.65),
      );
      const offlineReason =
        nextIntegrity <= 0
          ? `Site offline at wave ${currentStatus.wave}`
          : currentStatus.offlineReason;

      setSurvivalStatus((current) => ({
        ...current,
        offlineReason,
        pressurePercent: pressure.pressurePercent,
        secondsUntilNextWave,
        secondsUntilOffline: pressure.secondsUntilOffline,
        siteIntegrity: nextIntegrity,
      }));

      if (offlineReason) {
        updateRuntimeSnapshot(
          (current) => ({
            ...current,
            remainingBugs: 0,
          }),
          true,
        );
        return;
      }

      if (waveEndsAt != null && performance.now() >= waveEndsAt) {
        startSurvivalWave(currentStatus.wave + 1);
        return;
      }

      survivalPressureTimerRef.current = scheduleTimeout(tickPressure, 500);
    }, 500);

    return () => {
      cancelTimeout(survivalPressureTimerRef.current);
      survivalPressureTimerRef.current = null;
    };
  }, [gameMode, interactiveMode, siegePhase, startSurvivalWave, survivalStatus.offlineReason, updateRuntimeSnapshot]);

  useEffect(() => {
    if (
      !interactiveMode ||
      siegePhase !== "active" ||
      gameMode !== "outbreak" ||
      survivalStatus.offlineReason != null
    ) {
      return undefined;
    }

    survivalSpawnTimerRef.current = scheduleTimeout(function tickSpawn() {
      const status = survivalStatusRef.current;
      const plan = getSurvivalWavePlan(status.wave);
      const activeBugs = runtimeSnapshotRef.current.remainingBugs;
      const remainingBudget = survivalRemainingBudgetRef.current;
      const waveEndsAt = survivalWaveEndsAtRef.current;
      const waveExpired =
        waveEndsAt != null && performance.now() >= waveEndsAt;

      if (!waveExpired && remainingBudget > 0 && activeBugs < plan.activeBugLimit) {
        const requestedCount = Math.min(plan.burstSize, remainingBudget);
        survivalRemainingBudgetRef.current = Math.max(
          0,
          remainingBudget - requestedCount,
        );
        queueSurvivalSpawn(plan, requestedCount);
      }

      survivalSpawnTimerRef.current = scheduleTimeout(tickSpawn, 1000);
    }, 1000);

    return () => {
      cancelTimeout(survivalSpawnTimerRef.current);
      survivalSpawnTimerRef.current = null;
    };
  }, [gameMode, interactiveMode, queueSurvivalSpawn, siegePhase, survivalStatus.offlineReason]);

  useEffect(() => {
    if (
      !interactiveMode ||
      siegePhase !== "active" ||
      gameMode !== "outbreak" ||
      survivalStatus.offlineReason != null ||
      runtimeRemainingBugs > 0
    ) {
      return;
    }

    startSurvivalWave(survivalStatus.wave + 1);
  }, [gameMode, interactiveMode, runtimeRemainingBugs, siegePhase, startSurvivalWave, survivalStatus.offlineReason, survivalStatus.wave]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const qaState = (window as Window & {
      __RTZ_QA__?: {
        enabled?: boolean;
        setSurvivalState?: (state: {
          completeWave?: boolean;
          siteIntegrity?: number;
          spawnNow?: boolean;
          wave?: number;
        }) => void;
      };
    }).__RTZ_QA__;
    if (!qaState?.enabled) {
      return undefined;
    }

    qaState.setSurvivalState = ({
      completeWave = false,
      siteIntegrity,
      spawnNow = false,
      wave,
    }) => {
      if (wave != null) {
        startSurvivalWave(wave, spawnNow);
      }

      if (completeWave) {
        startSurvivalWave(survivalStatusRef.current.wave + 1);
      }

      if (siteIntegrity != null) {
        setSurvivalStatus((current) => ({
          ...current,
          offlineReason:
            siteIntegrity <= 0 ? `Site offline at wave ${current.wave}` : null,
          siteIntegrity: Math.max(0, Math.min(100, siteIntegrity)),
        }));
        if (siteIntegrity <= 0) {
          updateRuntimeSnapshot((current) => ({ ...current, remainingBugs: 0 }), true);
        }
      }
    };

    return () => {
      if (qaState.setSurvivalState) {
        delete qaState.setSurvivalState;
      }
    };
  }, [startSurvivalWave, updateRuntimeSnapshot]);

  const displayedBugCounts = interactiveMode
    ? interactiveInitialBugCounts
    : currentBugCounts;
  const combatStats = useMemo(
    () => getSiegeCombatStats(interactiveKills, debugMode),
    [debugMode, interactiveKills],
  );
  const maxWeaponTier = SIEGE_GAME_MODE_META[gameMode].maxWeaponTier;
  const weaponSnapshots = useMemo(
    () =>
      getSiegeWeaponSnapshots(
        interactiveKills,
        selectedWeaponId,
        debugMode,
        evolutionStates,
        maxWeaponTier,
      ),
    [debugMode, evolutionStates, interactiveKills, maxWeaponTier, selectedWeaponId],
  );
  const nextWeaponUnlock = useMemo(
    () => getNextWeaponUnlock(interactiveKills, debugMode),
    [debugMode, interactiveKills],
  );

  const changeGameMode = useCallback((nextMode: SiegeGameMode) => {
    setGameMode(nextMode);
  }, []);

  const handleWeaponFired = useCallback((id: SiegeWeaponId, firedAt: number) => {
    updateRuntimeSnapshot((current) => ({
      ...current,
      lastFireTimes: {
        ...current.lastFireTimes,
        [id]: firedAt,
      },
    }));
  }, [updateRuntimeSnapshot]);

  const syncRemainingBugs = useCallback(
    (count: number) => {
      const normalizedCount = Math.max(0, Math.floor(count));
      const shouldForceFlush =
        runtimeSnapshotRef.current.remainingBugs !== normalizedCount ||
        normalizedCount === 0;

      updateRuntimeSnapshot((current) => {
        if (current.remainingBugs === normalizedCount) {
          return current;
        }

        return {
          ...current,
          remainingBugs: normalizedCount,
        };
      }, shouldForceFlush);
    },
    [updateRuntimeSnapshot],
  );

  return {
    combatStats,
    changeGameMode,
    clearSwarmRequestId,
    displayedBugCounts,
    debugMode,
    enterInteractiveMode,
    exitInteractiveMode,
    gameMode,
    handleInteractiveHit,
    handleWeaponFired,
    interactiveInitialBugCounts,
    interactiveElapsedMs,
    interactiveKills,
    interactiveMode,
    interactivePoints,
    interactiveRemainingBugs: effectiveInteractiveRemainingBugs,
    interactiveStartedAt,
    interactiveSessionKey,
    killAllBugs,
    killStreak,
    lastFireTimes,
    leaderboard,
    maxWeaponTier,
    nextWeaponUnlock,
    completionSummary,
    selectedWeaponId,
    selectWeapon,
    setInteractiveMode: (v: boolean) =>
      v ? enterInteractiveMode() : exitInteractiveMode(),
    siegePhase,
    syncRemainingBugs,
    streakMultiplier,
    survivalSpawnPlan,
    survivalStatus: {
      ...survivalStatus,
      runtimeSpeedMultiplier: getSurvivalRuntimeSpeedMultiplier(survivalStatus.wave),
    },
    toggleDebugMode,
    weaponSnapshots,
  };
}

