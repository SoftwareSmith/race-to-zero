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
import { useSiegeGameStructures } from "./useSiegeGameStructures";
import { useSiegeGameTimer } from "./useSiegeGameTimer";
import { useSiegeRunCompletion } from "./useSiegeRunCompletion";
import type {
  AgentCaptureState,
  SiegeGameMode,
  SiegePhase,
  SiegeWeaponId,
  WeaponEvolutionState,
} from "@game/types";

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
  onStructureTierUp?: (payload: {
    structureId: string;
    structureType: import("@game/types").StructureId;
    tier: import("@game/types").WeaponTier;
  }) => void;
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

export function useSiegeGame({
  currentBugCount: _currentBugCount,
  currentBugCounts,
  evolutionStates,
  onStructureTierUp,
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
  const [agentCaptures, setAgentCaptures] = useState<Record<string, AgentCaptureState>>({});
  const [runtimeSnapshot, setRuntimeSnapshot] = useState<SiegeRuntimeSnapshot>(
    () => createRuntimeSnapshot(),
  );
  const phaseTimerRef = useRef<number | null>(null);
  const snapshotFrameRef = useRef<number | null>(null);
  const lastKillAtRef = useRef<number | null>(null);
  const interactiveBaseElapsedMsRef = useRef(0);
  const interactiveRunningSinceRef = useRef<number | null>(null);
  const runtimeSnapshotRef = useRef<SiegeRuntimeSnapshot>(runtimeSnapshot);

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
      selectedWeaponId,
      siegePhase,
      updateRuntimeSnapshot,
    });

  const resetInactiveRuntime = useCallback(() => {
    interactiveBaseElapsedMsRef.current = 0;
    interactiveRunningSinceRef.current = null;
    runtimeSnapshotRef.current = createRuntimeSnapshot();
    flushRuntimeSnapshot(true);
  }, [flushRuntimeSnapshot]);

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

  const { debugMode, killAllBugs, toggleDebugMode } = useSiegeGameDebug({
    interactiveInitialBugCounts,
    interactiveMode,
    lastKillAtRef,
    updateRuntimeSnapshot,
  });

  const {
    armStructure,
    cancelStructurePlacement,
    handleStructureKill,
    placeStructure,
    placedCountByType,
    placedStructures,
    placingStructureId,
    placingStructureIdRef,
    resetStructures,
  } = useSiegeGameStructures({
    interactiveMode,
    onStructureTierUp,
  });

  const enterInteractiveMode = useCallback((
    nextMode: SiegeGameMode = gameMode,
    options?: { baseBugCounts?: BugCounts; bugMultiplier?: number },
  ) => {
    const baseBugCounts = options?.baseBugCounts ?? currentBugCounts;
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
    resetStructures();
    setAgentCaptures({});
    setSiegePhase("entering");
    phaseTimerRef.current = scheduleTimeout(() => {
      phaseTimerRef.current = null;
      setSiegePhase("active");
    }, SIEGE_ENTER_DURATION_MS);
  }, [currentBugCounts, flushRuntimeSnapshot, gameMode, resetCompletion, resetStructures]);

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
    if (placingStructureIdRef.current !== null) {
      cancelStructurePlacement();
      return;
    }

    exitInteractiveMode();
  }, [cancelStructurePlacement, exitInteractiveMode, placingStructureIdRef]);

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
      cancelStructurePlacement();
      setSelectedWeaponId(id);
    },
    [cancelStructurePlacement, debugMode, siegePhase],
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

  const handleAgentAbsorb = useCallback(
    (data: {
      structureId: string;
      phase: "absorbing" | "done" | "failed" | "pulling";
      variant: string;
      bugX: number;
      bugY: number;
      srcX?: number;
      srcY?: number;
      processingMs?: number;
    }) => {
      const { phase } = data;
      if (phase !== "pulling") {
        setAgentCaptures((prev) => ({
          ...prev,
          [data.structureId]: {
            structureId: data.structureId,
            phase,
            startedAt: Date.now(),
            processingMs: data.processingMs ?? 1500,
            variant: data.variant,
            bugX: data.bugX,
            bugY: data.bugY,
          },
        }));
      }
      if (phase === "done" || phase === "failed") {
        scheduleTimeout(() => {
          setAgentCaptures((prev) => {
            const next = { ...prev };
            delete next[data.structureId];
            return next;
          });
        }, 1200);
      }
    },
    [],
  );

  useEffect(() => {
    return () => {
      cancelTimeout(phaseTimerRef.current);
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

  const displayedBugCounts = interactiveMode
    ? interactiveInitialBugCounts
    : currentBugCounts;
  const combatStats = useMemo(
    () => getSiegeCombatStats(interactiveKills, debugMode),
    [debugMode, interactiveKills],
  );
  const weaponSnapshots = useMemo(
    () =>
      getSiegeWeaponSnapshots(
        interactiveKills,
        selectedWeaponId,
        debugMode,
        evolutionStates,
      ),
    [debugMode, evolutionStates, interactiveKills, selectedWeaponId],
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
      updateRuntimeSnapshot((current) => {
        if (current.remainingBugs === normalizedCount) {
          return current;
        }

        return {
          ...current,
          remainingBugs: normalizedCount,
        };
      });
    },
    [updateRuntimeSnapshot],
  );

  return {
    agentCaptures,
    armStructure,
    cancelStructurePlacement,
    combatStats,
    changeGameMode,
    displayedBugCounts,
    debugMode,
    enterInteractiveMode,
    exitInteractiveMode,
    gameMode,
    handleAgentAbsorb,
    handleInteractiveHit,
    handleStructureKill,
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
    nextWeaponUnlock,
    placedCountByType,
    placedStructures,
    placingStructureId,
    placeStructure,
    completionSummary,
    selectedWeaponId,
    selectWeapon,
    setInteractiveMode: (v: boolean) =>
      v ? enterInteractiveMode() : exitInteractiveMode(),
    siegePhase,
    syncRemainingBugs,
    streakMultiplier,
    toggleDebugMode,
    weaponSnapshots,
  };
}

