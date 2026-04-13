/**
 * Bug Spray — self-registering plugin entry point.
 */

import { def } from "./constants";
import { register } from "@game/weapons/runtime/registry";
import type { WeaponEntry, WeaponContext, FireSession } from "@game/weapons/runtime/types";
import { createSession } from "./behavior";

const entry: WeaponEntry = {
  weaponId: def.id,
  config: def,
  createSession(): FireSession {
    return createSession();
  },
};

register(entry);

export { entry as bugSprayEntry };
