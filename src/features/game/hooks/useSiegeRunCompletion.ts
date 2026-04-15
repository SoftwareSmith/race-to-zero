import { useEffect, useState, type MutableRefObject } from "react";
import { STORAGE_KEYS } from "../../../constants/storageKeys";
import {
  createStoredJsonParser,
  readStorageValue,
  setStorageValue,
} from "@shared/utils/storage";
import { getSiegeWeaponLabel } from "@game/progression/progression";
import type {
  SiegeGameMode,
  SiegePhase,
  SiegeWeaponId,
  WeaponEvolutionState,
} from "@game/types";

const MAX_LEADERBOARD_ENTRIES = 8;

export interface SiegeRuntimeSnapshotLike {
  elapsedMs: number;
  killStreak: number;
  kills: number;
  lastFireTimes: Record<SiegeWeaponId, number>;
  points: number;
  remainingBugs: number;
  streakMultiplier: number;
}

export interface SiegeLeaderboardEntry {
  id: string;
  bugCount: number;
  bugsPerSecond: number;
  completedAt: string;
  elapsedMs: number;
  mode: SiegeGameMode;
  topWeaponId: SiegeWeaponId;
  topWeaponLabel: string;
}

export interface SiegeCompletionSummary extends SiegeLeaderboardEntry {
  isNewBest: boolean;
  rank: number;
}

interface UseSiegeRunCompletionOptions {
  evolutionStates?: Partial<Record<SiegeWeaponId, WeaponEvolutionState>>;
  gameMode: SiegeGameMode;
  interactiveKills: number;
  interactiveMode: boolean;
  interactiveRemainingBugs: number;
  interactiveBaseElapsedMsRef: MutableRefObject<number>;
  interactiveRunningSinceRef: MutableRefObject<number | null>;
  selectedWeaponId: SiegeWeaponId;
  siegePhase: SiegePhase;
  updateRuntimeSnapshot: (
    updater: (current: SiegeRuntimeSnapshotLike) => SiegeRuntimeSnapshotLike,
    force?: boolean,
  ) => void;
}

function getTopWeapon(
  evolutionStates: Partial<Record<SiegeWeaponId, WeaponEvolutionState>> | undefined,
  fallbackId: SiegeWeaponId,
): { id: SiegeWeaponId; label: string } {
  const ranked = Object.entries(evolutionStates ?? {})
    .filter((entry): entry is [SiegeWeaponId, WeaponEvolutionState] => {
      const [, state] = entry;
      return state != null;
    })
    .sort((left, right) => right[1].kills - left[1].kills);

  const topWeaponId = ranked[0]?.[0] ?? fallbackId;
  return {
    id: topWeaponId,
    label: getSiegeWeaponLabel(topWeaponId),
  };
}

function buildLeaderboard(entries: SiegeLeaderboardEntry[]) {
  return [...entries]
    .sort((left, right) => {
      if (right.bugCount !== left.bugCount) {
        return right.bugCount - left.bugCount;
      }

      if (left.elapsedMs !== right.elapsedMs) {
        return left.elapsedMs - right.elapsedMs;
      }

      if (right.bugsPerSecond !== left.bugsPerSecond) {
        return right.bugsPerSecond - left.bugsPerSecond;
      }

      return right.completedAt.localeCompare(left.completedAt);
    })
    .slice(0, MAX_LEADERBOARD_ENTRIES);
}

function isSiegeLeaderboardEntryList(
  value: unknown,
): value is SiegeLeaderboardEntry[] {
  return Array.isArray(value);
}

export function useSiegeRunCompletion({
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
}: UseSiegeRunCompletionOptions) {
  const [leaderboard, setLeaderboard] = useState<SiegeLeaderboardEntry[]>(() =>
    readStorageValue(
      STORAGE_KEYS.siegeRunLeaderboard,
      [],
      createStoredJsonParser<SiegeLeaderboardEntry[]>(
        isSiegeLeaderboardEntryList,
      ),
    ),
  );
  const [completionSummary, setCompletionSummary] =
    useState<SiegeCompletionSummary | null>(null);

  useEffect(() => {
    if (
      !interactiveMode ||
      siegePhase !== "active" ||
      interactiveRemainingBugs > 0 ||
      completionSummary != null
    ) {
      return;
    }

    const finalElapsedMs =
      interactiveBaseElapsedMsRef.current +
      (interactiveRunningSinceRef.current == null
        ? 0
        : Math.max(0, Date.now() - interactiveRunningSinceRef.current));

    interactiveBaseElapsedMsRef.current = finalElapsedMs;
    interactiveRunningSinceRef.current = null;

    const topWeapon = getTopWeapon(evolutionStates, selectedWeaponId);
    const entry: SiegeLeaderboardEntry = {
      id: `siege-run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      bugCount: interactiveKills,
      bugsPerSecond:
        finalElapsedMs > 0
          ? Number(((interactiveKills * 1000) / finalElapsedMs).toFixed(2))
          : interactiveKills,
      completedAt: new Date().toISOString(),
      elapsedMs: finalElapsedMs,
      mode: gameMode,
      topWeaponId: topWeapon.id,
      topWeaponLabel: topWeapon.label,
    };
    const nextLeaderboard = buildLeaderboard([...leaderboard, entry]);
    const rank = nextLeaderboard.findIndex((item) => item.id === entry.id) + 1;

    setLeaderboard(nextLeaderboard);
    setStorageValue(
      STORAGE_KEYS.siegeRunLeaderboard,
      nextLeaderboard,
      (value) => JSON.stringify(value),
    );
    setCompletionSummary({
      ...entry,
      isNewBest: rank === 1,
      rank,
    });
    updateRuntimeSnapshot(
      (current) => ({
        ...current,
        elapsedMs: finalElapsedMs,
        remainingBugs: 0,
      }),
      true,
    );
  }, [
    completionSummary,
    evolutionStates,
    gameMode,
    interactiveBaseElapsedMsRef,
    interactiveKills,
    interactiveMode,
    interactiveRemainingBugs,
    interactiveRunningSinceRef,
    leaderboard,
    selectedWeaponId,
    siegePhase,
    updateRuntimeSnapshot,
  ]);

  return {
    completionSummary,
    leaderboard,
    resetCompletion: () => setCompletionSummary(null),
  };
}