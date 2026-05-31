import { describe, expect, it, vi } from "vitest";

import { getSurvivalWavePlan } from "@game/sim/survivalDirector";
import {
  areRuntimeSnapshotsEqual,
  createRuntimeSnapshot,
  createSurvivalRuntimeStatus,
  normalizeBugCountsForSurvival,
  recordSurvivalPressureQaSnapshot,
  scaleBugCounts,
} from "./useSiegeGameSupport";

describe("useSiegeGameSupport", () => {
  it("normalizes supplied survival bug counts to the requested total", () => {
    const counts = normalizeBugCountsForSurvival(
      10,
      { high: 1, low: 3, medium: 1, urgent: 0 },
      1,
    );

    expect(Object.values(counts).reduce((sum, value) => sum + value, 0)).toBe(10);
    expect(counts.low).toBeGreaterThanOrEqual(counts.high);
  });

  it("compares runtime snapshots by value except for lastFireTimes identity", () => {
    const sharedFireTimes = { hammer: 100 } as any;
    const left = {
      ...createRuntimeSnapshot(5),
      killStreak: 2,
      lastFireTimes: sharedFireTimes,
    };
    const right = {
      ...createRuntimeSnapshot(5),
      killStreak: 2,
      lastFireTimes: sharedFireTimes,
    };
    const changed = {
      ...right,
      points: 1,
    };

    expect(areRuntimeSnapshotsEqual(left, right)).toBe(true);
    expect(areRuntimeSnapshotsEqual(left, changed)).toBe(false);
  });

  it("creates survival runtime status from the plan and clamps spawn budget", () => {
    const plan = getSurvivalWavePlan(2);
    const status = createSurvivalRuntimeStatus(plan, {
      liveBugCounts: { high: 1, low: 2, medium: 3, urgent: 4 },
      now: 2_000,
      remainingSpawnBudget: -5,
      siteIntegrity: 87,
    });

    expect(status.wave).toBe(2);
    expect(status.waveEndsAt).toBe(2_000 + plan.waveDurationMs);
    expect(status.waveStartedAt).toBe(2_000);
    expect(status.remainingSpawnBudget).toBe(0);
    expect(status.siteIntegrity).toBe(87);
    expect(status.liveBugCounts.urgent).toBe(4);
  });

  it("scales bug counts and records QA snapshots only when enabled", () => {
    expect(scaleBugCounts({ high: 1, low: 2, medium: 3, urgent: 4 }, 1.5)).toEqual({
      high: 2,
      low: 3,
      medium: 5,
      urgent: 6,
    });

    const qaWindow = window as Window & {
      __RTZ_QA__?: {
        enabled?: boolean;
        survivalPressureSnapshot?: unknown;
      };
    };
    qaWindow.__RTZ_QA__ = { enabled: false };

    recordSurvivalPressureQaSnapshot({
      activeBugCount: 3,
      errors: 1,
      pressurePercent: 40,
      speed: 1.2,
      tickedAt: 100,
      uptime: 90,
      wave: 2,
    });

    expect(qaWindow.__RTZ_QA__?.survivalPressureSnapshot).toBeUndefined();

    qaWindow.__RTZ_QA__ = { enabled: true };
    recordSurvivalPressureQaSnapshot({
      activeBugCount: 4,
      errors: 2,
      pressurePercent: 55,
      speed: 1.4,
      tickedAt: 120,
      uptime: 84,
      wave: 3,
    });

    expect(qaWindow.__RTZ_QA__?.survivalPressureSnapshot).toEqual(
      expect.objectContaining({ pressurePercent: 55, wave: 3 }),
    );
  });
});