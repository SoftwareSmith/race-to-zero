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
