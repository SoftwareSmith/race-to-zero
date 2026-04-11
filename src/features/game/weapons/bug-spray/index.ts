/**
 * Bug Spray — self-registering plugin entry point.
 */

import bugSprayDef from "../bugSpray";
import { register } from "@game/weapons/runtime/registry";
import type { WeaponEntry, WeaponContext, FireSession } from "@game/weapons/runtime/types";
import { createSession } from "./behavior";

const entry: WeaponEntry = {
  weaponId: "zapper",
  config: bugSprayDef,
  createSession(_ctx: WeaponContext): FireSession {
    return createSession();
  },
};

register(entry);

export { entry as bugSprayEntry };
