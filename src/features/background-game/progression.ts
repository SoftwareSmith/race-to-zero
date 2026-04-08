import type {
  SiegeCombatStats,
  WeaponProgressSnapshot,
} from "./types";

const UNLOCK_THRESHOLDS = {
  hammer: 0,
  laser: 60,
  pulse: 15,
} as const;

export function getSiegeCombatStats(totalFixed: number): SiegeCombatStats {
  const pulseUnlocked = totalFixed >= UNLOCK_THRESHOLDS.pulse;
  const laserUnlocked = totalFixed >= UNLOCK_THRESHOLDS.laser;

  return {
    hammerDamage: 1,
    pulseUnlocked,
    pulseDamage: 1,
    pulseInterval: Math.max(4200 - totalFixed * 24, 2200),
    pulseVolleyCount: laserUnlocked ? 6 : 4,
    laserUnlocked,
    laserDamage: 1,
    laserInterval: Math.max(6200 - totalFixed * 18, 3400),
    laserVolleyCount: 10,
    currentToolLabel: laserUnlocked
      ? "Hammer + Pulse + Laser"
      : pulseUnlocked
        ? "Hammer + Pulse"
        : "Hammer only",
  };
}

export function getSiegeWeaponSnapshots(
  totalFixed: number,
): WeaponProgressSnapshot[] {
  const stats = getSiegeCombatStats(totalFixed);

  return [
    {
      id: "hammer",
      title: "Hammer",
      locked: false,
      current: !stats.pulseUnlocked,
      detail: "Direct fixes for any bug you can reach.",
      progressText: "Online from first click",
    },
    {
      id: "pulse",
      title: "Pulse",
      locked: !stats.pulseUnlocked,
      current: stats.pulseUnlocked && !stats.laserUnlocked,
      detail: "Periodic reclaim pulse that clears bugs crawling over frozen panels.",
      progressText: stats.pulseUnlocked
        ? `Unlocked at ${UNLOCK_THRESHOLDS.pulse} bugs fixed`
        : `${Math.max(0, UNLOCK_THRESHOLDS.pulse - totalFixed)} fixes to unlock`,
    },
    {
      id: "laser",
      title: "Laser",
      locked: !stats.laserUnlocked,
      current: stats.laserUnlocked,
      detail: "Wide reclaim sweep that strips clustered bugs off occupied dashboard zones.",
      progressText: stats.laserUnlocked
        ? `Unlocked at ${UNLOCK_THRESHOLDS.laser} bugs fixed`
        : `${Math.max(0, UNLOCK_THRESHOLDS.laser - totalFixed)} fixes to unlock`,
    },
  ];
}

export { UNLOCK_THRESHOLDS as SIEGE_UNLOCK_THRESHOLDS };