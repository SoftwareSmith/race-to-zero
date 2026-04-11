/**
 * Wrench — behavior plugin
 * Hit pattern: point | 2 damage | leaves a crack decal
 * Overlay: none (no SVG overlay effect)
 */

import type {
  WeaponContext,
  ClickFireResult,
  WeaponCommand,
} from "@game/weapons/runtime/types";
import { findNearestBugInRadius } from "@game/weapons/runtime/targetingHelpers";

/** Damage per strike. */
const DAMAGE = 2;
/** Hit search radius when engine.hitTest misses. */
const SEARCH_RADIUS = 48;

export function createSession(ctx: WeaponContext): ClickFireResult {
  const { engine, targetX, targetY } = ctx;
  const commands: WeaponCommand[] = [];

  // Always emit the crack decal at the aim point
  commands.push({
    kind: "spawnEffect",
    descriptor: { type: "crack", x: targetX, y: targetY },
  });

  // Enqueue overlay to update cursor fire time + trigger hammer-swing animation
  commands.push({
    kind: "spawnEffect",
    descriptor: {
      type: "overlayEffect",
      weaponId: "wrench",
      viewportX: ctx.viewportX,
      viewportY: ctx.viewportY,
    },
  });

  const hit = findNearestBugInRadius(engine, targetX, targetY, SEARCH_RADIUS);
  if (hit) {
    commands.push({
      kind: "damage",
      targetIndex: hit.index,
      amount: DAMAGE,
      creditOnDeath: true,
    });
  }

  return { mode: "once", commands };
}
