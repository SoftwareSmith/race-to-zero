/**
 * Laser Cutter — self-registering plugin entry point.
 */

import laserCutterDef from "../laserCutter";
import { register } from "@game/weapons/runtime/registry";
import type { WeaponEntry, WeaponContext, FireSession } from "@game/weapons/runtime/types";
import { createSession } from "./behavior";

const entry: WeaponEntry = {
  weaponId: "laser",
  config: laserCutterDef,
  createSession(ctx: WeaponContext): FireSession {
    return createSession(ctx);
  },
};

register(entry);

export { entry as laserCutterEntry };
