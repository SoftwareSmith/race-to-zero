/**
 * Turret behavior — aims at the nearest bug then fires after a 500ms lock-on.
 *
 * Two-phase lifecycle:
 *   Aim phase   — starts a 500ms lock-on; emits "aim" callback for tracer VFX.
 *   Fire phase  — resolves when firesAt elapses; re-locks to closest bug at
 *                 original aim position, deals 1 damage, emits "fire" callback.
 */

import type {
  StructureEntry,
  StructureTickContext,
  StructureBehavior,
} from "@game/structures/runtime/types";
import { STRUCTURE_DEFS } from "@config/structureConfig";
import { isTerminalEntityState } from "@game/types";

const SHOOT_RADIUS = 150;
const SHOOT_INTERVAL_MS = 2500;
const AIM_DURATION_MS = 500;

export const turretBehavior: StructureBehavior = {
  structureId: "turret",
  config: STRUCTURE_DEFS.find((s) => s.id === "turret")!,

  tick(entry: StructureEntry, ctx: StructureTickContext): void {
    const { now, engine, callbacks } = ctx;
    const tier = entry.tier ?? 1;
    const shootRadius = SHOOT_RADIUS + (tier - 1) * 18;
    const shotDamage = tier >= 3 ? 2 : 1;
    const intervalMs = Math.max(1200, SHOOT_INTERVAL_MS - (tier - 1) * 350);

    // ── Resolve active aim phase ─────────────────────────────────────────
    if (entry.aimPhase) {
      if (now >= entry.aimPhase.firesAt) {
        const ap = entry.aimPhase;
        entry.aimPhase = null;
        entry.nextCaptureAt = now + intervalMs;

        // Find the bug currently closest to the locked aim position
        const bugs = engine.getEntities();
        let bestDist = Infinity;
        let bestIdx = -1;
        for (let j = 0; j < bugs.length; j++) {
          const e = bugs[j] as any;
          if (isTerminalEntityState(e.state)) continue;
          const d = Math.hypot(e.x - ap.targetX, e.y - ap.targetY);
          if (d < bestDist) {
            bestDist = d;
            bestIdx = j;
          }
        }

        if (bestIdx >= 0) {
          const fireTarget = bugs[bestIdx] as any;
          const angle = Math.atan2(fireTarget.y - entry.y, fireTarget.x - entry.x);
          entry.lastFireAngle = angle;
          const result = engine.handleHit(bestIdx, shotDamage, true);
          if (result?.defeated) {
            try {
              callbacks.onStructureKill?.(entry.id, fireTarget.x, fireTarget.y, fireTarget.variant);
            } catch { void 0; }
          }
          try {
            callbacks.onTurretFire?.({
              structureId: entry.id,
              srcX: entry.x,
              srcY: entry.y,
              targetX: fireTarget.x,
              targetY: fireTarget.y,
              angle,
              phase: "fire",
            });
          } catch { void 0; }
        }
      }
      return;
    }

    if (now < entry.nextCaptureAt) return;

    // ── Find nearest alive bug in range ──────────────────────────────────
    const bugs = engine.getEntities();
    let bestDist = Infinity;
    let bestIdx = -1;
    for (let i = 0; i < bugs.length; i++) {
      const e = bugs[i] as any;
      if (isTerminalEntityState(e.state)) continue;
      const dist = Math.hypot(e.x - entry.x, e.y - entry.y);
      if (dist <= shootRadius && dist < bestDist) {
        bestDist = dist;
        bestIdx = i;
      }
    }

    if (bestIdx < 0) return;

    const target = bugs[bestIdx] as any;
    const angle = Math.atan2(target.y - entry.y, target.x - entry.x);

    entry.aimPhase = {
      targetX: target.x,
      targetY: target.y,
      angle,
      firesAt: now + AIM_DURATION_MS,
    };

    try {
      callbacks.onTurretFire?.({
        structureId: entry.id,
        srcX: entry.x,
        srcY: entry.y,
        targetX: target.x,
        targetY: target.y,
        angle,
        phase: "aim",
      });
    } catch { void 0; }
  },
};
