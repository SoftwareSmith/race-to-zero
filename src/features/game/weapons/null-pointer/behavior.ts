/**
 * Null Pointer — behavior plugin (ClickFireResult)
 *
 * Auto-seeks the highest-HP bug on screen within 500px.
 * Deals 3 direct + 1 splash in 60px radius.
 * VFX fires at the bug's position, not the cursor.
 * SVG overlay traces a line from cursor to target (rocket arc).
 */

import type {
  WeaponContext,
  ClickFireResult,
  WeaponCommand,
} from "@game/weapons/runtime/types";
import { canvasToViewport } from "@game/weapons/runtime/targetingHelpers";

const DAMAGE = 3;
const SPLASH_DAMAGE = 1;
const SEEK_RADIUS = 500;
const SPLASH_RADIUS = 60;

export function createSession(ctx: WeaponContext): ClickFireResult {
  const { engine, targetX, targetY, viewportX, viewportY, bounds } = ctx;
  const commands: WeaponCommand[] = [];

  const targetIdx = engine.closestTargetIndex(targetX, targetY, SEEK_RADIUS);
  const targetBug = targetIdx >= 0 ? engine.getAllBugs()[targetIdx] : null;

  const seekTargetVp = targetBug
    ? canvasToViewport(targetBug.x, targetBug.y, bounds)
    : { x: viewportX, y: viewportY };

  // Always emit overlay — null pointer is in OVERLAY_EFFECT_WEAPONS
  commands.push({
    kind: "spawnEffect",
    descriptor: {
      type: "overlayEffect",
      weaponId: "nullpointer",
      viewportX,
      viewportY,
      extras: {
        targetX: seekTargetVp.x,
        targetY: seekTargetVp.y,
      },
    },
  });

  if (targetIdx < 0 || !targetBug) {
    return { mode: "once", commands };
  }

  // Pixi: explosion + binary burst at bug position
  commands.push({
    kind: "spawnEffect",
    descriptor: {
      type: "explosion",
      x: targetBug.x,
      y: targetBug.y,
      radius: 120,
      colorHex: 0xfb7185,
    },
  });
  commands.push({
    kind: "spawnEffect",
    descriptor: { type: "binaryBurst", x: targetBug.x, y: targetBug.y },
  });

  // Primary target damage
  commands.push({
    kind: "damage",
    targetIndex: targetIdx,
    amount: DAMAGE,
    creditOnDeath: true,
  });

  // Splash damage on nearby bugs (excluding primary)
  const splashIndexes = engine
    .radiusHitTest(targetBug.x, targetBug.y, SPLASH_RADIUS)
    .filter((i) => i !== targetIdx);

  for (const idx of splashIndexes) {
    commands.push({
      kind: "damage",
      targetIndex: idx,
      amount: SPLASH_DAMAGE,
      creditOnDeath: true,
    });
  }

  return { mode: "once", commands };
}
