/**
 * Weapon registry — single source of truth.
 * Import WEAPON_DEFS from here instead of from weaponConfig.ts in new code.
 */
export type { WeaponDef, HitPattern } from "./types";

import hammer from "./hammer";
import bugSpray from "./bugSpray";
import freezeCone from "./freezeCone";
import chainZap from "./chainZap";
import flamethrower from "./flamethrower";
import tracerBloom from "./tracerBloom";
import staticNet from "./staticNet";
import nullPointer from "./nullPointer";
import forkBomb from "./forkBomb";
import voidPulse from "./voidPulse";

export const WEAPON_REGISTRY = [
  hammer,
  bugSpray,
  freezeCone,
  chainZap,
  flamethrower,
  tracerBloom,
  staticNet,
  nullPointer,
  forkBomb,
  voidPulse,
] as const;

// ─── Self-registering weapon plugins ────────────────────────────────────────
// Side-effect imports: each module calls register() at load time.
// Import order matches WEAPON_REGISTRY for consistency.
import "./hammer/index";
import "./bug-spray/index";
import "./freeze-cone/index";
import "./chain-zap/index";
import "./flame/index";
import "./tracer-bloom/index";
import "./static-net/index";
import "./null-pointer/index";
import "./fork-bomb/index";
import "./void-pulse/index";
