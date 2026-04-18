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
import { BASE_TOGGLES } from "./constants";

export function createSession(ctx: WeaponContext): ClickFireResult {
  const { engine, targetX, targetY } = ctx;
  const tier = ctx.tier ?? WeaponTier.TIER_ONE;
  const damage = ctx.config?.damage ?? BASE_TOGGLES.damage;
  const searchRadius = ctx.config?.hitRadius ?? BASE_TOGGLES.hitRadius;
  const allyDurationMs = ctx.config?.allyDurationMs ?? BASE_TOGGLES.allyDurationMs;
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

  const hit = findNearestBugInRadius(engine, targetX, targetY, searchRadius);
  if (hit) {
    if (tier >= WeaponTier.TIER_THREE) {
      // T3: Rewrite Engine keeps the hammer's base hit so progression can
      // continue, then converts surviving bugs into temporary allies.
      commands.push({
        kind: "damage",
        targetIndex: hit.index,
        amount: damage,
        creditOnDeath: true,
      });
      commands.push({
        kind: "allyBug",
        targetIndex: hit.index,
        durationMs: allyDurationMs,
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
          amount: damage,
          creditOnDeath: true,
        });
      }
    } else {
      commands.push({
        kind: "damage",
        targetIndex: hit.index,
        amount: damage,
        creditOnDeath: true,
      });
    }
  }

  return { mode: "once", commands };
}
