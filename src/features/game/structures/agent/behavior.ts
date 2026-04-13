/**
 * Agent behavior — captures and eliminates the nearest bug every 2 seconds.
 *
 * Two-phase lifecycle:
 *   Phase 1 — find nearest bug in 80px radius, remove it from simulation
 *              immediately, begin pull animation.
 *   Phase 2 — animate bug toward agent during 500ms pull window, then
 *              complete/fail with 20% failure chance.
 */

import type {
  StructureEntry,
  StructureTickContext,
  StructureBehavior,
  BugSnapshot,
} from "@game/structures/runtime/types";
import { STRUCTURE_DEFS } from "@config/structureConfig";
import { isTerminalEntityState } from "@game/types";

const CAPTURE_RADIUS = 80;
const PULL_DURATION_MS = 500;
const RESPAWN_DELAY_MS = 2000;

export const agentBehavior: StructureBehavior = {
  structureId: "agent",
  config: STRUCTURE_DEFS.find((s) => s.id === "agent")!,

  tick(entry: StructureEntry, ctx: StructureTickContext): void {
    const { now, engine, callbacks } = ctx;

    // ── Phase 2: processing an already-captured bug ─────────────────────
    if (entry.absorbing) {
      const pullElapsed = now - entry.absorbing.pullStartedAt;
      if (pullElapsed < PULL_DURATION_MS) {
        // Animate bug position toward agent during pull window
        const t = pullElapsed / PULL_DURATION_MS;
        entry.absorbing.bugX =
          entry.absorbing.pullFromX + (entry.x - entry.absorbing.pullFromX) * t;
        entry.absorbing.bugY =
          entry.absorbing.pullFromY + (entry.y - entry.absorbing.pullFromY) * t;
        try {
          callbacks.onAgentAbsorb?.({
            structureId: entry.id,
            phase: "pulling",
            variant: entry.absorbing.variant,
            bugX: entry.absorbing.bugX,
            bugY: entry.absorbing.bugY,
            srcX: entry.x,
            srcY: entry.y,
          });
        } catch { void 0; }
        return;
      }

      if (now >= entry.absorbing.completesAt) {
        const fail = Math.random() < entry.absorbing.failChance;
        if (!fail) {
          try {
            callbacks.onStructureKill?.(entry.x, entry.y, entry.absorbing.variant);
          } catch { void 0; }
        }
        try {
          callbacks.onAgentAbsorb?.({
            structureId: entry.id,
            phase: fail ? "failed" : "done",
            variant: entry.absorbing.variant,
            bugX: entry.x,
            bugY: entry.y,
            srcX: entry.x,
            srcY: entry.y,
          });
        } catch { void 0; }
        entry.absorbing = null;
        entry.nextCaptureAt = now + RESPAWN_DELAY_MS;
      }
      return;
    }

    if (now < entry.nextCaptureAt) return;

    // ── Phase 1: find and immediately capture nearest bug in range ───────
    const bugs = engine.getEntities();
    let bestDist = Infinity;
    let bestIdx = -1;
    for (let i = 0; i < bugs.length; i++) {
      const e = bugs[i] as any;
      if (isTerminalEntityState(e.state)) continue;
      const dist = Math.hypot(e.x - entry.x, e.y - entry.y);
      if (dist <= CAPTURE_RADIUS && dist < bestDist) {
        bestDist = dist;
        bestIdx = i;
      }
    }

    if (bestIdx < 0) return;

    const captured = bugs[bestIdx] as any;
    const size = captured.size ?? 12;
    const processingMs = Math.round(800 + size * 80);
    entry.absorbing = {
      variant: captured.variant,
      bugX: captured.x,
      bugY: captured.y,
      pullFromX: captured.x,
      pullFromY: captured.y,
      pullStartedAt: now,
      size,
      completesAt: now + PULL_DURATION_MS + processingMs,
      failChance: 0.2,
    };

    // Remove bug from simulation immediately — the pull is purely visual
    const removedBug: BugSnapshot = engine.spliceEntity(bestIdx);
    engine.returnToPool(removedBug);

    try {
      callbacks.onAgentAbsorb?.({
        structureId: entry.id,
        phase: "absorbing",
        variant: captured.variant,
        bugX: captured.x,
        bugY: captured.y,
        srcX: entry.x,
        srcY: entry.y,
        processingMs,
      });
    } catch { void 0; }
  },
};
