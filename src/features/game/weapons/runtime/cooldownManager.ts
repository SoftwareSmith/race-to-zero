/**
 * CooldownManager — pure Map-based cooldown tracking with no React dependencies.
 * The registry seam in BackgroundField delegates cooldown checks here for
 * new-path weapons, keeping all timing state in one place.
 */

import type { SiegeWeaponId } from "@game/weapons/runtime/types";

const _lastFireTime = new Map<SiegeWeaponId, number>();

/** Returns true when the weapon is ready to fire (cooldown elapsed or zero). */
export function canFire(weaponId: SiegeWeaponId, cooldownMs: number): boolean {
  if (cooldownMs <= 0) return true;
  const last = _lastFireTime.get(weaponId) ?? 0;
  return performance.now() - last >= cooldownMs;
}

/** Record that a weapon was just fired (updates lastFireTime to now). */
export function recordFire(weaponId: SiegeWeaponId): void {
  _lastFireTime.set(weaponId, performance.now());
}

/** Get the performance.now() timestamp of the last fire, or 0 if never fired. */
export function getLastFireTime(weaponId: SiegeWeaponId): number {
  return _lastFireTime.get(weaponId) ?? 0;
}

/** Reset all cooldowns — used in tests and between game sessions. */
export function resetCooldowns(): void {
  _lastFireTime.clear();
}
