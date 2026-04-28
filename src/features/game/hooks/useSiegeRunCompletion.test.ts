import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { STORAGE_KEYS } from "../../../constants/storageKeys";
import {
  buildSiegeLeaderboards,
  useSiegeRunCompletion,
  type SiegeLeaderboardEntry,
} from "./useSiegeRunCompletion";

function createEntry(
  overrides: Partial<SiegeLeaderboardEntry> & Pick<SiegeLeaderboardEntry, "id">,
): SiegeLeaderboardEntry {
  return {
    id: overrides.id,
    bugCount: overrides.bugCount ?? 10,
    bugsPerSecond: overrides.bugsPerSecond ?? 1,
    completedAt: overrides.completedAt ?? "2026-04-01T00:00:00.000Z",
    elapsedMs: overrides.elapsedMs ?? 10_000,
    mode: overrides.mode ?? "purge",
    offlineReason: overrides.offlineReason,
    survivedMs: overrides.survivedMs ?? overrides.elapsedMs ?? 10_000,
    topWeaponId: overrides.topWeaponId ?? "hammer",
    topWeaponLabel: overrides.topWeaponLabel ?? "Hammer",
    waveReached: overrides.waveReached ?? 0,
  };
}

describe("siege run completion leaderboards", () => {
  it("sorts Time Attack by fastest clear time, then bug count", () => {
    const leaderboards = buildSiegeLeaderboards([
      createEntry({ id: "slow", bugCount: 100, elapsedMs: 30_000 }),
      createEntry({ id: "fast-small", bugCount: 50, elapsedMs: 20_000 }),
      createEntry({ id: "fast-large", bugCount: 75, elapsedMs: 20_000 }),
      createEntry({ id: "survival", mode: "outbreak", waveReached: 9 }),
    ]);

    expect(leaderboards.purge.map((entry) => entry.id)).toEqual([
      "fast-large",
      "fast-small",
      "slow",
    ]);
  });

  it("sorts Survival by highest wave, then longest survival time, then kills", () => {
    const leaderboards = buildSiegeLeaderboards([
      createEntry({ id: "wave-4", mode: "outbreak", waveReached: 4, survivedMs: 90_000, bugCount: 90 }),
      createEntry({ id: "wave-8-short", mode: "outbreak", waveReached: 8, survivedMs: 70_000, bugCount: 130 }),
      createEntry({ id: "wave-8-long", mode: "outbreak", waveReached: 8, survivedMs: 95_000, bugCount: 110 }),
      createEntry({ id: "time-attack", mode: "purge", elapsedMs: 8_000 }),
    ]);

    expect(leaderboards.outbreak.map((entry) => entry.id)).toEqual([
      "wave-8-long",
      "wave-8-short",
      "wave-4",
    ]);
  });

  it("trims each mode leaderboard to the top eight entries", () => {
    const leaderboards = buildSiegeLeaderboards(
      Array.from({ length: 12 }, (_, index) =>
        createEntry({
          id: `run-${index}`,
          elapsedMs: 1_000 + index,
          mode: "purge",
        }),
      ),
    );

    expect(leaderboards.purge).toHaveLength(8);
    expect(leaderboards.purge.map((entry) => entry.id)).toEqual([
      "run-0",
      "run-1",
      "run-2",
      "run-3",
      "run-4",
      "run-5",
      "run-6",
      "run-7",
    ]);
  });

  it("falls back safely when stored leaderboard data is malformed", () => {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: {
        getItem: vi.fn(() => "not-json"),
        setItem: vi.fn(),
      },
    });

    const { result } = renderHook(() =>
      useSiegeRunCompletion({
        evolutionStates: {},
        gameMode: "purge",
        interactiveBaseElapsedMsRef: { current: 0 },
        interactiveKills: 0,
        interactiveMode: false,
        interactiveRemainingBugs: 1,
        interactiveRunningSinceRef: { current: null },
        selectedWeaponId: "hammer",
        siegePhase: "idle",
        siteOffline: false,
        updateRuntimeSnapshot: vi.fn(),
      }),
    );

    expect(result.current.leaderboard).toEqual([]);
  });

  it("migrates valid legacy leaderboard entries into the active mode board", () => {
    const legacyEntry = createEntry({
      id: "legacy-fast",
      elapsedMs: 5_000,
      mode: "purge",
    });
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: {
        getItem: vi.fn((key: string) => {
          if (key === STORAGE_KEYS.siegeRunLeaderboardsV2) {
            return null;
          }

          if (key === STORAGE_KEYS.siegeRunLeaderboard) {
            return JSON.stringify([legacyEntry]);
          }

          return null;
        }),
        setItem: vi.fn(),
      },
    });

    const { result } = renderHook(() =>
      useSiegeRunCompletion({
        evolutionStates: {},
        gameMode: "purge",
        interactiveBaseElapsedMsRef: { current: 0 },
        interactiveKills: 0,
        interactiveMode: false,
        interactiveRemainingBugs: 1,
        interactiveRunningSinceRef: { current: null },
        selectedWeaponId: "hammer",
        siegePhase: "idle",
        siteOffline: false,
        updateRuntimeSnapshot: vi.fn(),
      }),
    );

    expect(result.current.leaderboard).toEqual([legacyEntry]);
  });
});
