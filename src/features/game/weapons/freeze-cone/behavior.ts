/**
 * Freeze Cone — behavior plugin (ClickFireResult)
 * Area blast: 180px radius, applies freeze (65% slow) to all bugs for 3.5s.
 * No direct damage. Overlay effect fires (freeze has SVG overlay).
 */

import type {
  WeaponContext,
  ClickFireResult,
  WeaponCommand,
} from "@game/weapons/runtime/types";

const HIT_RADIUS = 180;
const FREEZE_INTENSITY = 0.35; // 1 - 0.35 = 65% slow
const FREEZE_DURATION_MS = 3500;
const ENSNARE_DURATION_MS = 3500;

export function createSession(ctx: WeaponContext): ClickFireResult {
  const { engine, targetX, targetY, viewportX, viewportY } = ctx;
  const tier = ctx.tier ?? 1;
  const commands: WeaponCommand[] = [];

  const hitIndexes = engine.radiusHitTest(targetX, targetY, HIT_RADIUS);

  if (tier >= 3) {
    // T3: global slow — hits every bug on the field
    commands.push({
      kind: "applyGlobalSlow",
      multiplier: FREEZE_INTENSITY,
      durationMs: FREEZE_DURATION_MS,
    });
  } else if (tier >= 2) {
    // T2: full ensnare instead of slow
    for (const idx of hitIndexes) {
      commands.push({
        kind: "applyEnsnare",
        targetIndex: idx,
        durationMs: ENSNARE_DURATION_MS,
      });
    }
  } else {
    // T1: standard freeze
    for (const idx of hitIndexes) {
      commands.push({
        kind: "applyFreeze",
        targetIndex: idx,
        intensity: FREEZE_INTENSITY,
        durationMs: FREEZE_DURATION_MS,
      });
    }
  }

  // Pixi: ice explosion ring + snowflake decals
  commands.push({
    kind: "spawnEffect",
    descriptor: {
      type: "explosion",
      x: targetX,
      y: targetY,
      radius: tier >= 3 ? 600 : HIT_RADIUS,
      colorHex: 0x93c5fd,
    },
  });
  commands.push({
    kind: "spawnEffect",
    descriptor: {
      type: "snowflakeDecals",
      x: targetX,
      y: targetY,
      count: tier >= 3 ? 60 : 24,
      radius: tier >= 3 ? 600 : 200,
    },
  });

  // SVG overlay effect (freeze is in OVERLAY_EFFECT_WEAPONS)
  commands.push({
    kind: "spawnEffect",
    descriptor: {
      type: "overlayEffect",
      weaponId: "freeze",
      viewportX,
      viewportY,
    },
  });

  return { mode: "once", commands };
}
