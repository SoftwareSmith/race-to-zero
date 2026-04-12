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
const T2_KNOCKBACK_FORCE = 60;
const T3_DEADLOCK_DURATION_MS = 4000;

export function createSession(ctx: WeaponContext): ClickFireResult {
  const { targetX, targetY, viewportX, viewportY, engine } = ctx;
  const tier = ctx.tier ?? 1;
  const commands: WeaponCommand[] = [];

  if (tier >= 3) {
    // T3: Deadlock Cluster — pulls all bugs toward centroid
    commands.push({
      kind: "startDeadlockCluster",
      cx: targetX,
      cy: targetY,
      radius: HIT_RADIUS,
      pullDurationMs: T3_DEADLOCK_DURATION_MS,
    });
  } else {
    // T1/T2: ensnare area effect
    commands.push({
      kind: "ensnareRadius",
      cx: targetX,
      cy: targetY,
      radius: HIT_RADIUS,
      durationMs: ENSNARE_DURATION_MS,
    });

    if (tier >= 2) {
      // T2: knockback — push all bugs outward from the net center
      const bugs = engine.getAllBugs();
      for (const idx of engine.radiusHitTest(targetX, targetY, HIT_RADIUS)) {
        const bug = bugs[idx];
        if (!bug) continue;
        const dist = Math.hypot(bug.x - targetX, bug.y - targetY);
        if (dist < 1) continue;
        const scale = T2_KNOCKBACK_FORCE / dist;
        commands.push({
          kind: "knockback",
          targetIndex: idx,
          dx: (bug.x - targetX) * scale,
          dy: (bug.y - targetY) * scale,
        });
      }
    }
  }

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
