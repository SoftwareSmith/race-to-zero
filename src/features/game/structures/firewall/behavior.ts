/**
 * Firewall behavior — a horizontal burn strip that damages bugs whose X
 * coordinate falls within ±20px of the structure, ticking every 800ms.
 *
 * Expiry is handled by Engine.ts (strips structures where
 * `elapsedMs - placedAt >= 8000`) before tickStructures iterates.
 */

import type {
  StructureEntry,
  StructureTickContext,
  StructureBehavior,
} from "@game/structures/runtime/types";
import { STRUCTURE_DEFS } from "@config/structureConfig";
import { isTerminalEntityState } from "@game/types";

const WALL_HALF_WIDTH = 20;
const DAMAGE_INTERVAL_MS = 800;

export const firewallBehavior: StructureBehavior = {
  structureId: "firewall",
  config: STRUCTURE_DEFS.find((s) => s.id === "firewall")!,

  tick(entry: StructureEntry, ctx: StructureTickContext): void {
    const { now, engine, callbacks } = ctx;
    const tier = entry.tier ?? 1;
    const wallHalfWidth = WALL_HALF_WIDTH + (tier - 1) * 8;
    const tickDamage = tier >= 3 ? 2 : 1;
    const damageIntervalMs = Math.max(350, DAMAGE_INTERVAL_MS - (tier - 1) * 180);

    if (now < (entry.firewallNextDamageAt ?? 0)) return;
    entry.firewallNextDamageAt = now + damageIntervalMs;

    const bugs = engine.getEntities();
    for (let i = 0; i < bugs.length; i++) {
      const e = bugs[i] as any;
      if (isTerminalEntityState(e.state)) continue;
      if (Math.abs(e.x - entry.x) <= wallHalfWidth) {
        const result = engine.handleHit(i, tickDamage, true);
        if (result?.defeated) {
          try {
            callbacks.onStructureKill?.(entry.id, e.x, e.y, e.variant);
          } catch { void 0; }
        }
      }
    }
  },
};
