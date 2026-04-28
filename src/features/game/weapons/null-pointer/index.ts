/**
 * Null Pointer — self-registering plugin entry point.
 */

import { createElement } from "react";
import { def } from "./constants";
import { register, registerOverlay } from "@game/weapons/runtime/registry";
import type { WeaponEntry, WeaponContext, FireSession } from "@game/weapons/runtime/types";
import { createSession } from "./behavior";
import { NullPointerOverlay } from "./overlay";

const entry: WeaponEntry = {
  weaponId: def.id,
  config: def,
  createSession(ctx: WeaponContext): FireSession {
    return createSession(ctx);
  },
};

register(entry);
registerOverlay(def.id, (effect) =>
  createElement(NullPointerOverlay, {
    key: effect.id,
    x: effect.x,
    y: effect.y,
    beamGlowWidth: effect.beamGlowWidth,
    beamWidth: effect.beamWidth,
    chaosScale: effect.chaosScale,
    reticleRadius: effect.reticleRadius,
    shockwaveRadius: effect.shockwaveRadius,
    targetPoints: effect.targetPoints,
    targetX: effect.targetX,
    targetY: effect.targetY,
  }),
);

export { entry as nullPointerEntry };
