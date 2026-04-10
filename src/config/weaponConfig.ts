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
}

export const WEAPON_DEFS: WeaponDef[] = [
  {
    id: "hammer",
    title: "Hammer",
    unlockKills: 0,
    detail: "Direct fixes for any bug you can reach.",
  },
  {
    id: "pulse",
    title: "Pulse",
    unlockKills: 15,
    detail: "Periodic reclaim pulse that clears bugs crawling over frozen panels.",
  },
  {
    id: "laser",
    title: "Laser",
    unlockKills: 60,
    detail: "Wide reclaim sweep that strips clustered bugs off occupied dashboard zones.",
  },
];

/** Convenience lookup: weapon id → kill threshold. */
export const WEAPON_UNLOCK_THRESHOLDS: Record<BugWeaponId, number> =
  Object.fromEntries(WEAPON_DEFS.map((w) => [w.id, w.unlockKills])) as Record<
    BugWeaponId,
    number
  >;
