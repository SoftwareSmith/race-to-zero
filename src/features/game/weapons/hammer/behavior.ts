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
import { WeaponId, WeaponTier } from "@game/types";
import { findNearestBugInRadius } from "@game/weapons/runtime/targetingHelpers";

/** Damage per strike. */
const DAMAGE = 2;
/** Hit search radius when engine.hitTest misses. */
const SEARCH_RADIUS = 48;
/** T3: ally conversion duration. */
const T3_ALLY_DURATION_MS = 8000;

export function createSession(ctx: WeaponContext): ClickFireResult {
  const { engine, targetX, targetY } = ctx;
  const tier = ctx.tier ?? WeaponTier.TIER_ONE;
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
      weaponId: WeaponId.Hammer,
      viewportX: ctx.viewportX,
      viewportY: ctx.viewportY,
    },
  });

  const hit = findNearestBugInRadius(engine, targetX, targetY, SEARCH_RADIUS);
  if (hit) {
    if (tier >= WeaponTier.TIER_THREE) {
      // T3: Rewrite Engine — convert bug to ally for 8 s
      commands.push({
        kind: "allyBug",
        targetIndex: hit.index,
        durationMs: T3_ALLY_DURATION_MS,
      });
    } else if (tier >= WeaponTier.TIER_TWO) {
      // T2: Refactor Tool — split healthy bugs; damage near-dead ones
      const bugs = engine.getAllBugs();
      const bug = bugs[hit.index];
      const hp = bug?.hp ?? 0;
      if (hp > 2) {
        commands.push({ kind: "splitBug", targetIndex: hit.index });
      } else {
        commands.push({
          kind: "damage",
          targetIndex: hit.index,
          amount: DAMAGE,
          creditOnDeath: true,
        });
      }
    } else {
      commands.push({
        kind: "damage",
        targetIndex: hit.index,
        amount: DAMAGE,
        creditOnDeath: true,
      });
    }
  }

  return { mode: "once", commands };
}
