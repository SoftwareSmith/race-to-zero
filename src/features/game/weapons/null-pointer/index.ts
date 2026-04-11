/**
 * Null Pointer — self-registering plugin entry point.
 */

import nullPointerDef from "../nullPointer";
import { register } from "@game/weapons/runtime/registry";
import type { WeaponEntry, WeaponContext, FireSession } from "@game/weapons/runtime/types";
import { createSession } from "./behavior";

const entry: WeaponEntry = {
  weaponId: "nullpointer",
  config: nullPointerDef,
  createSession(ctx: WeaponContext): FireSession {
    return createSession(ctx);
  },
};

register(entry);

export { entry as nullPointerEntry };
