/**
 * Bug Spray — behavior plugin (HoldFireSession)
 * Hold to spray a 80° aerosol cone. Each tick:
 *   - Applies poison to bugs in cone
 *   - Spawns a toxic cloud that periodically re-poisons bugs walking through it
 * Trail interpolation (paint) is omitted — spray is omnidirectional mist.
 */

import type {
  WeaponContext,
  HoldFireSession,
  WeaponCommand,
} from "@game/weapons/runtime/types";
import { WeaponId, WeaponTier } from "@game/types";
import { coneAngleAway } from "@game/weapons/runtime/targetingHelpers";

// Spray params
// Cloud poison duration is kept just over the re-apply interval so the
// effect expires within one cycle once the player stops spraying or the
// bug leaves the cloud.  Without this, bugs carry 4 s of poison even after
// moving far away from the cloud.
const POISON_DPS = 0.5;
const POISON_DURATION_MS = 450;  // ~1 interval; expires very quickly outside cloud
const CLOUD_RADIUS = 96;
const CLOUD_MS = 2400;
const CLOUD_INTERVAL_MS = 400;
const T2_SECONDARY_RADIUS = 56;
const T2_SECONDARY_DURATION_MS = 800;
const T3_CLOUD_RADIUS = 144;
const T3_CLOUD_MS = 3200;

function buildTickCommands(ctx: WeaponContext): WeaponCommand[] {
  const { targetX, targetY, centerX, centerY } = ctx;
  const tier = ctx.tier ?? WeaponTier.TIER_ONE;
  const sprayAngle = coneAngleAway(targetX, targetY, centerX, centerY);
  const commands: WeaponCommand[] = [];

  const cloudRadius = tier >= WeaponTier.TIER_THREE ? T3_CLOUD_RADIUS : CLOUD_RADIUS;
  const cloudMs = tier >= WeaponTier.TIER_THREE ? T3_CLOUD_MS : CLOUD_MS;

  // Note: we do NOT apply individual applyPoison per bug here.
  // The repeatPoisonRadius cloud below re-poisons every 400 ms for 2.4-3.2 s,
  // with a 450 ms duration so the effect expires almost immediately once a
  // bug leaves the cloud — preventing phantom kills after the spray ends.

  // Toxic cloud area effect (repeating poison for bugs walking through)
  commands.push({
    kind: "repeatPoisonRadius",
    cx: targetX,
    cy: targetY,
    radius: cloudRadius,
    dps: POISON_DPS,
    durationMs: POISON_DURATION_MS,
    intervalMs: CLOUD_INTERVAL_MS,
    totalMs: cloudMs,
  });

  // T2+: secondary poison cloud around each bug caught in the main spray
  if (tier >= WeaponTier.TIER_TWO) {
    const bugs = ctx.engine.getAllBugs();
    for (const idx of ctx.engine.radiusHitTest(targetX, targetY, cloudRadius)) {
      const bug = bugs[idx];
      if (!bug) continue;
      commands.push({
        kind: "poisonRadius",
        cx: bug.x,
        cy: bug.y,
        radius: T2_SECONDARY_RADIUS,
        dps: POISON_DPS,
        durationMs: T2_SECONDARY_DURATION_MS,
      });
    }
  }

  // VFX: aerosol particles + toxic cloud emitter
  commands.push({
    kind: "spawnEffect",
    descriptor: {
      type: "sprayParticles",
      x: targetX,
      y: targetY,
      angleDeg: sprayAngle,
      coneDeg: 50,
    },
  });
  commands.push({
    kind: "spawnEffect",
    descriptor: {
      type: "toxicCloud",
      x: targetX,
      y: targetY,
      radius: cloudRadius,
      durationMs: cloudMs,
    },
  });

  // Cursor reload bar update (zapper not in OVERLAY_EFFECT_WEAPONS → no SVG event)
  commands.push({
    kind: "spawnEffect",
    descriptor: {
      type: "overlayEffect",
      weaponId: WeaponId.BugSpray,
      viewportX: ctx.viewportX,
      viewportY: ctx.viewportY,
      extras: { angle: sprayAngle * (Math.PI / 180) },
    },
  });

  return commands;
}

export function createSession(_ctx?: WeaponContext): HoldFireSession {
  return {
    mode: "hold",
    begin: buildTickCommands,
    tick: buildTickCommands,
    end() {
      // No cleanup needed for spray
    },
  };
}
