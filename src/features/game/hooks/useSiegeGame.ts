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
  buildCountsFromWeights,
  calculateSurvivalSpawnRequest,
  calculateWaveProgress,
  createInitialSurvivalMetricValues,
  createSurvivalBurstCounts,
  getSurvivalPressure,
  getSurvivalRuntimeSpeedMultiplierForPressure,
  getSurvivalWavePlan,
  type SurvivalFailureKind,
  type SurvivalMetricSnapshot,
  type SurvivalMetricValues,
  type SurvivalSpawnPlan,
  type SurvivalVariantWeights,
} from "@game/sim/survivalDirector";
import type {
  SiegeGameMode,
  SiegePhase,
  SiegeWeaponId,
  WeaponEvolutionState,
} from "@game/types";
import { SIEGE_GAME_MODE_META } from "@game/types";
import {
  areRuntimeSnapshotsEqual,
  cancelScheduledAnimationFrame,
  cancelTimeout,
  createEmptyBugCounts,
  createRuntimeSnapshot,
  createSurvivalRuntimeStatus,
  getBugCountTotal,
  normalizeBugCountsForSurvival,
  recordSurvivalPressureQaSnapshot,
  scaleBugCounts,
  scheduleAnimationFrame,
  scheduleTimeout,
  type SiegeRuntimeSnapshot,
  type SurvivalRuntimeStatus,
} from "./useSiegeGameSupport";
import {
  normalizeSyncedBugCount,
  shouldFinalizePurgeFromBugSync,
  shouldForceBugSyncFlush,
  shouldIgnoreBugSync,
  updateRuntimeSnapshotRemainingBugs,
  updateSurvivalStatusLiveBugCounts,
} from "./useSiegeGameBugSync";
import {
  applySiteIntegrityOverride,
  applySurvivalMetricOverrides,
} from "./useSiegeGameSurvivalOverrides";

const SIEGE_ENTER_DURATION_MS = 520;
const SIEGE_EXIT_DURATION_MS = 220;
const SURVIVAL_SPAWN_TICK_MS = 100;

interface UseSiegeGameOptions {
  currentBugCount: number;
  currentBugCounts: BugCounts;
  evolutionStates?: Partial<Record<SiegeWeaponId, WeaponEvolutionState>>;
  onEscape?: () => boolean;
  pauseTimer?: boolean;
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
  const [manuallyPaused, setManuallyPaused] = useState(false);
  const [runtimeSnapshot, setRuntimeSnapshot] = useState<SiegeRuntimeSnapshot>(
    () => createRuntimeSnapshot(),
  );
  const [survivalStatus, setSurvivalStatus] = useState<SurvivalRuntimeStatus>(() => {
    const plan = getSurvivalWavePlan(1);
    return createSurvivalRuntimeStatus(plan);
  });
  const [survivalSpawnPlan, setSurvivalSpawnPlan] = useState<
    (SurvivalSpawnPlan & { sequenceId: number }) | null
  >(null);
  const phaseTimerRef = useRef<number | null>(null);
  const snapshotFrameRef = useRef<number | null>(null);
  const survivalSpawnTimerRef = useRef<number | null>(null);
  const survivalWaveEndsAtRef = useRef<number | null>(null);
  const lastKillAtRef = useRef<number | null>(null);
  const interactiveBaseElapsedMsRef = useRef(0);
  const interactiveRunningSinceRef = useRef<number | null>(null);
  const runtimeSnapshotRef = useRef<SiegeRuntimeSnapshot>(runtimeSnapshot);
  const interactiveSessionKeyRef = useRef<string | null>(interactiveSessionKey);
  const survivalStatusRef = useRef(survivalStatus);
  const survivalRemainingBudgetRef = useRef(0);
  const survivalSpawnAccumulatorRef = useRef(0);
  const survivalLastSpawnTickAtRef = useRef<number | null>(null);
  const survivalSpawnSequenceRef = useRef(0);
  const interactiveSessionSequenceRef = useRef(0);
  const gamePausedRef = useRef(false);

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
    survivalSpawnAccumulatorRef.current = 0;
    survivalLastSpawnTickAtRef.current = null;
    survivalSpawnSequenceRef.current += 1;
    setSurvivalSpawnPlan(null);
    setSurvivalStatus(createSurvivalRuntimeStatus(plan));
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
    },
    [],
  );

  const startSurvivalWave = useCallback(
    (wave: number) => {
      const plan = getSurvivalWavePlan(wave);
      const now = performance.now();

      survivalRemainingBudgetRef.current = plan.spawnBudget;
      survivalSpawnAccumulatorRef.current = 0;
      survivalLastSpawnTickAtRef.current = now;
      setSurvivalStatus((current) => ({
        ...createSurvivalRuntimeStatus(plan, {
          liveBugCounts: current.liveBugCounts,
          metricValues: {
            errors: current.metrics.errors.value,
            speed: current.metrics.speed.value,
            uptime: current.metrics.uptime.value,
          },
          now,
          remainingSpawnBudget: survivalRemainingBudgetRef.current,
          siteIntegrity: current.siteIntegrity,
        }),
        failureKind: null,
        failureLabel: null,
        failureSummary: null,
        offlineReason: null,
      }));
      survivalWaveEndsAtRef.current = now + plan.waveDurationMs;
    },
    [],
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
    interactiveMode &&
    siegePhase === "entering" &&
    interactiveKills === 0 &&
    runtimeRemainingBugs === 0
      ? sessionBugCount
      : runtimeRemainingBugs;

  const { completionSummary, finalizeRun, leaderboard, resetCompletion } =
    useSiegeRunCompletion({
      evolutionStates,
      failureKind: survivalStatus.failureKind,
      failureLabel: survivalStatus.failureLabel,
      failureSummary: survivalStatus.failureSummary,
      gameMode,
      getRuntimeSnapshot: () => runtimeSnapshotRef.current,
      interactiveKills,
      interactiveMode,
      interactiveRemainingBugs: effectiveInteractiveRemainingBugs,
      interactiveBaseElapsedMsRef,
      interactiveRunningSinceRef,
      offlineReason: survivalStatus.offlineReason,
      selectedWeaponId,
      siegePhase,
      siteOffline: gameMode === "outbreak" && survivalStatus.failureKind != null,
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
    pauseTimer: pauseTimer || manuallyPaused,
    resetInactiveRuntime,
    updateRuntimeSnapshot,
  });

  useEffect(() => {
    gamePausedRef.current = pauseTimer || manuallyPaused || completionSummary != null;
  }, [pauseTimer, manuallyPaused, completionSummary]);

  const onClearComplete = useCallback(() => {
    if (interactiveMode && siegePhase === "active" && gameMode === "purge") {
      finalizeRun({ interactiveRemainingBugs: 0 });
    }
  }, [finalizeRun, gameMode, interactiveMode, siegePhase]);

  const onEndSurvival = useCallback(() => {
    if (interactiveMode && siegePhase === "active" && gameMode === "outbreak") {
      setSurvivalStatus((current) => ({
        ...current,
        failureKind: "uptimeFailure",
        failureLabel: "Uptime",
        failureSummary: "Too many bugs broke through and took the platform down.",
        metrics: {
          ...current.metrics,
          uptime: {
            ...current.metrics.uptime,
            secondsToFail: 0,
            status: "critical",
            value: 0,
          },
        },
        offlineReason: "Too many bugs broke through and took the platform down.",
        secondsUntilOffline: 0,
        siteIntegrity: 0,
      }));
      finalizeRun({ siteOffline: true });
    }
  }, [finalizeRun, gameMode, interactiveMode, siegePhase]);

  const advanceSurvivalPressure = useCallback(
    (tickSeconds: number, now = performance.now()) => {
      const currentStatus = survivalStatusRef.current;
      const plan = getSurvivalWavePlan(currentStatus.wave);
      const waveEndsAt = survivalWaveEndsAtRef.current;
      const secondsUntilNextWave =
        waveEndsAt != null
          ? Math.max(0, Math.ceil((waveEndsAt - now) / 1000))
          : null;
      const pressure = getSurvivalPressure({
        activeBugCount: runtimeSnapshotRef.current.remainingBugs,
        activeBugCounts: currentStatus.liveBugCounts,
        metricValues: {
          errors: currentStatus.metrics.errors.value,
          speed: currentStatus.metrics.speed.value,
          uptime: currentStatus.metrics.uptime.value,
        },
        siteIntegrity: currentStatus.siteIntegrity,
        tickSeconds,
        wave: currentStatus.wave,
      });

      recordSurvivalPressureQaSnapshot({
        activeBugCount: runtimeSnapshotRef.current.remainingBugs,
        errors: pressure.metrics.errors.value,
        pressurePercent: pressure.pressurePercent,
        speed: pressure.metrics.speed.value,
        tickedAt: now,
        uptime: pressure.metrics.uptime.value,
        wave: currentStatus.wave,
      });

      const failure = pressure.failure;
      const offlineReason = failure?.summary ?? null;

      setSurvivalStatus((current) => {
        const startedAtFallback =
          current.waveStartedAt == null && waveEndsAt != null
            ? Math.max(0, waveEndsAt - plan.waveDurationMs)
            : current.waveStartedAt;

        return {
          ...current,
          activeBugLimit: plan.activeBugLimit,
          failureKind: failure?.kind ?? null,
          failureLabel: failure?.label ?? null,
          failureSummary: failure?.summary ?? null,
          liveBugCounts: normalizeBugCountsForSurvival(
            runtimeSnapshotRef.current.remainingBugs,
            current.liveBugCounts,
            current.wave,
          ),
          metrics: pressure.metrics,
          offlineReason,
          pressurePercent: pressure.pressurePercent,
          remainingSpawnBudget: survivalRemainingBudgetRef.current,
          secondsUntilNextWave,
          secondsUntilOffline: pressure.secondsUntilOffline,
          siteIntegrity: pressure.metrics.uptime.value,
          spawnRatePerSecond: plan.spawnRatePerSecond,
          waveDurationMs: plan.waveDurationMs,
          waveEndsAt,
          waveProgressPercent: calculateWaveProgress(
            now,
            startedAtFallback,
            plan.waveDurationMs,
          ),
          variantWeights: plan.variantWeights,
        };
      });

      if (failure) {
        updateRuntimeSnapshot(
          (current) => ({
            ...current,
            remainingBugs: 0,
          }),
          true,
        );
        finalizeRun({ siteOffline: true });
      }
    },
    [finalizeRun, updateRuntimeSnapshot],
  );

  const { clearSwarmRequestId, debugMode, killAllBugs, toggleDebugMode, triggerSurvivalOverrun } = useSiegeGameDebug({
    interactiveInitialBugCounts,
    interactiveMode,
    lastKillAtRef,
    onClearComplete,
    onEndSurvival,
    updateRuntimeSnapshot,
  });

  const enterInteractiveMode = useCallback((
    nextMode: SiegeGameMode = gameMode,
    options?: { baseBugCounts?: BugCounts; bugMultiplier?: number },
  ) => {
    const survivalPlan = getSurvivalWavePlan(1);
    const baseBugCounts = options?.baseBugCounts ?? currentBugCounts;
    const bugMultiplier = Math.max(1, options?.bugMultiplier ?? 1);
    const scaledBugCounts = scaleBugCounts(baseBugCounts, bugMultiplier);
    const totalBugCount = getBugCountTotal(scaledBugCounts);
    const startedAt = Date.now();
    interactiveSessionSequenceRef.current += 1;
    const nextSessionKey = `${Date.now()}-${interactiveSessionSequenceRef.current}`;
    cancelTimeout(phaseTimerRef.current);
    setGameMode(nextMode);
    setInteractiveInitialBugCounts(scaledBugCounts);
    setInteractiveStartedAt(startedAt);
    interactiveRunningSinceRef.current = startedAt;
    interactiveBaseElapsedMsRef.current = 0;
    interactiveSessionKeyRef.current = nextSessionKey;
    setInteractiveSessionKey(nextSessionKey);
    runtimeSnapshotRef.current = createRuntimeSnapshot(totalBugCount);
    flushRuntimeSnapshot(true);
    lastKillAtRef.current = null;
    resetCompletion();
    setManuallyPaused(false);
    setSelectedWeaponId("hammer");
    if (nextMode === "outbreak") {
      survivalRemainingBudgetRef.current = survivalPlan.spawnBudget;
      survivalSpawnAccumulatorRef.current = 0;
      survivalLastSpawnTickAtRef.current = performance.now();
      setSurvivalSpawnPlan(null);
      const now = performance.now();
      setInteractiveInitialBugCounts(createEmptyBugCounts());
      runtimeSnapshotRef.current = createRuntimeSnapshot(0);
      flushRuntimeSnapshot(true);
      setSurvivalStatus(createSurvivalRuntimeStatus(survivalPlan, {
        liveBugCounts: createEmptyBugCounts(),
        metricValues: createInitialSurvivalMetricValues(),
        now,
        remainingSpawnBudget: survivalRemainingBudgetRef.current,
      }));
      survivalWaveEndsAtRef.current = now + survivalPlan.waveDurationMs;
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
    setManuallyPaused(false);
    setSiegePhase("exiting");
    phaseTimerRef.current = scheduleTimeout(() => {
      phaseTimerRef.current = null;
      setInteractiveStartedAt(null);
      interactiveSessionKeyRef.current = null;
      setInteractiveSessionKey(null);
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
      const shouldFinalizeTimeAttack =
        gameMode === "purge" &&
        siegePhase === "active" &&
        runtimeSnapshotRef.current.remainingBugs <= 1;
      lastKillAtRef.current = now;

      const earned = payload.pointValue ?? 1;
      const frozenBonus = payload.frozen ? 1 : 0;
      updateRuntimeSnapshot(
        (current) => ({
          ...current,
          killStreak: nextStreak,
          kills: current.kills + 1,
          points: current.points + earned + frozenBonus,
          remainingBugs: shouldFinalizeTimeAttack
            ? 0
            : current.remainingBugs,
          streakMultiplier:
            nextStreak >= 10 ? 2 : nextStreak >= 5 ? 1.5 : nextStreak >= 3 ? 1.2 : 1,
        }),
        true,
      );

      if (shouldFinalizeTimeAttack) {
        finalizeRun({ interactiveRemainingBugs: 0 });
      }
    },
    [finalizeRun, gameMode, siegePhase, updateRuntimeSnapshot],
  );

  useEffect(() => {
    if (!interactiveMode || siegePhase !== "active" || completionSummary != null) {
      return;
    }

    if (gameMode === "purge" && runtimeRemainingBugs === 0) {
      finalizeRun({ interactiveRemainingBugs: 0 });
      return;
    }

    if (gameMode === "outbreak" && survivalStatus.failureKind != null) {
      finalizeRun({ siteOffline: true });
    }
  }, [
    completionSummary,
    finalizeRun,
    gameMode,
    interactiveMode,
    runtimeRemainingBugs,
    siegePhase,
    survivalStatus.failureKind,
  ]);

  useEffect(() => {
    return () => {
      cancelTimeout(phaseTimerRef.current);
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
    interactiveSessionKeyRef.current = interactiveSessionKey;
  }, [interactiveSessionKey]);

  useEffect(() => {
    if (
      !interactiveMode ||
      siegePhase !== "active" ||
      gameMode !== "outbreak" ||
      survivalStatus.failureKind != null ||
      completionSummary != null
    ) {
      return undefined;
    }

    survivalSpawnTimerRef.current = scheduleTimeout(function tickSpawn() {
      if (gamePausedRef.current) {
        survivalSpawnTimerRef.current = scheduleTimeout(tickSpawn, 250);
        return;
      }
      const status = survivalStatusRef.current;
      const plan = getSurvivalWavePlan(status.wave);
      const activeBugs = runtimeSnapshotRef.current.remainingBugs;
      const remainingBudget = survivalRemainingBudgetRef.current;
      const waveEndsAt = survivalWaveEndsAtRef.current;
      const now = performance.now();
      const waveExpired = waveEndsAt != null && now >= waveEndsAt;

      // Ensure waves advance even if the pressure timer wasn't active for
      // some reason (keeps survival rolling while bugs remain).
      if (waveExpired) {
        startSurvivalWave(status.wave + 1);
        survivalSpawnTimerRef.current = scheduleTimeout(
          tickSpawn,
          SURVIVAL_SPAWN_TICK_MS,
        );
        return;
      }

      if (!waveExpired && remainingBudget > 0 && activeBugs < plan.activeBugLimit) {
        const lastSpawnTickAt = survivalLastSpawnTickAtRef.current ?? now;
        const spawnRequest = calculateSurvivalSpawnRequest({
          accumulator: survivalSpawnAccumulatorRef.current,
          activeBugCount: activeBugs,
          activeBugLimit: plan.activeBugLimit,
          elapsedSeconds: Math.max(0, (now - lastSpawnTickAt) / 1000),
          remainingBudget,
          spawnRatePerSecond: plan.spawnRatePerSecond,
        });
        const requestedCount = spawnRequest.requestedCount;
        survivalSpawnAccumulatorRef.current = spawnRequest.nextAccumulator;
        survivalLastSpawnTickAtRef.current = now;

        if (requestedCount > 0) {
          survivalRemainingBudgetRef.current = Math.max(
            0,
            remainingBudget - requestedCount,
          );
          queueSurvivalSpawn(plan, requestedCount);
          setSurvivalStatus((current) => ({
            ...current,
            remainingSpawnBudget: survivalRemainingBudgetRef.current,
          }));
        }
      } else {
        survivalLastSpawnTickAtRef.current = now;
      }

      advanceSurvivalPressure(SURVIVAL_SPAWN_TICK_MS / 1000, now);

      survivalSpawnTimerRef.current = scheduleTimeout(
        tickSpawn,
        SURVIVAL_SPAWN_TICK_MS,
      );
    }, SURVIVAL_SPAWN_TICK_MS);

    return () => {
      cancelTimeout(survivalSpawnTimerRef.current);
      survivalSpawnTimerRef.current = null;
    };
  }, [advanceSurvivalPressure, completionSummary, gameMode, interactiveMode, queueSurvivalSpawn, siegePhase, startSurvivalWave, survivalStatus.failureKind]);

  useEffect(() => {
    if (
      !interactiveMode ||
      siegePhase !== "active" ||
      gameMode !== "outbreak" ||
      survivalStatus.failureKind != null ||
      runtimeRemainingBugs > 0 ||
      survivalRemainingBudgetRef.current > 0
    ) {
      return;
    }

    startSurvivalWave(survivalStatus.wave + 1);
  }, [gameMode, interactiveMode, runtimeRemainingBugs, siegePhase, startSurvivalWave, survivalStatus.failureKind, survivalStatus.wave]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const qaState = (window as Window & {
      __RTZ_QA__?: {
        enabled?: boolean;
        setSurvivalState?: (state: {
          completeWave?: boolean;
          errors?: number;
          failMetric?: "errors" | "speed" | "uptime";
          siteIntegrity?: number;
          spawnNow?: boolean;
          speed?: number;
          uptime?: number;
          wave?: number;
        }) => void;
      };
    }).__RTZ_QA__;
    if (!qaState?.enabled) {
      return undefined;
    }

    qaState.setSurvivalState = ({
      completeWave = false,
      errors,
      failMetric,
      siteIntegrity,
      spawnNow = false,
      speed,
      uptime,
      wave,
    }) => {
      if (wave != null) {
        startSurvivalWave(wave);

        if (spawnNow) {
          const plan = getSurvivalWavePlan(wave);
          const requestedCount = Math.min(
            survivalRemainingBudgetRef.current,
            Math.max(1, Math.round(plan.spawnRatePerSecond)),
          );

          if (requestedCount > 0) {
            survivalRemainingBudgetRef.current = Math.max(
              0,
              survivalRemainingBudgetRef.current - requestedCount,
            );
            queueSurvivalSpawn(plan, requestedCount);
            setSurvivalStatus((current) => ({
              ...current,
              remainingSpawnBudget: survivalRemainingBudgetRef.current,
            }));
          }
        }
      }

      if (completeWave) {
        startSurvivalWave(survivalStatusRef.current.wave + 1);
      }

      if (siteIntegrity != null) {
        setSurvivalStatus((current) => applySiteIntegrityOverride(current, siteIntegrity));
        if (siteIntegrity <= 0) {
          updateRuntimeSnapshot((current) => ({ ...current, remainingBugs: 0 }), true);
          finalizeRun({ siteOffline: true });
        }
      }

      if (uptime != null || errors != null || speed != null || failMetric != null) {
        setSurvivalStatus((current) =>
          applySurvivalMetricOverrides(current, {
            errors,
            failMetric,
            speed,
            uptime,
          }),
        );

        if (
          failMetric != null ||
          (uptime != null && uptime <= 0) ||
          (errors != null && errors <= 0) ||
          (speed != null && speed <= 0)
        ) {
          updateRuntimeSnapshot((current) => ({ ...current, remainingBugs: 0 }), true);
          finalizeRun({ siteOffline: true });
        }
      }
    };

    return () => {
      if (qaState.setSurvivalState) {
        delete qaState.setSurvivalState;
      }
    };
  }, [finalizeRun, queueSurvivalSpawn, startSurvivalWave, updateRuntimeSnapshot]);

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
    if (nextMode === gameMode) {
      return;
    }

    if (interactiveMode) {
      enterInteractiveMode(nextMode);
      return;
    }

    setGameMode(nextMode);
  }, [enterInteractiveMode, gameMode, interactiveMode]);

  const handleWeaponFired = useCallback((id: SiegeWeaponId, firedAt: number) => {
    updateRuntimeSnapshot((current) => ({
      ...current,
      lastFireTimes: {
        ...current.lastFireTimes,
        [id]: firedAt,
      },
    }));
  }, [updateRuntimeSnapshot]);

  const syncBugState = useCallback(
    (
      count: number,
      bugCounts: BugCounts,
      sourceSessionKey?: string | null,
    ) => {
      if (shouldIgnoreBugSync(sourceSessionKey, interactiveSessionKeyRef.current)) {
        return;
      }

      const normalizedCount = normalizeSyncedBugCount(count);
      const shouldForceFlush = shouldForceBugSyncFlush(
        runtimeSnapshotRef.current.remainingBugs,
        normalizedCount,
      );

      updateRuntimeSnapshot(
        (current) => updateRuntimeSnapshotRemainingBugs(current, normalizedCount),
        shouldForceFlush,
      );

      if (gameMode === "outbreak") {
        setSurvivalStatus((current) =>
          updateSurvivalStatusLiveBugCounts(current, normalizedCount, bugCounts),
        );
      }

      if (
        shouldFinalizePurgeFromBugSync({
          gameMode,
          interactiveMode,
          normalizedCount,
          siegePhase,
        })
      ) {
        finalizeRun({ interactiveRemainingBugs: 0 });
      }
    },
    [finalizeRun, gameMode, interactiveMode, siegePhase, updateRuntimeSnapshot],
  );

  const syncRemainingBugs = useCallback(
    (count: number, sourceSessionKey?: string | null) => {
      syncBugState(
        count,
        survivalStatusRef.current.liveBugCounts,
        sourceSessionKey,
      );
    },
    [syncBugState],
  );

  const syncLiveBugState = useCallback(
    (count: number, bugCounts: BugCounts, sourceSessionKey?: string | null) => {
      syncBugState(count, bugCounts, sourceSessionKey);
    },
    [syncBugState],
  );

  const togglePause = useCallback(() => {
    if (!interactiveMode || siegePhase !== "active" || gameMode !== "outbreak") {
      return;
    }

    setManuallyPaused((current) => !current);
  }, [gameMode, interactiveMode, siegePhase]);

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
    isFocusPaused: pauseTimer,
    isManuallyPaused: manuallyPaused,
    isPaused: pauseTimer || manuallyPaused,
    selectedWeaponId,
    selectWeapon,
    setInteractiveMode: (v: boolean) =>
      v ? enterInteractiveMode() : exitInteractiveMode(),
    siegePhase,
    syncLiveBugState,
    syncRemainingBugs,
    streakMultiplier,
    survivalSpawnPlan,
    survivalStatus: {
      ...survivalStatus,
      runtimeSpeedMultiplier: getSurvivalRuntimeSpeedMultiplierForPressure(
        survivalStatus.wave,
        survivalStatus.pressurePercent,
      ),
    },
    toggleDebugMode,
    togglePause,
    triggerSurvivalOverrun,
    weaponSnapshots,
  };
}

