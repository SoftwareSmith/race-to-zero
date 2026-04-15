/**
 * Tesla Coil behavior — chain-zaps up to 3 nearest bugs every 2.5 seconds.
 *
 * Sorts bugs in range by distance, takes ≤ MAX_HOPS, deals 1 damage each,
 * then emits the onTeslaFire callback with the chain node positions for VFX.
 */

import type {
  StructureEntry,
  StructureTickContext,
  StructureBehavior,
} from "@game/structures/runtime/types";
import { STRUCTURE_DEFS } from "@config/structureConfig";
import { isTerminalEntityState } from "@game/types";

const SHOOT_RADIUS = 120;
const SHOOT_INTERVAL_MS = 2500;
const MAX_HOPS = 3;

export const teslaBehavior: StructureBehavior = {
  structureId: "tesla",
  config: STRUCTURE_DEFS.find((s) => s.id === "tesla")!,

  tick(entry: StructureEntry, ctx: StructureTickContext): void {
    const { now, engine, callbacks } = ctx;
    const tier = entry.tier ?? 1;
    const shootRadius = SHOOT_RADIUS + (tier - 1) * 18;
    const maxHops = MAX_HOPS + (tier - 1);
    const zapDamage = tier >= 3 ? 2 : 1;
    const intervalMs = Math.max(1200, SHOOT_INTERVAL_MS - (tier - 1) * 300);

    if (now < entry.nextCaptureAt) return;

    // Gather alive bugs within radius, sorted by distance
    const bugs = engine.getEntities();
    const candidates: Array<{ idx: number; dist: number }> = [];
    for (let i = 0; i < bugs.length; i++) {
      const e = bugs[i] as any;
      if (isTerminalEntityState(e.state)) continue;
      const dist = Math.hypot(e.x - entry.x, e.y - entry.y);
      if (dist <= shootRadius) candidates.push({ idx: i, dist });
    }

    if (candidates.length === 0) return;

    candidates.sort((a, b) => a.dist - b.dist);
    const targets = candidates.slice(0, maxHops);

    entry.nextCaptureAt = now + intervalMs;

    // Build chain nodes: coil origin → each bug
    const nodes: Array<{ x: number; y: number }> = [{ x: entry.x, y: entry.y }];
    for (const { idx } of targets) {
      const e = bugs[idx] as any;
      nodes.push({ x: e.x, y: e.y });
      const result = engine.handleHit(idx, zapDamage, true);
      if (result?.defeated) {
        try {
          callbacks.onStructureKill?.(entry.id, e.x, e.y, e.variant);
        } catch { void 0; }
      }
    }

    try {
      callbacks.onTeslaFire?.({ structureId: entry.id, nodes });
    } catch { void 0; }
  },
};
