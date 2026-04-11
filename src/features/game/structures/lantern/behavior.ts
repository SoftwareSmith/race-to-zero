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

const ATTRACT_RADIUS = 280;
const ORBIT_SPEED = 0.65;   // tangential pixels per tick
const PULL_PX = 0.18;       // inward pull strength

export const lanternBehavior: StructureBehavior = {
  structureId: "lantern",
  config: STRUCTURE_DEFS.find((s) => s.id === "lantern")!,

  tick(entry: StructureEntry, ctx: StructureTickContext): void {
    const bugs = ctx.engine.getEntities();
    for (let i = 0; i < bugs.length; i++) {
      const e = bugs[i] as any;
      if (e.state === "dead" || e.state === "dying") continue;
      const dx = entry.x - e.x;
      const dy = entry.y - e.y;
      const dist = Math.hypot(dx, dy);
      if (dist > ATTRACT_RADIUS || dist < 1) continue;

      // Tangential component (left-turn orbit)
      const tx = (-dy / dist) * ORBIT_SPEED;
      const ty = (dx / dist) * ORBIT_SPEED;
      // Inward radial component (diminishing toward edge)
      const inwardFactor = (1 - dist / ATTRACT_RADIUS) * PULL_PX;
      const rx = (dx / dist) * inwardFactor;
      const ry = (dy / dist) * inwardFactor;

      e.x += tx + rx;
      e.y += ty + ry;
    }
  },
};
