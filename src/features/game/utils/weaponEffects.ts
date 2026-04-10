/**
 * Helpers for managing on-screen weapon fire effect events.
 * Effect events are created when a weapon is fired and cleaned up
 * after their animation completes.
 */

import type { SiegeWeaponId, WeaponEffectEvent } from "@game/types";

/** Duration in ms each weapon's fire animation plays before cleanup. */
export const EFFECT_DURATION: Record<SiegeWeaponId, number> = {
  wrench: 520,
  zapper: 700,
  pulse: 600,
  pointer: 320,
  freeze: 700,
  chain: 800,
  laser: 320,
  bomb: 1000,
  shockwave: 900,
  nullpointer: 1200,
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
  extras?: {
    angle?: number;
    chainNodes?: Array<{ x: number; y: number }>;
    targetX?: number;
    targetY?: number;
    color?: string;
  },
): WeaponEffectEvent {
  // Pre-seed stable jag offsets for chain zap so arcs don't flicker on re-renders
  let jagOffsets: number[] | undefined;
  if (weapon === "chain" && extras?.chainNodes && extras.chainNodes.length > 1) {
    const segCount = extras.chainNodes.length - 1;
    jagOffsets = [];
    for (let i = 0; i < segCount; i++) {
      jagOffsets.push((Math.random() - 0.5) * 28, (Math.random() - 0.5) * 28);
    }
  }

  return {
    id: `${weapon}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    weapon,
    x,
    y,
    startedAt: performance.now(),
    ...(jagOffsets ? { jagOffsets } : {}),
    ...extras,
  };
}
