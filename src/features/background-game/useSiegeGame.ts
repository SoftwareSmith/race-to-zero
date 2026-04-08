import { useCallback, useEffect, useMemo, useState } from "react";
import type { BugCounts } from "../../types/dashboard";
import {
  getSiegeCombatStats,
  getSiegeWeaponSnapshots,
} from "./progression";

interface UseSiegeGameOptions {
  currentBugCount: number;
  currentBugCounts: BugCounts;
}

export function useSiegeGame({
  currentBugCount,
  currentBugCounts,
}: UseSiegeGameOptions) {
  const [interactiveMode, setInteractiveMode] = useState(false);
  const [interactiveInitialBugCounts, setInteractiveInitialBugCounts] =
    useState<BugCounts>(currentBugCounts);
  const [interactiveKills, setInteractiveKills] = useState(0);
  const [interactiveRemainingBugs, setInteractiveRemainingBugs] = useState(0);
  const [interactiveSessionKey, setInteractiveSessionKey] = useState<
    string | null
  >(null);

  const enterInteractiveMode = useCallback(() => {
    setInteractiveKills(0);
    setInteractiveInitialBugCounts(currentBugCounts);
    setInteractiveRemainingBugs(currentBugCount);
    setInteractiveSessionKey(`${Date.now()}`);
    setInteractiveMode(true);
  }, [currentBugCount, currentBugCounts]);

  const exitInteractiveMode = useCallback(() => {
    setInteractiveMode(false);
  }, []);

  const handleInteractiveHit = useCallback((payload: { defeated: boolean }) => {
    if (!payload.defeated) {
      return;
    }

    setInteractiveKills((currentValue) => currentValue + 1);
    setInteractiveRemainingBugs((currentValue) =>
      Math.max(0, currentValue - 1),
    );
  }, []);

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
      setInteractiveMode(false);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [interactiveMode]);

  const displayedBugCounts = interactiveMode
    ? interactiveInitialBugCounts
    : currentBugCounts;
  const combatStats = useMemo(
    () => getSiegeCombatStats(interactiveKills),
    [interactiveKills],
  );
  const weaponSnapshots = useMemo(
    () => getSiegeWeaponSnapshots(interactiveKills),
    [interactiveKills],
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
    setInteractiveMode,
    weaponSnapshots,
  };
}