import { describe, expect, it } from "vitest";
import {
  getSiegeCombatStats,
  getSiegeWeaponSnapshots,
} from "./progression";

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
    expect(stats.unlockedWeapons).not.toContain("freeze");
  });

  it("unlocks freeze at 25 kills but not chain", () => {
    const stats = getSiegeCombatStats(25);
    const snapshots = getSiegeWeaponSnapshots(25, "freeze");

    expect(stats.unlockedWeapons).toContain("freeze");
    expect(stats.unlockedWeapons).not.toContain("chain");
    expect(snapshots.find((s) => s.id === "freeze")?.locked).toBe(false);
    expect(snapshots.find((s) => s.id === "chain")?.locked).toBe(true);
  });

  it("unlocks 8 weapons at 100 kills, all 10 at 130", () => {
    const stats100 = getSiegeCombatStats(100);
    const stats130 = getSiegeCombatStats(130);

    expect(stats100.unlockedWeapons.length).toBe(8);
    expect(stats100.unlockedWeapons).toContain("nullpointer");
    expect(stats100.unlockedWeapons).not.toContain("plasma");
    expect(stats130.unlockedWeapons.length).toBe(10);
    expect(stats130.unlockedWeapons).toContain("void");
  });

  it("label reflects highest unlocked weapon", () => {
    expect(getSiegeCombatStats(0).currentToolLabel).toBe("Hammer");
    expect(getSiegeCombatStats(11).currentToolLabel).toBe("Hammer");
    expect(getSiegeCombatStats(12).currentToolLabel).toBe("Bug Zapper");
    expect(getSiegeCombatStats(100).currentToolLabel).toBe("Null Pointer");
  });
});
