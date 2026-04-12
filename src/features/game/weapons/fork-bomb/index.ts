/**
 * Fork Bomb — self-registering plugin entry point.
 */

import forkBombDef from "../forkBomb";
import { register } from "@game/weapons/runtime/registry";
import type { WeaponEntry, WeaponContext, FireSession } from "@game/weapons/runtime/types";
import { createSession } from "./behavior";

const entry: WeaponEntry = {
  weaponId: "plasma",
  config: forkBombDef,
  createSession(ctx: WeaponContext): FireSession {
    return createSession(ctx);
  },
};

register(entry);

export { entry as forkBombEntry };
