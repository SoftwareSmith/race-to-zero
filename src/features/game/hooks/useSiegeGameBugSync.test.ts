import { describe, expect, it } from "vitest";

import {
  normalizeSyncedBugCount,
  shouldFinalizePurgeFromBugSync,
  shouldForceBugSyncFlush,
  shouldIgnoreBugSync,
  updateRuntimeSnapshotRemainingBugs,
  updateSurvivalStatusLiveBugCounts,
} from "./useSiegeGameBugSync";
import {
  createRuntimeSnapshot,
  createSurvivalRuntimeStatus,
} from "./useSiegeGameSupport";
import { getSurvivalWavePlan } from "@game/sim/survivalDirector";

describe("useSiegeGameBugSync", () => {
  it("guards stale session updates and normalizes synced counts", () => {
    expect(shouldIgnoreBugSync("old", "current")).toBe(true);
    expect(shouldIgnoreBugSync("current", "current")).toBe(false);
    expect(normalizeSyncedBugCount(3.8)).toBe(3);
    expect(normalizeSyncedBugCount(-4)).toBe(0);
  });

  it("updates runtime remaining bugs and computes flush behavior", () => {
    const unchanged = createRuntimeSnapshot(4);
    const changed = updateRuntimeSnapshotRemainingBugs(unchanged, 0);

    expect(updateRuntimeSnapshotRemainingBugs(unchanged, 4)).toBe(unchanged);
    expect(changed.remainingBugs).toBe(0);
    expect(shouldForceBugSyncFlush(4, 4)).toBe(false);
    expect(shouldForceBugSyncFlush(4, 0)).toBe(true);
  });

  it("refreshes survival live bug counts and knows when purge should finalize", () => {
    const plan = getSurvivalWavePlan(1);
    const status = createSurvivalRuntimeStatus(plan);
    const updated = updateSurvivalStatusLiveBugCounts(status, 5, {
      high: 1,
      low: 2,
      medium: 1,
      urgent: 0,
    });

    expect(Object.values(updated.liveBugCounts).reduce((sum, value) => sum + value, 0)).toBe(5);
    expect(
      shouldFinalizePurgeFromBugSync({
        gameMode: "purge",
        interactiveMode: true,
        normalizedCount: 0,
        siegePhase: "active",
      }),
    ).toBe(true);
    expect(
      shouldFinalizePurgeFromBugSync({
        gameMode: "outbreak",
        interactiveMode: true,
        normalizedCount: 0,
        siegePhase: "active",
      }),
    ).toBe(false);
  });
});