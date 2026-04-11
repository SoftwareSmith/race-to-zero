/**
 * Static Net — behavior plugin (ClickFireResult)
 * Wire mesh net: ensnares all bugs in 200px radius for 3s.
 * Ensnared bugs can be insta-killed with a follow-up click (handled by existing
 * wrench instakill path; no changes needed here).
 */

import type {
  WeaponContext,
  ClickFireResult,
  WeaponCommand,
} from "@game/weapons/runtime/types";

const HIT_RADIUS = 200;
const ENSNARE_DURATION_MS = 3000;

export function createSession(ctx: WeaponContext): ClickFireResult {
  const { targetX, targetY, viewportX, viewportY } = ctx;
  const commands: WeaponCommand[] = [];

  // Ensnare area — applies to all bugs in radius
  commands.push({
    kind: "ensnareRadius",
    cx: targetX,
    cy: targetY,
    radius: HIT_RADIUS,
    durationMs: ENSNARE_DURATION_MS,
  });

  // Pixi: net cast + EMP ring
  commands.push({
    kind: "spawnEffect",
    descriptor: {
      type: "netCast",
      x: targetX,
      y: targetY,
      radius: HIT_RADIUS,
      durationMs: 3000,
    },
  });
  commands.push({
    kind: "spawnEffect",
    descriptor: { type: "empBurst", x: targetX, y: targetY, count: 200 },
  });

  // All weapons call enqueueOverlay so the reload bar / cursor animation updates.
  // shockwave is NOT in OVERLAY_EFFECT_WEAPONS so no SVG event is created, but
  // the cursor last-fire time is still tracked inside handleWeaponFire.
  commands.push({
    kind: "spawnEffect",
    descriptor: {
      type: "overlayEffect",
      weaponId: "shockwave",
      viewportX,
      viewportY,
    },
  });

  return { mode: "once", commands };
}
