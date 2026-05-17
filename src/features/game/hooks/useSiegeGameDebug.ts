import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MutableRefObject,
} from "react";
import type { BugCounts } from "../../../types/dashboard";
import type { QaWindowState } from "@game/components/BackgroundField/types";
import type { SiegeWeaponId } from "@game/types";
import type { SiegeRuntimeSnapshotLike } from "./useSiegeRunCompletion";

interface SiegeQaState extends QaWindowState {
  setSiegeProgress?: (progress: {
    kills: number;
    points?: number;
    remainingBugs?: number;
  }) => void;
}

interface UseSiegeGameDebugOptions {
  interactiveInitialBugCounts: BugCounts;
  interactiveMode: boolean;
  interactiveRemainingBugs: number;
  lastKillAtRef: MutableRefObject<number | null>;
  onClearComplete: () => void;
  onEndSurvival: () => void;
  updateRuntimeSnapshot: (
    updater: (current: SiegeRuntimeSnapshotLike) => SiegeRuntimeSnapshotLike,
    force?: boolean,
  ) => void;
}

function getBugCountTotal(bugCounts: BugCounts): number {
  return Object.values(bugCounts).reduce((total, value) => total + value, 0);
}

function getInitialDebugMode() {
  if (typeof window === "undefined") {
    return false;
  }

  const params = new URLSearchParams(window.location.search);
  if (params.get("siegeDebug") === "1") {
    return true;
  }

  return window.localStorage.getItem("rtz-siege-debug") === "1";
}

export function useSiegeGameDebug({
  interactiveInitialBugCounts,
  interactiveMode,
  interactiveRemainingBugs,
  lastKillAtRef,
  onClearComplete,
  onEndSurvival,
  updateRuntimeSnapshot,
}: UseSiegeGameDebugOptions) {
  const [debugMode, setDebugMode] = useState(getInitialDebugMode);
  const [clearSwarmRequestId, setClearSwarmRequestId] = useState(0);
  const liveBugCountRef = useRef(0);

  liveBugCountRef.current = interactiveMode ? interactiveRemainingBugs : 0;

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem("rtz-siege-debug", debugMode ? "1" : "0");
  }, [debugMode]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const qaState = (window as Window & { __RTZ_QA__?: SiegeQaState }).__RTZ_QA__;
    if (!qaState?.enabled) {
      return undefined;
    }

    qaState.setSiegeProgress = ({ kills, points, remainingBugs }) => {
      if (!interactiveMode) {
        return;
      }

      const normalizedKills = Math.max(0, kills);
      updateRuntimeSnapshot(
        (current) => ({
          ...current,
          killStreak: 0,
          kills: normalizedKills,
          points: points ?? normalizedKills,
          remainingBugs:
            remainingBugs ??
            Math.max(0, getBugCountTotal(interactiveInitialBugCounts) - normalizedKills),
          streakMultiplier: 1,
        }),
        true,
      );
      lastKillAtRef.current = null;
    };

    return () => {
      if (qaState.setSiegeProgress) {
        delete qaState.setSiegeProgress;
      }
    };
  }, [interactiveInitialBugCounts, interactiveMode, lastKillAtRef, updateRuntimeSnapshot]);

  const toggleDebugMode = useCallback(() => {
    setDebugMode((value) => !value);
  }, []);

  const killAllBugs = useCallback(() => {
    if (!interactiveMode) {
      return;
    }

    updateRuntimeSnapshot(
      (current) => {
        const clearedBugs = Math.max(0, current.remainingBugs);
        if (clearedBugs === 0) {
          return current;
        }

        return {
          ...current,
          killStreak: 0,
          kills: current.kills + clearedBugs,
          points: current.points + clearedBugs,
          remainingBugs: 0,
          streakMultiplier: 1,
        };
      },
      true,
    );
    lastKillAtRef.current = null;
    setClearSwarmRequestId((current) => current + 1);
    // Bypass the rAF pre-paint overwrite race: synchronously finalize the run
    onClearComplete();
  }, [interactiveMode, lastKillAtRef, onClearComplete, updateRuntimeSnapshot]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const qaState = (window as Window & { __RTZ_QA__?: SiegeQaState }).__RTZ_QA__;
    if (!qaState?.enabled) {
      return undefined;
    }

    const fallbackGetLiveBugCount = () => liveBugCountRef.current;
    const fallbackClearLiveBugs = () => {
      const clearedCount = liveBugCountRef.current;

      if (clearedCount > 0) {
        killAllBugs();
      }

      return clearedCount;
    };

    if (!qaState.getLiveBugCount) {
      qaState.getLiveBugCount = fallbackGetLiveBugCount;
    }
    if (!qaState.clearLiveBugs) {
      qaState.clearLiveBugs = fallbackClearLiveBugs;
    }

    return () => {
      if (qaState.getLiveBugCount === fallbackGetLiveBugCount) {
        delete qaState.getLiveBugCount;
      }
      if (qaState.clearLiveBugs === fallbackClearLiveBugs) {
        delete qaState.clearLiveBugs;
      }
    };
  }, [interactiveMode, killAllBugs]);

  const triggerSurvivalOverrun = useCallback(() => {
    if (!interactiveMode) {
      return;
    }
    onEndSurvival();
  }, [interactiveMode, onEndSurvival]);

  return {
    clearSwarmRequestId,
    debugMode,
    killAllBugs,
    toggleDebugMode,
    triggerSurvivalOverrun,
  };
}