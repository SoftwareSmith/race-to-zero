/**
 * Weapon registry — single source of truth.
 * Import WEAPON_DEFS from here instead of from weaponConfig.ts in new code.
 */
export { HitPattern, WeaponInputMode } from "./types";
export type { WeaponDef } from "./types";

import { def as hammer }      from "./hammer/constants";
import { def as nullPointer } from "./null-pointer/constants";
import { def as chainZap }    from "./chain-zap/constants";
import { def as forkBomb }    from "./fork-bomb/constants";
import { def as bugSpray }    from "./bug-spray/constants";
import { def as voidPulse }   from "./void-pulse/constants";

export const WEAPON_REGISTRY = [
  hammer,
  nullPointer,
  chainZap,
  forkBomb,
  bugSpray,
  voidPulse,
] as const;

// ─── Self-registering weapon plugins ────────────────────────────────────────
// Side-effect imports: each module calls register() at load time.
// Import order matches WEAPON_REGISTRY for consistency.
import "./hammer/index";
import "./null-pointer/index";
import "./chain-zap/index";
import "./fork-bomb/index";
import "./bug-spray/index";
import "./void-pulse/index";
