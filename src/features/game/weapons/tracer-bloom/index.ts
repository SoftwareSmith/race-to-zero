/**
 * Tracer Bloom — self-registering plugin entry point.
 */

import { createElement } from "react";
import { def } from "./constants";
import { register, registerOverlay } from "@game/weapons/runtime/registry";
import type { WeaponEntry, WeaponContext, FireSession } from "@game/weapons/runtime/types";
import { createSession } from "./behavior";
import { TracerBloomOverlay } from "./overlay";

const entry: WeaponEntry = {
  weaponId: def.id,
  config: def,
  createSession(ctx: WeaponContext): FireSession {
    return createSession(ctx);
  },
};

register(entry);
registerOverlay(def.id, (effect) =>
  createElement(TracerBloomOverlay, {
    key: effect.id,
    x: effect.x,
    y: effect.y,
    chainNodes: effect.chainNodes,
  }),
);

export { entry as tracerBloomEntry };
