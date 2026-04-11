/**
 * Void Pulse — self-registering plugin entry point.
 */

import voidPulseDef from "../voidPulse";
import { register } from "@game/weapons/runtime/registry";
import type { WeaponEntry, WeaponContext, FireSession } from "@game/weapons/runtime/types";
import { createSession } from "./behavior";

const entry: WeaponEntry = {
  weaponId: "void",
  config: voidPulseDef,
  createSession(ctx: WeaponContext): FireSession {
    return createSession(ctx);
  },
};

register(entry);

export { entry as voidPulseEntry };
