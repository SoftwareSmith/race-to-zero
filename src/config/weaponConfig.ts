/**
 * Static definitions for all player weapons.
 * Unlock thresholds, display text, and descriptive copy live here
 * so that progression.ts and UI components share a single source of truth.
 */

import type { BugWeaponId } from "./bugVariants";

export interface WeaponDef {
  id: BugWeaponId;
  title: string;
  /** Number of bug kills required to unlock. 0 = available immediately. */
  unlockKills: number;
  detail: string;
  /** How the weapon resolves hits when fired. */
  hitPattern: "point" | "line" | "area";
  /**
   * Effective hit radius in canvas pixels.
   * For 'point': proximity radius around cursor.
   * For 'area': pulse radius from click origin.
   * For 'line': half-height of the beam for intersection tests.
   */
  hitRadius: number;
  /** CSS hex color used by the on-screen fire animation. */
  effectColor: string;
  /** Minimum milliseconds between player-triggered shots. 0 = unlimited. */
  cooldownMs: number;
}

export const WEAPON_DEFS: WeaponDef[] = [
  {
    id: "hammer",
    title: "Hammer",
    unlockKills: 0,
    detail: "Direct fixes for any bug you can reach.",
    hitPattern: "point",
    hitRadius: 48,
    effectColor: "#fbbf24",
    cooldownMs: 0,
  },
  {
    id: "pulse",
    title: "Pulse",
    unlockKills: 15,
    detail: "Periodic reclaim pulse that clears bugs crawling over frozen panels.",
    hitPattern: "area",
    hitRadius: 140,
    effectColor: "#38bdf8",
    cooldownMs: 800,
  },
  {
    id: "laser",
    title: "Laser",
    unlockKills: 60,
    detail: "Wide reclaim sweep that strips clustered bugs off occupied dashboard zones.",
    hitPattern: "line",
    hitRadius: 12,
    effectColor: "#f87171",
    cooldownMs: 1200,
  },
];

/** Convenience lookup: weapon id → kill threshold. */
export const WEAPON_UNLOCK_THRESHOLDS: Record<BugWeaponId, number> =
  Object.fromEntries(WEAPON_DEFS.map((w) => [w.id, w.unlockKills])) as Record<
    BugWeaponId,
    number
  >;
