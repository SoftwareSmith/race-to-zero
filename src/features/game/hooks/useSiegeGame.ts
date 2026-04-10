import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { BugCounts } from "../../../types/dashboard";
import {
  getSiegeCombatStats,
  getSiegeWeaponSnapshots,
  SIEGE_UNLOCK_THRESHOLDS,
} from "@game/progression/progression";
import type { SiegePhase, SiegeWeaponId } from "@game/types";

interface UseSiegeGameOptions {
  currentBugCount: number;
  currentBugCounts: BugCounts;
}

export function useSiegeGame({
  currentBugCount,
  currentBugCounts,
}: UseSiegeGameOptions) {
  const [siegePhase, setSiegePhase] = useState<SiegePhase>("idle");
  const [interactiveInitialBugCounts, setInteractiveInitialBugCounts] =
    useState<BugCounts>(currentBugCounts);
  const [interactiveKills, setInteractiveKills] = useState(0);
  const [interactiveRemainingBugs, setInteractiveRemainingBugs] = useState(0);
  const [interactiveSessionKey, setInteractiveSessionKey] = useState<
    string | null
  >(null);
  const [selectedWeaponId, setSelectedWeaponId] =
    useState<SiegeWeaponId>("hammer");
  /**
   * Tracks whether the player has manually chosen a weapon since entering siege
   * mode. When false, we auto-advance to a newly unlocked weapon.
   */
  const manuallySelectedRef = useRef(false);
  const phaseTimerRef = useRef<number | null>(null);

  /** True while siege mode is fully active OR in the entering/exiting transition. */
  const interactiveMode = siegePhase !== "idle";

  const enterInteractiveMode = useCallback(() => {
    if (phaseTimerRef.current != null) {
      window.clearTimeout(phaseTimerRef.current);
    }
    setInteractiveKills(0);
    setInteractiveInitialBugCounts(currentBugCounts);
    setInteractiveRemainingBugs(currentBugCount);
    setInteractiveSessionKey(`${Date.now()}`);
    setSelectedWeaponId("hammer");
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
      const stats = getSiegeCombatStats(interactiveKills);
      const unlockedMap: Record<SiegeWeaponId, boolean> = {
        hammer: true,
        pulse: stats.pulseUnlocked,
        laser: stats.laserUnlocked,
      };
      if (!unlockedMap[id]) return;
      manuallySelectedRef.current = true;
      setSelectedWeaponId(id);
    },
    [interactiveKills, siegePhase],
  );

  const handleInteractiveHit = useCallback((payload: { defeated: boolean }) => {
    if (!payload.defeated) {
      return;
    }

    setInteractiveKills((currentValue) => currentValue + 1);
    setInteractiveRemainingBugs((currentValue) =>
      Math.max(0, currentValue - 1),
    );
  }, []);

  // Auto-advance selectedWeaponId when a new weapon unlocks — unless the
  // player has already made a manual selection.
  useEffect(() => {
    if (manuallySelectedRef.current) return;
    if (interactiveKills >= SIEGE_UNLOCK_THRESHOLDS.laser) {
      setSelectedWeaponId("laser");
    } else if (interactiveKills >= SIEGE_UNLOCK_THRESHOLDS.pulse) {
      setSelectedWeaponId("pulse");
    }
  }, [interactiveKills]);

  // body class + ESC key
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
      if (event.key !== "Escape") {
        return;
      }

      event.preventDefault();
      exitInteractiveMode();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [exitInteractiveMode, interactiveMode]);

  // Cleanup phase timer on unmount
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
    () => getSiegeCombatStats(interactiveKills),
    [interactiveKills],
  );
  const weaponSnapshots = useMemo(
    () => getSiegeWeaponSnapshots(interactiveKills, selectedWeaponId),
    [interactiveKills, selectedWeaponId],
  );

  return {
    combatStats,
    displayedBugCounts,
    enterInteractiveMode,
    exitInteractiveMode,
    handleInteractiveHit,
    interactiveInitialBugCounts,
    interactiveKills,
    interactiveMode,
    interactiveRemainingBugs,
    interactiveSessionKey,
    selectedWeaponId,
    selectWeapon,
    setInteractiveMode: (v: boolean) =>
      v ? enterInteractiveMode() : exitInteractiveMode(),
    siegePhase,
    weaponSnapshots,
  };
}