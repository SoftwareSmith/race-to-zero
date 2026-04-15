import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { BugCounts } from "../../../types/dashboard";
import {
  getSiegeCombatStats,
  getNextWeaponUnlock,
  getSiegeWeaponSnapshots,
} from "@game/progression/progression";
import { WEAPON_DEFS } from "@config/weaponConfig";
import { STRUCTURE_DEFS, STRUCTURE_TIER_THRESHOLDS } from "@config/structureConfig";
import { useSiegeGameDebug } from "./useSiegeGameDebug";
import { useSiegeGameTimer } from "./useSiegeGameTimer";
import { useSiegeRunCompletion } from "./useSiegeRunCompletion";
import type {
  AgentCaptureState,
  PlacedStructure,
  SiegeGameMode,
  SiegePhase,
  SiegeWeaponId,
  StructureId,
  WeaponTier,
  WeaponEvolutionState,
} from "@game/types";
import { WeaponTier as Tier } from "@game/types";

const LANTERN_SUPPORT_XP_INTERVAL_MS = 4500;
const STRUCTURE_KILL_XP = 2;
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

function scheduleInterval(callback: () => void, delay: number): number {
  if (typeof window !== "undefined") {
    return window.setInterval(callback, delay);
  }

  return globalThis.setInterval(callback, delay) as unknown as number;
}

function cancelInterval(intervalId: number): void {
  globalThis.clearInterval(intervalId);
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

function getNextStructureTierXp(
  structureType: StructureId,
  tier: WeaponTier,
): number | null {
  const thresholds = STRUCTURE_TIER_THRESHOLDS[structureType];
  if (tier === Tier.TIER_ONE) {
    return thresholds[0];
  }

  if (tier === Tier.TIER_TWO) {
    return thresholds[1];
  }

  return null;
}

function getStructureTierForXp(
  structureType: StructureId,
  xp: number,
): WeaponTier {
  const [tierTwoThreshold, tierThreeThreshold] = STRUCTURE_TIER_THRESHOLDS[structureType];
  if (xp >= tierThreeThreshold) {
    return Tier.TIER_THREE;
  }

  if (xp >= tierTwoThreshold) {
    return Tier.TIER_TWO;
  }

  return Tier.TIER_ONE;
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

function applyStructureXp(
  structure: PlacedStructure,
  xpGain: number,
  killGain = 0,
): PlacedStructure {
  const xp = structure.xp + xpGain;
  const tier = getStructureTierForXp(structure.structureType, xp);
  return {
    ...structure,
    xp,
    kills: structure.kills + killGain,
    tier,
    nextTierXp: getNextStructureTierXp(structure.structureType, tier),
  };
}

interface UseSiegeGameOptions {
  currentBugCount: number;
  currentBugCounts: BugCounts;
  evolutionStates?: Partial<Record<SiegeWeaponId, WeaponEvolutionState>>;
  onStructureTierUp?: (payload: {
    structureId: string;
    structureType: StructureId;
    tier: WeaponTier;
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
  const [placingStructureId, setPlacingStructureId] = useState<StructureId | null>(null);
  const [placedStructures, setPlacedStructures] = useState<PlacedStructure[]>([]);
  const [agentCaptures, setAgentCaptures] = useState<Record<string, AgentCaptureState>>({});
  const [runtimeSnapshot, setRuntimeSnapshot] = useState<SiegeRuntimeSnapshot>(
    () => createRuntimeSnapshot(),
  );
  const phaseTimerRef = useRef<number | null>(null);
  const snapshotFrameRef = useRef<number | null>(null);
  const lastKillAtRef = useRef<number | null>(null);
  const previousStructureTiersRef = useRef<Record<string, WeaponTier>>({});
  const placingStructureIdRef = useRef<StructureId | null>(null);
  const interactiveBaseElapsedMsRef = useRef(0);
  const interactiveRunningSinceRef = useRef<number | null>(null);
  const runtimeSnapshotRef = useRef<SiegeRuntimeSnapshot>(runtimeSnapshot);

  useEffect(() => {
    placingStructureIdRef.current = placingStructureId;
  }, [placingStructureId]);

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
    remainingBugs: interactiveRemainingBugs,
    streakMultiplier,
  } = runtimeSnapshot;

  const { completionSummary, leaderboard, resetCompletion } =
    useSiegeRunCompletion({
      evolutionStates,
      gameMode,
      interactiveKills,
      interactiveMode,
      interactiveRemainingBugs,
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
    setPlacedStructures([]);
    setPlacingStructureId(null);
    setAgentCaptures({});
    setSiegePhase("entering");
    phaseTimerRef.current = scheduleTimeout(() => {
      phaseTimerRef.current = null;
      setSiegePhase("active");
    }, SIEGE_ENTER_DURATION_MS);
  }, [currentBugCounts, flushRuntimeSnapshot, gameMode, resetCompletion]);

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

  const selectWeapon = useCallback(
    (id: SiegeWeaponId) => {
      if (siegePhase === "idle") return;
      const stats = getSiegeCombatStats(runtimeSnapshotRef.current.kills, debugMode);
      if (!stats.unlockedWeapons.includes(id)) return;
      setPlacingStructureId(null);
      setSelectedWeaponId(id);
    },
    [debugMode, siegePhase],
  );

  const armStructure = useCallback((id: StructureId) => {
    setPlacingStructureId((prev) => (prev === id ? null : id));
  }, []);

  const cancelStructurePlacement = useCallback(() => {
    setPlacingStructureId(null);
  }, []);

  const placeStructure = useCallback(
    (
      structureType: StructureId,
      viewportX: number,
      viewportY: number,
      canvasX: number,
      canvasY: number,
      structureId?: string,
    ) => {
      const def = STRUCTURE_DEFS.find((entry) => entry.id === structureType);
      const maxPlaced = def?.maxPlaced ?? 2;
      setPlacedStructures((prev) => {
        const ofType = prev.filter((s) => s.structureType === structureType);
        const filtered = ofType.length >= maxPlaced
          ? prev.filter((s) => s.structureType !== structureType || s !== ofType[0])
          : prev;
        return [
          ...filtered,
          {
            id:
              structureId ??
              `${structureType}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            structureType,
            tier: Tier.TIER_ONE,
            xp: 0,
            nextTierXp: getNextStructureTierXp(structureType, Tier.TIER_ONE),
            kills: 0,
            x: viewportX,
            y: viewportY,
            canvasX,
            canvasY,
            placedAt: Date.now(),
          },
        ];
      });
      setPlacingStructureId(null);
    },
    [],
  );

  const handleInteractiveHit = useCallback(
    (payload: { defeated: boolean; pointValue?: number; frozen?: boolean }) => {
      if (!payload.defeated) {
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

  const handleStructureKill = useCallback((structureId: string) => {
    setPlacedStructures((prev) =>
      prev.map((structure) =>
        structure.id === structureId
          ? applyStructureXp(structure, STRUCTURE_KILL_XP, 1)
          : structure,
      ),
    );
  }, []);

  useEffect(() => {
    const nextTiers: Record<string, WeaponTier> = {};

    for (const structure of placedStructures) {
      nextTiers[structure.id] = structure.tier;
      const previousTier = previousStructureTiersRef.current[structure.id];
      if (previousTier != null && structure.tier > previousTier) {
        onStructureTierUp?.({
          structureId: structure.id,
          structureType: structure.structureType,
          tier: structure.tier,
        });
      }
    }

    previousStructureTiersRef.current = nextTiers;
  }, [onStructureTierUp, placedStructures]);

  useEffect(() => {
    if (!interactiveMode) {
      return undefined;
    }

    const intervalId = scheduleInterval(() => {
      setPlacedStructures((prev) =>
        prev.map((structure) =>
          structure.structureType === "lantern"
            ? applyStructureXp(structure, 1)
            : structure,
        ),
      );
    }, LANTERN_SUPPORT_XP_INTERVAL_MS);

    return () => {
      cancelInterval(intervalId);
    };
  }, [interactiveMode]);

  useEffect(() => {
    document.body.classList.toggle("interactive-mode", interactiveMode);

    if (interactiveMode) {
      const previousTabIndex = document.body.getAttribute("tabindex");
      document.body.tabIndex = -1;
      document.body.focus({ preventScroll: true });

      return () => {
        document.body.classList.remove("interactive-mode");
        if (previousTabIndex == null) {
          document.body.removeAttribute("tabindex");
        } else {
          document.body.setAttribute("tabindex", previousTabIndex);
        }
      };
    }

    return () => {
      document.body.classList.remove("interactive-mode");
    };
  }, [interactiveMode]);

  useEffect(() => {
    if (!interactiveMode) {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        if (placingStructureIdRef.current !== null) {
          setPlacingStructureId(null);
          return;
        }

        exitInteractiveMode();
        return;
      }

      const digit = event.key.match(/^[0-9]$/)?.[0];
      if (!digit) return;
      const slotIndex = digit === "0" ? 9 : parseInt(digit, 10) - 1;
      const stats = getSiegeCombatStats(runtimeSnapshotRef.current.kills, debugMode);
      const weaponAtSlot = WEAPON_DEFS[slotIndex];
      if (weaponAtSlot && stats.unlockedWeapons.includes(weaponAtSlot.id)) {
        setSelectedWeaponId(weaponAtSlot.id);
      }
    };

    document.addEventListener("keydown", handleKeyDown, true);
    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [debugMode, exitInteractiveMode, interactiveMode]);

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

  // Placed count per structure type for HUD display
  const placedCountByType = useMemo(() => {
    const counts: Partial<Record<StructureId, number>> = {};
    for (const def of STRUCTURE_DEFS) {
      counts[def.id] = placedStructures.filter((s) => s.structureType === def.id).length;
    }
    return counts as Record<StructureId, number>;
  }, [placedStructures]);

  const handleWeaponFired = useCallback((id: SiegeWeaponId, firedAt: number) => {
    updateRuntimeSnapshot((current) => ({
      ...current,
      lastFireTimes: {
        ...current.lastFireTimes,
        [id]: firedAt,
      },
    }));
  }, [updateRuntimeSnapshot]);

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
    interactiveRemainingBugs,
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
    streakMultiplier,
    toggleDebugMode,
    weaponSnapshots,
  };
}

