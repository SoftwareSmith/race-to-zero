import type { BugCounts } from "../../../types/dashboard";
import type { SiegeGameMode, SiegePhase } from "@game/types";
import {
  normalizeBugCountsForSurvival,
  type SiegeRuntimeSnapshot,
  type SurvivalRuntimeStatus,
} from "./useSiegeGameSupport";

export function shouldIgnoreBugSync(
  sourceSessionKey: string | null | undefined,
  activeSessionKey: string | null,
) {
  return sourceSessionKey != null && sourceSessionKey !== activeSessionKey;
}

export function normalizeSyncedBugCount(count: number) {
  return Math.max(0, Math.floor(count));
}

export function shouldForceBugSyncFlush(
  currentRemainingBugs: number,
  normalizedCount: number,
) {
  return currentRemainingBugs !== normalizedCount || normalizedCount === 0;
}

export function updateRuntimeSnapshotRemainingBugs(
  current: SiegeRuntimeSnapshot,
  normalizedCount: number,
): SiegeRuntimeSnapshot {
  if (current.remainingBugs === normalizedCount && normalizedCount !== 0) {
    return current;
  }

  return {
    ...current,
    remainingBugs: normalizedCount,
  };
}

export function updateSurvivalStatusLiveBugCounts(
  current: SurvivalRuntimeStatus,
  normalizedCount: number,
  bugCounts: BugCounts,
): SurvivalRuntimeStatus {
  return {
    ...current,
    liveBugCounts: normalizeBugCountsForSurvival(
      normalizedCount,
      bugCounts,
      current.wave,
    ),
  };
}

export function shouldFinalizePurgeFromBugSync(options: {
  gameMode: SiegeGameMode;
  interactiveMode: boolean;
  normalizedCount: number;
  siegePhase: SiegePhase;
}) {
  return (
    options.normalizedCount === 0 &&
    options.interactiveMode &&
    options.siegePhase === "active" &&
    options.gameMode === "purge"
  );
}