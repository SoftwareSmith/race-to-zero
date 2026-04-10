import { describe, expect, it } from "vitest";
import {
  getSiegeCombatStats,
  getSiegeWeaponSnapshots,
} from "./progression";

describe("siege progression", () => {
  it("starts with hammer only", () => {
    const stats = getSiegeCombatStats(0);

    expect(stats.pulseUnlocked).toBe(false);
    expect(stats.laserUnlocked).toBe(false);
    expect(stats.currentToolLabel).toBe("Hammer only");
  });

  it("unlocks pulse before laser", () => {
    const stats = getSiegeCombatStats(18);
    const snapshots = getSiegeWeaponSnapshots(18, "pulse");

    expect(stats.pulseUnlocked).toBe(true);
    expect(stats.laserUnlocked).toBe(false);
    expect(snapshots.find((entry) => entry.id === "pulse")?.locked).toBe(false);
    expect(snapshots.find((entry) => entry.id === "laser")?.locked).toBe(true);
  });

  it("unlocks the full reclaim stack at higher kill counts", () => {
    const stats = getSiegeCombatStats(80);

    expect(stats.pulseUnlocked).toBe(true);
    expect(stats.laserUnlocked).toBe(true);
    expect(stats.currentToolLabel).toBe("Hammer + Pulse + Laser");
  });
});