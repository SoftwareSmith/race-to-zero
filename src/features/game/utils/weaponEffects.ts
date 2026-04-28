/**
 * Helpers for managing on-screen weapon fire effect events.
 * Effect events are created when a weapon is fired and cleaned up
 * after their animation completes.
 */

import { WEAPON_DEFS } from "@config/weaponConfig";
import { WeaponId } from "@game/types";
import type { SiegeWeaponId, WeaponEffectEvent } from "@game/types";

/** Duration in ms each weapon's fire animation plays before cleanup. */
export const EFFECT_DURATION: Record<SiegeWeaponId, number> = Object.fromEntries(
  WEAPON_DEFS.map((weapon) => [weapon.id, weapon.overlayEffectDurationMs]),
) as Record<SiegeWeaponId, number>;

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
    targetPoints?: Array<{ x: number; y: number }>;
    targetX?: number;
    targetY?: number;
    color?: string;
    beamWidth?: number;
    beamGlowWidth?: number;
    impactRadius?: number;
    reticleRadius?: number;
    shockwaveRadius?: number;
    chaosScale?: number;
    heatColor?: string;
    heatCore?: string;
    heatScale?: number;
    heatStage?: "warm" | "hot" | "overdrive";
    segments?: Array<{ x1: number; y1: number; x2: number; y2: number }>;
  },
): WeaponEffectEvent {
  // Pre-seed stable jag offsets for chain zap so arcs don't flicker on re-renders
  let jagOffsets: number[] | undefined;
  if (
    weapon === WeaponId.ChainZap &&
    extras?.chainNodes &&
    extras.chainNodes.length > 1
  ) {
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
