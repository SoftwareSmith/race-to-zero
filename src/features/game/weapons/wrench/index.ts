/**
 * Wrench — self-registering plugin entry point.
 * Import this file (or re-export from weapons/index.ts) to register the weapon.
 */

// Relative import avoids ambiguity between this folder and the legacy wrench.ts
import wrenchDef from "../wrench";
import { register } from "@game/weapons/runtime/registry";
import type { WeaponEntry, WeaponContext, FireSession } from "@game/weapons/runtime/types";
import { createSession } from "./behavior";

const entry: WeaponEntry = {
  weaponId: "wrench",
  config: wrenchDef,
  createSession(ctx: WeaponContext): FireSession {
    return createSession(ctx);
  },
};

register(entry);

export { entry as wrenchEntry };
