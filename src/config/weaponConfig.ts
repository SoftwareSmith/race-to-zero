/**
 * Static definitions for all player weapons.
 * Re-exports the new per-weapon registry so old @config/weaponConfig imports
 * continue to work without changes.
 */

import type { SiegeWeaponId } from "../features/game/types";
import { WEAPON_REGISTRY } from "../features/game/weapons/index";
import type { WeaponDef as _WeaponDef } from "../features/game/weapons/types";

export type { SiegeWeaponId };

// Re-export the type so existing usages compile.
export type WeaponDef = _WeaponDef;

/** All weapon definitions — sourced from the per-weapon registry. */
export const WEAPON_DEFS: WeaponDef[] = [...WEAPON_REGISTRY] as WeaponDef[];

/** Convenience lookup: weapon id → kill threshold. */
export const WEAPON_UNLOCK_THRESHOLDS: Record<SiegeWeaponId, number> =
  Object.fromEntries(WEAPON_DEFS.map((w) => [w.id, w.unlockKills])) as Record<
    SiegeWeaponId,
    number
  >;
