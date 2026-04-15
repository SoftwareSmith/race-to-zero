import { describe, expect, it } from "vitest";
import { WEAPON_REGISTRY } from "@game/weapons";
import { WeaponTier } from "@game/types";
import {
  getSiegeCombatStats,
  getSiegeWeaponSnapshots,
} from "./progression";
import type { SiegeWeaponId, WeaponEvolutionState } from "@game/types";

describe("siege progression", () => {
  it("starts with only hammer unlocked", () => {
    const stats = getSiegeCombatStats(0);

    expect(stats.unlockedWeapons).toEqual(["hammer"]);
    expect(stats.currentToolLabel).toBe("Hammer");
  });

  it("unlocks zapper at 12 kills", () => {
    const stats = getSiegeCombatStats(12);

    expect(stats.unlockedWeapons).toContain("hammer");
    expect(stats.unlockedWeapons).toContain("zapper");
    expect(stats.unlockedWeapons).not.toContain("chain");
  });

  it("unlocks chain at 38 kills but not null pointer", () => {
    const stats = getSiegeCombatStats(38);
    const snapshots = getSiegeWeaponSnapshots(38, "chain");

    expect(stats.unlockedWeapons).toContain("chain");
    expect(stats.unlockedWeapons).not.toContain("nullpointer");
    expect(snapshots.find((s) => s.id === "chain")?.locked).toBe(false);
    expect(snapshots.find((s) => s.id === "nullpointer")?.locked).toBe(true);
  });

  it("unlocks 4 weapons at 100 kills, all 6 at 130", () => {
    const stats100 = getSiegeCombatStats(100);
    const stats130 = getSiegeCombatStats(130);

    expect(stats100.unlockedWeapons.length).toBe(4);
    expect(stats100.unlockedWeapons).toContain("nullpointer");
    expect(stats100.unlockedWeapons).not.toContain("plasma");
    expect(stats130.unlockedWeapons.length).toBe(6);
    expect(stats130.unlockedWeapons).toContain("void");
  });

  it("label reflects highest unlocked weapon", () => {
    expect(getSiegeCombatStats(0).currentToolLabel).toBe("Hammer");
    expect(getSiegeCombatStats(11).currentToolLabel).toBe("Hammer");
    expect(getSiegeCombatStats(12).currentToolLabel).toBe("Bug Zapper");
    expect(getSiegeCombatStats(100).currentToolLabel).toBe("Null Pointer");
  });

  it("surfaces evolved tier data in weapon snapshots", () => {
    const evolutionStates: Partial<Record<SiegeWeaponId, WeaponEvolutionState>> = {
      hammer: { tier: 2, kills: 34 },
      void: { tier: 3, kills: 52 },
    };

    const snapshots = getSiegeWeaponSnapshots(
      130,
      "hammer",
      false,
      evolutionStates,
    );

    const hammer = snapshots.find((snapshot) => snapshot.id === "hammer");
    const voidPulse = snapshots.find((snapshot) => snapshot.id === "void");

    expect(hammer).toMatchObject({
      current: true,
      killsToNextTier: 26,
      tier: 2,
      title: "Refactor Tool",
      weaponKills: 34,
    });
    expect(voidPulse).toMatchObject({
      killsToNextTier: null,
      tier: 3,
      title: "Event Horizon",
      weaponKills: 52,
    });
  });

  it("tracks every weapon's tier progression metadata", () => {
    const totalFixed = 999;

    for (const weapon of WEAPON_REGISTRY) {
      const [tierTwoThreshold, tierThreeThreshold] = [
        weapon.tiers[0]?.evolveAtKills ?? 0,
        weapon.tiers[1]?.evolveAtKills ?? Number.MAX_SAFE_INTEGER,
      ];

      const tierOneSnapshot = getSiegeWeaponSnapshots(totalFixed, weapon.id, false, {
        [weapon.id]: { kills: 0, tier: WeaponTier.TIER_ONE },
      }).find((snapshot) => snapshot.id === weapon.id);

      expect(tierOneSnapshot).toMatchObject({
        current: true,
        killsToNextTier: tierTwoThreshold,
        locked: false,
        tier: WeaponTier.TIER_ONE,
        title: weapon.tiers[0]?.title,
        weaponKills: 0,
      });

      const tierTwoSnapshot = getSiegeWeaponSnapshots(totalFixed, weapon.id, false, {
        [weapon.id]: { kills: tierTwoThreshold, tier: WeaponTier.TIER_TWO },
      }).find((snapshot) => snapshot.id === weapon.id);

      expect(tierTwoSnapshot).toMatchObject({
        current: true,
        killsToNextTier: Math.max(0, tierThreeThreshold - tierTwoThreshold),
        locked: false,
        tier: WeaponTier.TIER_TWO,
        title: weapon.tiers[1]?.title,
        weaponKills: tierTwoThreshold,
      });

      const tierThreeSnapshot = getSiegeWeaponSnapshots(totalFixed, weapon.id, false, {
        [weapon.id]: { kills: tierThreeThreshold, tier: WeaponTier.TIER_THREE },
      }).find((snapshot) => snapshot.id === weapon.id);

      expect(tierThreeSnapshot).toMatchObject({
        current: true,
        killsToNextTier: null,
        locked: false,
        tier: WeaponTier.TIER_THREE,
        title: weapon.tiers[2]?.title,
        weaponKills: tierThreeThreshold,
      });
    }
  });
});
