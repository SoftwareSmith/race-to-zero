/**
 * Chain Zap — self-registering plugin entry point.
 */

import { createElement } from "react";
import { def } from "./constants";
import { register, registerOverlay } from "@game/weapons/runtime/registry";
import type { WeaponEntry, WeaponContext, FireSession } from "@game/weapons/runtime/types";
import { createSession } from "./behavior";
import { ChainOverlay } from "./overlay";

const entry: WeaponEntry = {
  weaponId: def.id,
  config: def,
  createSession(ctx: WeaponContext): FireSession {
    return createSession(ctx);
  },
};

register(entry);
registerOverlay(def.id, (effect) =>
  createElement(ChainOverlay, {
    key: effect.id,
    beamGlowWidth: effect.beamGlowWidth,
    beamWidth: effect.beamWidth,
    x: effect.x,
    y: effect.y,
    chainNodes: effect.chainNodes,
    chaosScale: effect.chaosScale,
    jagOffsets: effect.jagOffsets,
  }),
);

export { entry as chainZapEntry };
