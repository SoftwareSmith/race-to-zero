/**
 * Freeze Cone — self-registering plugin entry point.
 */

import freezeConeDef from "../freezeCone";
import { register } from "@game/weapons/runtime/registry";
import type { WeaponEntry, WeaponContext, FireSession } from "@game/weapons/runtime/types";
import { createSession } from "./behavior";

const entry: WeaponEntry = {
  weaponId: "freeze",
  config: freezeConeDef,
  createSession(ctx: WeaponContext): FireSession {
    return createSession(ctx);
  },
};

register(entry);

export { entry as freezeConeEntry };
