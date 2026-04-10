/**
 * Helpers for managing on-screen weapon fire effect events.
 * Effect events are created when a weapon is fired and cleaned up
 * after their animation completes.
 */

import type { SiegeWeaponId, WeaponEffectEvent } from "@game/types";

/** Duration in ms each weapon's fire animation plays before cleanup. */
export const EFFECT_DURATION: Record<SiegeWeaponId, number> = {
  hammer: 520,
  laser: 320,
  pulse: 600,
};

/** Returns true if the effect animation is still playing. */
export function isEffectAlive(event: WeaponEffectEvent, now: number): boolean {
  return now - event.startedAt < EFFECT_DURATION[event.weapon];
}

/** Build a new effect event from a weapon fire at viewport (x, y). */
export function createEffectEvent(
  weapon: SiegeWeaponId,
  x: number,
  y: number,
): WeaponEffectEvent {
  return {
    id: `${weapon}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    weapon,
    x,
    y,
    startedAt: performance.now(),
  };
}
