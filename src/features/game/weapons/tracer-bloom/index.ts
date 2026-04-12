/**
 * Tracer Bloom — self-registering plugin entry point.
 */

import tracerBloomDef from "../tracerBloom";
import { register } from "@game/weapons/runtime/registry";
import type { WeaponEntry, WeaponContext, FireSession } from "@game/weapons/runtime/types";
import { createSession } from "./behavior";

const entry: WeaponEntry = {
  weaponId: "laser",
  config: tracerBloomDef,
  createSession(ctx: WeaponContext): FireSession {
    return createSession(ctx);
  },
};

register(entry);

export { entry as tracerBloomEntry };
