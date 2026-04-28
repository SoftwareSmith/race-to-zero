import { useEffect, useState, type MutableRefObject } from "react";
import { STORAGE_KEYS } from "../../../constants/storageKeys";
import {
  createStoredJsonParser,
  isStoredRecord,
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
const SIEGE_GAME_MODES: SiegeGameMode[] = ["purge", "outbreak"];

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
  offlineReason?: string;
  survivedMs: number;
  topWeaponId: SiegeWeaponId;
  topWeaponLabel: string;
  waveReached: number;
}

export interface SiegeCompletionSummary extends SiegeLeaderboardEntry {
  isNewBest: boolean;
  rank: number;
}

export type SiegeLeaderboardsByMode = Record<
  SiegeGameMode,
  SiegeLeaderboardEntry[]
>;

interface UseSiegeRunCompletionOptions {
  evolutionStates?: Partial<Record<SiegeWeaponId, WeaponEvolutionState>>;
  gameMode: SiegeGameMode;
  interactiveKills: number;
  interactiveMode: boolean;
  interactiveRemainingBugs: number;
  interactiveBaseElapsedMsRef: MutableRefObject<number>;
  interactiveRunningSinceRef: MutableRefObject<number | null>;
  offlineReason?: string | null;
  selectedWeaponId: SiegeWeaponId;
  siegePhase: SiegePhase;
  siteOffline: boolean;
  updateRuntimeSnapshot: (
    updater: (current: SiegeRuntimeSnapshotLike) => SiegeRuntimeSnapshotLike,
    force?: boolean,
  ) => void;
  waveReached?: number;
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

function isSiegeGameMode(value: unknown): value is SiegeGameMode {
  return value === "purge" || value === "outbreak";
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function normalizeLeaderboardEntry(
  value: unknown,
): SiegeLeaderboardEntry | null {
  if (!isStoredRecord(value) || !isSiegeGameMode(value.mode)) {
    return null;
  }

  if (
    typeof value.id !== "string" ||
    typeof value.completedAt !== "string" ||
    typeof value.topWeaponId !== "string" ||
    typeof value.topWeaponLabel !== "string" ||
    !isFiniteNumber(value.bugCount) ||
    !isFiniteNumber(value.bugsPerSecond) ||
    !isFiniteNumber(value.elapsedMs)
  ) {
    return null;
  }

  return {
    id: value.id,
    bugCount: Math.max(0, Math.floor(value.bugCount)),
    bugsPerSecond: Math.max(0, value.bugsPerSecond),
    completedAt: value.completedAt,
    elapsedMs: Math.max(0, Math.floor(value.elapsedMs)),
    mode: value.mode,
    offlineReason:
      typeof value.offlineReason === "string" ? value.offlineReason : undefined,
    survivedMs: isFiniteNumber(value.survivedMs)
      ? Math.max(0, Math.floor(value.survivedMs))
      : Math.max(0, Math.floor(value.elapsedMs)),
    topWeaponId: value.topWeaponId as SiegeWeaponId,
    topWeaponLabel: value.topWeaponLabel,
    waveReached: isFiniteNumber(value.waveReached)
      ? Math.max(0, Math.floor(value.waveReached))
      : value.mode === "outbreak"
        ? 1
        : 0,
  };
}

function normalizeLeaderboardEntries(value: unknown): SiegeLeaderboardEntry[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => normalizeLeaderboardEntry(entry))
    .filter((entry): entry is SiegeLeaderboardEntry => entry != null);
}

export function buildSiegeLeaderboard(
  entries: SiegeLeaderboardEntry[],
  mode: SiegeGameMode,
): SiegeLeaderboardEntry[] {
  return [...entries]
    .filter((entry) => entry.mode === mode)
    .sort((left, right) => {
      if (mode === "outbreak") {
        if (right.waveReached !== left.waveReached) {
          return right.waveReached - left.waveReached;
        }

        if (right.survivedMs !== left.survivedMs) {
          return right.survivedMs - left.survivedMs;
        }

        if (right.bugCount !== left.bugCount) {
          return right.bugCount - left.bugCount;
        }

        return right.completedAt.localeCompare(left.completedAt);
      }

      if (left.elapsedMs !== right.elapsedMs) {
        return left.elapsedMs - right.elapsedMs;
      }

      if (right.bugCount !== left.bugCount) {
        return right.bugCount - left.bugCount;
      }

      if (right.bugsPerSecond !== left.bugsPerSecond) {
        return right.bugsPerSecond - left.bugsPerSecond;
      }

      return right.completedAt.localeCompare(left.completedAt);
    })
    .slice(0, MAX_LEADERBOARD_ENTRIES);
}

export function buildSiegeLeaderboards(
  entries: SiegeLeaderboardEntry[],
): SiegeLeaderboardsByMode {
  return {
    outbreak: buildSiegeLeaderboard(entries, "outbreak"),
    purge: buildSiegeLeaderboard(entries, "purge"),
  };
}

function isSiegeLeaderboardsByMode(
  value: unknown,
): value is SiegeLeaderboardsByMode {
  if (!isStoredRecord(value)) {
    return false;
  }

  return SIEGE_GAME_MODES.every((mode) => Array.isArray(value[mode]));
}

function getStoredLeaderboards(): SiegeLeaderboardsByMode {
  const storedV2 = readStorageValue(
    STORAGE_KEYS.siegeRunLeaderboardsV2,
    null,
    createStoredJsonParser<unknown>(),
  );
  if (isSiegeLeaderboardsByMode(storedV2)) {
    return buildSiegeLeaderboards([
      ...normalizeLeaderboardEntries(storedV2.purge),
      ...normalizeLeaderboardEntries(storedV2.outbreak),
    ]);
  }

  const legacyEntries = readStorageValue(
    STORAGE_KEYS.siegeRunLeaderboard,
    [],
    createStoredJsonParser<unknown[]>((value): value is unknown[] =>
      Array.isArray(value),
    ),
  );

  return buildSiegeLeaderboards(normalizeLeaderboardEntries(legacyEntries));
}

export function useSiegeRunCompletion({
  evolutionStates,
  gameMode,
  interactiveKills,
  interactiveMode,
  interactiveRemainingBugs,
  interactiveBaseElapsedMsRef,
  interactiveRunningSinceRef,
  offlineReason,
  selectedWeaponId,
  siegePhase,
  siteOffline,
  updateRuntimeSnapshot,
  waveReached = 0,
}: UseSiegeRunCompletionOptions) {
  const [leaderboards, setLeaderboards] = useState<SiegeLeaderboardsByMode>(
    getStoredLeaderboards,
  );
  const [completionSummary, setCompletionSummary] =
    useState<SiegeCompletionSummary | null>(null);
  const leaderboard = leaderboards[gameMode];

  useEffect(() => {
    if (
      !interactiveMode ||
      siegePhase !== "active" ||
      (gameMode === "purge" && interactiveRemainingBugs > 0) ||
      (gameMode === "outbreak" && !siteOffline) ||
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
      offlineReason:
        gameMode === "outbreak"
          ? offlineReason ?? "Site offline under swarm pressure"
          : undefined,
      survivedMs: finalElapsedMs,
      topWeaponId: topWeapon.id,
      topWeaponLabel: topWeapon.label,
      waveReached: gameMode === "outbreak" ? Math.max(1, waveReached) : 0,
    };
    const nextLeaderboards = buildSiegeLeaderboards([
      ...leaderboards.purge,
      ...leaderboards.outbreak,
      entry,
    ]);
    const nextLeaderboard = nextLeaderboards[gameMode];
    const rank = nextLeaderboard.findIndex((item) => item.id === entry.id) + 1;

    setLeaderboards(nextLeaderboards);
    setStorageValue(
      STORAGE_KEYS.siegeRunLeaderboardsV2,
      nextLeaderboards,
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
    leaderboards,
    offlineReason,
    selectedWeaponId,
    siegePhase,
    siteOffline,
    updateRuntimeSnapshot,
    waveReached,
  ]);

  return {
    completionSummary,
    leaderboard,
    resetCompletion: () => setCompletionSummary(null),
  };
}