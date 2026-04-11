/**
 * Weapon registry — single source of truth.
 * Import WEAPON_DEFS from here instead of from weaponConfig.ts in new code.
 */
export type { WeaponDef, HitPattern } from "./types";

import wrench from "./wrench";
import bugSpray from "./bugSpray";
import freezeCone from "./freezeCone";
import chainZap from "./chainZap";
import flamethrower from "./flamethrower";
import laserCutter from "./laserCutter";
import staticNet from "./staticNet";
import nullPointer from "./nullPointer";
import plasmaBomb from "./plasmaBomb";
import voidPulse from "./voidPulse";

export const WEAPON_REGISTRY = [
  wrench,
  bugSpray,
  freezeCone,
  chainZap,
  flamethrower,
  laserCutter,
  staticNet,
  nullPointer,
  plasmaBomb,
  voidPulse,
] as const;

// ─── Self-registering weapon plugins ────────────────────────────────────────
// Side-effect imports: each module calls register() at load time.
// Import order matches WEAPON_REGISTRY for consistency.
import "./wrench/index";
import "./bug-spray/index";
import "./freeze-cone/index";
import "./chain-zap/index";
import "./flame/index";
import "./laser-cutter/index";
import "./static-net/index";
import "./null-pointer/index";
import "./plasma-bomb/index";
import "./void-pulse/index";
