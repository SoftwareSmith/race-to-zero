import type {
  SiegeCombatStats,
  WeaponProgressSnapshot,
} from "@game/types";
import { WEAPON_DEFS, WEAPON_UNLOCK_THRESHOLDS } from "@config/weaponConfig";

export function getSiegeCombatStats(totalFixed: number): SiegeCombatStats {
  const pulseUnlocked = totalFixed >= WEAPON_UNLOCK_THRESHOLDS.pulse;
  const laserUnlocked = totalFixed >= WEAPON_UNLOCK_THRESHOLDS.laser;

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
  const unlockedMap: Record<string, boolean> = {
    hammer: true,
    pulse: stats.pulseUnlocked,
    laser: stats.laserUnlocked,
  };
  const currentMap: Record<string, boolean> = {
    hammer: !stats.pulseUnlocked,
    pulse: stats.pulseUnlocked && !stats.laserUnlocked,
    laser: stats.laserUnlocked,
  };

  return WEAPON_DEFS.map((weapon) => {
    const unlocked = unlockedMap[weapon.id] ?? false;
    const remaining = Math.max(0, weapon.unlockKills - totalFixed);
    return {
      id: weapon.id,
      title: weapon.title,
      locked: !unlocked,
      current: currentMap[weapon.id] ?? false,
      detail: weapon.detail,
      progressText:
        weapon.unlockKills === 0
          ? "Online from first click"
          : unlocked
            ? `Unlocked at ${weapon.unlockKills} bugs fixed`
            : `${remaining} fixes to unlock`,
    };
  });
}

export { WEAPON_UNLOCK_THRESHOLDS as SIEGE_UNLOCK_THRESHOLDS };