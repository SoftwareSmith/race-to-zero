import { describe, expect, it, vi } from "vitest";

import {
  resolveBugStatusRuntime,
  type BugStatusResolutionBurstTarget,
  type BugStatusResolutionTarget,
} from "./bugStatusResolution";

function createBug(): BugStatusResolutionTarget {
  return {
    ally: null,
    baseSize: 12,
    burn: null,
    charged: null,
    ensnare: null,
    fleeTimer: null,
    looped: null,
    marked: null,
    movementMood: "startled",
    opacity: 0.5,
    poison: null,
    size: 20,
    slow: null,
    state: "patrol",
    unstable: null,
    vx: 3,
    vy: -2,
  };
}

describe("bugStatusResolution", () => {
  it("expires ally state, bursts nearby hostiles, and pushes the bug into flee", () => {
    const bug = createBug();
    bug.ally = {
      expireBurstDamage: 4,
      expireBurstRadius: 40,
      expiresAt: 100,
      interceptForce: 2,
    };

    const near: BugStatusResolutionBurstTarget & { distance: number } = {
      distance: 20,
      fleeTimer: null,
      state: "patrol",
    };
    const far: BugStatusResolutionBurstTarget & { distance: number } = {
      distance: 60,
      fleeTimer: null,
      state: "patrol",
    };
    const onBurstHit = vi.fn();

    resolveBugStatusRuntime({
      bug,
      dt: 1 / 60,
      getExpireBurstTargets: () => [near, far],
      getTargetDistance: (target) => target.distance,
      now: 120,
      onBurstHit,
      onSelfDamage: vi.fn(),
      separationRadius: 18,
    });

    expect(onBurstHit).toHaveBeenCalledTimes(1);
    expect(onBurstHit).toHaveBeenCalledWith(near, 4);
    expect(near.state).toBe("flee");
    expect(bug.ally).toBeNull();
    expect(bug.state).toBe("flee");
    expect(bug.fleeTimer).toBe(0.36);
  });

  it("ticks poison, burn, and looped damage through the provided self-damage callback", () => {
    const bug = createBug();
    bug.poison = { accumulatedDmg: 0, dps: 60, expiresAt: 1000 };
    bug.burn = { accumulatedDmg: 0, dps: 120, decayPerSecond: 0, expiresAt: 1000 };
    bug.looped = { accumulatedDmg: 0, dps: 60, expiresAt: 1000 };
    const onSelfDamage = vi.fn();

    resolveBugStatusRuntime({
      bug,
      dt: 1,
      getExpireBurstTargets: () => [],
      getTargetDistance: () => 0,
      now: 100,
      onBurstHit: vi.fn(),
      onSelfDamage,
      separationRadius: 18,
    });

    expect(onSelfDamage).toHaveBeenCalledWith(60, "poison");
    expect(onSelfDamage).toHaveBeenCalledWith(120, "burn");
    expect(onSelfDamage).toHaveBeenCalledWith(60, "looped");
  });

  it("locks movement while ensnared", () => {
    const bug = createBug();
    bug.ensnare = { canInstakill: true, expiresAt: 500 };

    const result = resolveBugStatusRuntime({
      bug,
      dt: 1 / 60,
      getExpireBurstTargets: () => [],
      getTargetDistance: () => 0,
      now: 100,
      onBurstHit: vi.fn(),
      onSelfDamage: vi.fn(),
      separationRadius: 18,
    });

    expect(result.movementLocked).toBe(true);
    expect(bug.vx).toBe(0);
    expect(bug.vy).toBe(0);
    expect(bug.movementMood).toBe("patrol");
    expect(bug.opacity).toBe(1);
    expect(bug.size).toBe(12);
  });
});