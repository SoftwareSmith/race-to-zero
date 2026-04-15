/**
 * Flamethrower — self-registering plugin entry point.
 */

import { createElement } from "react";
import { def } from "./constants";
import { register, registerOverlay } from "@game/weapons/runtime/registry";
import type { WeaponEntry, WeaponContext, FireSession } from "@game/weapons/runtime/types";
import { createSession } from "./behavior";
import { FlameOverlay } from "./overlay";

const entry: WeaponEntry = {
  weaponId: def.id,
  config: def,
  createSession(): FireSession {
    return createSession();
  },
};

register(entry);
registerOverlay(def.id, (effect) =>
  createElement(FlameOverlay, {
    key: effect.id,
    x: effect.x,
    y: effect.y,
    angle: effect.angle,
  }),
);

export { entry as flameEntry };
