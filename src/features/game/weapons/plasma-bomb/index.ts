/**
 * Plasma Bomb — self-registering plugin entry point.
 */

import plasmaBombDef from "../plasmaBomb";
import { register } from "@game/weapons/runtime/registry";
import type { WeaponEntry, WeaponContext, FireSession } from "@game/weapons/runtime/types";
import { createSession } from "./behavior";

const entry: WeaponEntry = {
  weaponId: "plasma",
  config: plasmaBombDef,
  createSession(_ctx: WeaponContext): FireSession {
    return createSession();
  },
};

register(entry);

export { entry as plasmaBombEntry };
