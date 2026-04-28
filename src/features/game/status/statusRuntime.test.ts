import { describe, expect, it } from "vitest";

import {
  clearExpiredRuntimeStatuses,
  extendTimedStatus,
  getOrderedActiveStatusIds,
  getStatusRuntimeSummary,
  isRuntimeStatusActive,
  refreshTimedStatus,
} from "./statusRuntime";

describe("status runtime", () => {
  it("returns active statuses in HUD priority order", () => {
    const now = 1_000;

    expect(
      getOrderedActiveStatusIds(
        {
          burn: { accumulatedDmg: 0, decayPerSecond: 0.5, dps: 1, expiresAt: 1_600 },
          freeze: { expiresAt: 1_200, multiplier: 0.5 },
          marked: { expiresAt: 1_300 },
        },
        now,
      ),
    ).toEqual(["burn", "freeze", "marked"]);
  });

  it("summarizes control pressure from freeze and ensnare states", () => {
    const summary = getStatusRuntimeSummary(
      {
        ensnare: { canInstakill: true, expiresAt: 2_000 },
        freeze: { expiresAt: 2_000, multiplier: 0.45 },
      },
      1_000,
    );

    expect(summary.mobilityMultiplier).toBe(0);
    expect(summary.controlIntensity).toBe(1);
    expect(summary.activeStatusIds).toEqual(["ensnare", "freeze"]);
  });

  it("treats expired statuses as inactive", () => {
    expect(isRuntimeStatusActive({ expiresAt: 900 }, 1_000)).toBe(false);
  });

  it("extends active timed statuses and recreates expired ones", () => {
    expect(
      extendTimedStatus(
        { expiresAt: 1_400 },
        1_000,
        250,
        (expiresAt) => ({ expiresAt }),
      ),
    ).toEqual({ expiresAt: 1_650 });

    expect(
      extendTimedStatus(null, 1_000, 250, (expiresAt) => ({ expiresAt })),
    ).toEqual({ expiresAt: 1_250 });
  });

  it("refreshes lingering statuses and clears expired state from the collection", () => {
    expect(
      refreshTimedStatus(
        { expiresAt: 1_050 },
        1_000,
        250,
        (expiresAt) => ({ expiresAt }),
      ),
    ).toEqual({ expiresAt: 1_250 });

    expect(
      clearExpiredRuntimeStatuses(
        {
          burn: { accumulatedDmg: 0, decayPerSecond: 0.5, dps: 1, expiresAt: 900 },
          freeze: { expiresAt: 1_200, multiplier: 0.5 },
          marked: { expiresAt: 800 },
        },
        1_000,
      ),
    ).toEqual({
      ally: null,
      burn: null,
      charged: null,
      ensnare: null,
      freeze: { expiresAt: 1_200, multiplier: 0.5 },
      looped: null,
      marked: null,
      poison: null,
      unstable: null,
    });
  });
});