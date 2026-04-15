/**
 * Lantern behavior — attracts nearby bugs into a slow spiral orbit.
 *
 * Physics: tangential push (left-turn) + inward radial pull that
 * strengthens as bugs get closer to the center.
 */

import type {
  StructureEntry,
  StructureTickContext,
  StructureBehavior,
} from "@game/structures/runtime/types";
import { STRUCTURE_DEFS } from "@config/structureConfig";
import { isTerminalEntityState } from "@game/types";

const ATTRACT_RADIUS = 280;
const ORBIT_SPEED = 0.65;   // tangential pixels per tick
const PULL_PX = 0.18;       // inward pull strength

export const lanternBehavior: StructureBehavior = {
  structureId: "lantern",
  config: STRUCTURE_DEFS.find((s) => s.id === "lantern")!,

  tick(entry: StructureEntry, ctx: StructureTickContext): void {
    const tier = entry.tier ?? 1;
    const attractRadius = ATTRACT_RADIUS + (tier - 1) * 35;
    const orbitSpeed = ORBIT_SPEED * (1 + (tier - 1) * 0.15);
    const pullStrength = PULL_PX * (1 + (tier - 1) * 0.2);
    const bugs = ctx.engine.getEntities();
    for (let i = 0; i < bugs.length; i++) {
      const e = bugs[i] as any;
      if (isTerminalEntityState(e.state)) continue;
      const dx = entry.x - e.x;
      const dy = entry.y - e.y;
      const dist = Math.hypot(dx, dy);
      if (dist > attractRadius || dist < 1) continue;

      // Tangential component (left-turn orbit)
      const tx = (-dy / dist) * orbitSpeed;
      const ty = (dx / dist) * orbitSpeed;
      // Inward radial component (diminishing toward edge)
      const inwardFactor = (1 - dist / attractRadius) * pullStrength;
      const rx = (dx / dist) * inwardFactor;
      const ry = (dy / dist) * inwardFactor;

      e.x += tx + rx;
      e.y += ty + ry;
    }
  },
};
