/**
 * Flamethrower — self-registering plugin entry point.
 */

import flamethrowerDef from "../flamethrower";
import { register } from "@game/weapons/runtime/registry";
import type { WeaponEntry, WeaponContext, FireSession } from "@game/weapons/runtime/types";
import { createSession } from "./behavior";

const entry: WeaponEntry = {
  weaponId: "flame",
  config: flamethrowerDef,
  createSession(_ctx: WeaponContext): FireSession {
    return createSession();
  },
};

register(entry);

export { entry as flameEntry };
