import { describe, expect, it } from "vitest";

import {
  clearExpiredStatus,
  tickBurnStatus,
  tickDotStatus,
} from "./bugStatusRuntime";

describe("bug status runtime", () => {
  it("clears expired statuses and keeps active ones", () => {
    expect(clearExpiredStatus(null, 100)).toBeNull();
    expect(clearExpiredStatus({ expiresAt: 99 }, 100)).toBeNull();
    expect(clearExpiredStatus({ expiresAt: 101 }, 100)).toEqual({
      expiresAt: 101,
    });
  });

  it("ticks dot damage without dropping partial accumulation", () => {
    const result = tickDotStatus(
      {
        accumulatedDmg: 0.4,
        dps: 2,
        expiresAt: 200,
      },
      0.4,
    );

    expect(result.damage).toBe(1);
    expect(result.status?.accumulatedDmg).toBeCloseTo(0.2);
  });

  it("decays burn damage and expires weak flames", () => {
    const active = tickBurnStatus(
      {
        accumulatedDmg: 0,
        decayPerSecond: 1,
        dps: 2,
        expiresAt: 200,
      },
      0.5,
    );

    expect(active.status).not.toBeNull();
    expect(active.status?.dps ?? 0).toBeLessThan(2);

    const expired = tickBurnStatus(
      {
        accumulatedDmg: 0,
        decayPerSecond: 10,
        dps: 0.06,
        expiresAt: 200,
      },
      1,
    );

    expect(expired.status).toBeNull();
  });
});