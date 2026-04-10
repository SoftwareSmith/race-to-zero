import { describe, expect, it } from "vitest";
import {
  getSiegeCombatStats,
  getSiegeWeaponSnapshots,
} from "./progression";

describe("siege progression", () => {
  it("starts with only wrench unlocked", () => {
    const stats = getSiegeCombatStats(0);

    expect(stats.unlockedWeapons).toEqual(["wrench"]);
    expect(stats.currentToolLabel).toBe("Wrench");
  });

  it("unlocks zapper at 10 kills", () => {
    const stats = getSiegeCombatStats(10);

    expect(stats.unlockedWeapons).toContain("wrench");
    expect(stats.unlockedWeapons).toContain("zapper");
    expect(stats.unlockedWeapons).not.toContain("pulse");
  });

  it("unlocks pulse at 15 kills but not freeze", () => {
    const stats = getSiegeCombatStats(15);
    const snapshots = getSiegeWeaponSnapshots(15, "pulse");

    expect(stats.unlockedWeapons).toContain("pulse");
    expect(stats.unlockedWeapons).not.toContain("freeze");
    expect(snapshots.find((s) => s.id === "pulse")?.locked).toBe(false);
    expect(snapshots.find((s) => s.id === "freeze")?.locked).toBe(true);
  });

  it("unlocks all 10 weapons at 100 kills", () => {
    const stats = getSiegeCombatStats(100);

    expect(stats.unlockedWeapons.length).toBe(10);
    expect(stats.unlockedWeapons).toContain("nullpointer");
    expect(stats.unlockedWeapons).toContain("shockwave");
  });

  it("label reflects highest unlocked weapon", () => {
    expect(getSiegeCombatStats(0).currentToolLabel).toBe("Wrench");
    expect(getSiegeCombatStats(9).currentToolLabel).toBe("Wrench");
    expect(getSiegeCombatStats(10).currentToolLabel).toBe("Bug Zapper");
    expect(getSiegeCombatStats(100).currentToolLabel).toBe("Null Pointer");
  });
});
