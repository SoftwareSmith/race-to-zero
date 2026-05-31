import { describe, expect, it, vi } from "vitest";

import { WEAPON_EVOLVE_THRESHOLDS } from "@config/weaponEvolutionThresholds";
import { WeaponTier } from "@game/types";
import { WeaponEvolutionTracker } from "./weaponEvolutionTracker";

describe("WeaponEvolutionTracker", () => {
  it("promotes through thresholds and fires callbacks once per tier", () => {
    const onWeaponEvolution = vi.fn();
    const tracker = new WeaponEvolutionTracker({
      maxWeaponTier: WeaponTier.TIER_THREE,
      onWeaponEvolution,
    });
    const [tierTwoThreshold, tierThreeThreshold] = WEAPON_EVOLVE_THRESHOLDS.hammer;

    for (let index = 0; index < tierTwoThreshold; index += 1) {
      tracker.recordKill("hammer");
    }

    expect(tracker.getStates().get("hammer")).toMatchObject({
      kills: tierTwoThreshold,
      tier: WeaponTier.TIER_TWO,
    });

    for (let index = tierTwoThreshold; index < tierThreeThreshold; index += 1) {
      tracker.recordKill("hammer");
    }

    expect(tracker.getStates().get("hammer")).toMatchObject({
      kills: tierThreeThreshold,
      tier: WeaponTier.TIER_THREE,
    });
    expect(onWeaponEvolution).toHaveBeenNthCalledWith(
      1,
      "hammer",
      WeaponTier.TIER_TWO,
    );
    expect(onWeaponEvolution).toHaveBeenNthCalledWith(
      2,
      "hammer",
      WeaponTier.TIER_THREE,
    );
  });

  it("clamps seeded tiers to the active max tier", () => {
    const tracker = new WeaponEvolutionTracker({
      initialEvolutionStates: {
        hammer: { kills: 999, tier: WeaponTier.TIER_FIVE },
      },
      maxWeaponTier: WeaponTier.TIER_THREE,
    });

    expect(tracker.getStates().get("hammer")).toMatchObject({
      kills: 999,
      tier: WeaponTier.TIER_THREE,
    });
  });
});