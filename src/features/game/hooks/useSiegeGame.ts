import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { BugCounts } from "../../../types/dashboard";
import {
  getSiegeCombatStats,
  getSiegeWeaponSnapshots,
} from "@game/progression/progression";
import { WEAPON_DEFS } from "@config/weaponConfig";
import { STRUCTURE_DEFS } from "@config/structureConfig";
import type { AgentCaptureState, PlacedStructure, SiegePhase, SiegeWeaponId, StructureId } from "@game/types";

interface UseSiegeGameOptions {
  currentBugCount: number;
  currentBugCounts: BugCounts;
}

export function useSiegeGame({
  currentBugCount,
  currentBugCounts,
}: UseSiegeGameOptions) {
  const [debugMode, setDebugMode] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }

    const params = new URLSearchParams(window.location.search);
    if (params.get("siegeDebug") === "1") {
      return true;
    }

    return window.localStorage.getItem("rtz-siege-debug") === "1";
  });
  const [siegePhase, setSiegePhase] = useState<SiegePhase>("idle");
  const [interactiveInitialBugCounts, setInteractiveInitialBugCounts] =
    useState<BugCounts>(currentBugCounts);
  const [interactiveKills, setInteractiveKills] = useState(0);
  const [interactivePoints, setInteractivePoints] = useState(0);
  const [interactiveRemainingBugs, setInteractiveRemainingBugs] = useState(0);
  const [interactiveSessionKey, setInteractiveSessionKey] = useState<
    string | null
  >(null);
  const [selectedWeaponId, setSelectedWeaponId] =
    useState<SiegeWeaponId>("wrench");
  const [placingStructureId, setPlacingStructureId] = useState<StructureId | null>(null);
  const [placedStructures, setPlacedStructures] = useState<PlacedStructure[]>([]);
  const [agentCaptures, setAgentCaptures] = useState<Record<string, AgentCaptureState>>({});
  const [lastFireTimes, setLastFireTimes] = useState<Record<SiegeWeaponId, number>>({} as Record<SiegeWeaponId, number>);
  const manuallySelectedRef = useRef(false);
  const phaseTimerRef = useRef<number | null>(null);

  const interactiveMode = siegePhase !== "idle";

  const enterInteractiveMode = useCallback(() => {
    if (phaseTimerRef.current != null) {
      window.clearTimeout(phaseTimerRef.current);
    }
    setInteractiveKills(0);
    setInteractivePoints(0);
    setInteractiveInitialBugCounts(currentBugCounts);
    setInteractiveRemainingBugs(currentBugCount);
    setInteractiveSessionKey(`${Date.now()}`);
    setSelectedWeaponId("wrench");
    setPlacedStructures([]);
    setPlacingStructureId(null);
    setAgentCaptures({});
    setLastFireTimes({} as Record<SiegeWeaponId, number>);
    manuallySelectedRef.current = false;
    setSiegePhase("entering");
    phaseTimerRef.current = window.setTimeout(() => {
      phaseTimerRef.current = null;
      setSiegePhase("active");
    }, 700);
  }, [currentBugCount, currentBugCounts]);

  const exitInteractiveMode = useCallback(() => {
    if (phaseTimerRef.current != null) {
      window.clearTimeout(phaseTimerRef.current);
    }
    setSiegePhase("exiting");
    phaseTimerRef.current = window.setTimeout(() => {
      phaseTimerRef.current = null;
      setSiegePhase("idle");
    }, 400);
  }, []);

  const selectWeapon = useCallback(
    (id: SiegeWeaponId) => {
      if (siegePhase === "idle") return;
      const stats = getSiegeCombatStats(interactiveKills, debugMode);
      if (!stats.unlockedWeapons.includes(id)) return;
      manuallySelectedRef.current = true;
      setPlacingStructureId(null);
      setSelectedWeaponId(id);
    },
    [debugMode, interactiveKills, siegePhase],
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
      const MAX = 3;
      setPlacedStructures((prev) => {
        const ofType = prev.filter((s) => s.structureType === structureType);
        const filtered = ofType.length >= MAX
          ? prev.filter((s) => s.structureType !== structureType || s !== ofType[0])
          : prev;
        return [
          ...filtered,
          {
            id:
              structureId ??
              `${structureType}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            structureType,
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
      const earned = payload.pointValue ?? 1;
      const frozenBonus = payload.frozen ? 1 : 0;
      setInteractiveKills((v) => v + 1);
      setInteractiveRemainingBugs((v) => Math.max(0, v - 1));
      setInteractivePoints((v) => v + earned + frozenBonus);
    },
    [],
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
        window.setTimeout(() => {
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
    if (manuallySelectedRef.current) return;
    if (debugMode) return;
    const stats = getSiegeCombatStats(interactiveKills, debugMode);
    const highest = stats.unlockedWeapons[stats.unlockedWeapons.length - 1];
    if (highest && highest !== "wrench") {
      const timeoutId = window.setTimeout(() => {
        setSelectedWeaponId(highest);
      }, 0);

      return () => {
        window.clearTimeout(timeoutId);
      };
    }
  }, [debugMode, interactiveKills]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem("rtz-siege-debug", debugMode ? "1" : "0");
  }, [debugMode]);

  useEffect(() => {
    document.body.classList.toggle("interactive-mode", interactiveMode);
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
        // Cancel structure placement first; if not placing, exit siege
        setPlacingStructureId((prev) => {
          if (prev !== null) return null;
          exitInteractiveMode();
          return null;
        });
        return;
      }

      const digit = event.key.match(/^[0-9]$/)?.[0];
      if (!digit) return;
      const slotIndex = digit === "0" ? 9 : parseInt(digit, 10) - 1;
      const stats = getSiegeCombatStats(interactiveKills, debugMode);
      const weaponAtSlot = WEAPON_DEFS[slotIndex];
      if (weaponAtSlot && stats.unlockedWeapons.includes(weaponAtSlot.id)) {
        manuallySelectedRef.current = true;
        setSelectedWeaponId(weaponAtSlot.id);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [debugMode, exitInteractiveMode, interactiveKills, interactiveMode]);

  useEffect(() => {
    return () => {
      if (phaseTimerRef.current != null) {
        window.clearTimeout(phaseTimerRef.current);
      }
    };
  }, []);

  const displayedBugCounts = interactiveMode
    ? interactiveInitialBugCounts
    : currentBugCounts;
  const combatStats = useMemo(
    () => getSiegeCombatStats(interactiveKills, debugMode),
    [debugMode, interactiveKills],
  );
  const weaponSnapshots = useMemo(
    () => getSiegeWeaponSnapshots(interactiveKills, selectedWeaponId, debugMode),
    [debugMode, interactiveKills, selectedWeaponId],
  );

  const toggleDebugMode = useCallback(() => {
    setDebugMode((value) => !value);
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
    setLastFireTimes((prev) => ({ ...prev, [id]: firedAt }));
  }, []);

  return {
    agentCaptures,
    armStructure,
    cancelStructurePlacement,
    combatStats,
    displayedBugCounts,
    debugMode,
    enterInteractiveMode,
    exitInteractiveMode,
    handleAgentAbsorb,
    handleInteractiveHit,
    handleWeaponFired,
    interactiveInitialBugCounts,
    interactiveKills,
    interactiveMode,
    interactivePoints,
    interactiveRemainingBugs,
    interactiveSessionKey,
    lastFireTimes,
    placedCountByType,
    placedStructures,
    placingStructureId,
    placeStructure,
    selectedWeaponId,
    selectWeapon,
    setInteractiveMode: (v: boolean) =>
      v ? enterInteractiveMode() : exitInteractiveMode(),
    siegePhase,
    toggleDebugMode,
    weaponSnapshots,
  };
}

