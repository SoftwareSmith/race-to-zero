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
import { coneAngleAway } from "@game/weapons/runtime/targetingHelpers";

// Spray params (match bugSpray.ts + BackgroundField handler)
const CONE_ARC = 80;
const HIT_RADIUS = 120;
const DAMAGE = 0;
const POISON_DPS = 0.5;
const POISON_DURATION_MS = 4000;
const CLOUD_RADIUS = 96;
const CLOUD_MS = 2400;
const CLOUD_INTERVAL_MS = 400;

function buildTickCommands(ctx: WeaponContext): WeaponCommand[] {
  const { engine, targetX, targetY, centerX, centerY } = ctx;
  const sprayAngle = coneAngleAway(targetX, targetY, centerX, centerY);

  const hitIndexes = engine.coneHitTest(
    targetX,
    targetY,
    sprayAngle,
    CONE_ARC,
    HIT_RADIUS,
  );

  const commands: WeaponCommand[] = [];

  for (const idx of hitIndexes) {
    commands.push({
      kind: "damage",
      targetIndex: idx,
      amount: DAMAGE,
      creditOnDeath: true,
    });
    commands.push({
      kind: "applyPoison",
      targetIndex: idx,
      dps: POISON_DPS,
      durationMs: POISON_DURATION_MS,
    });
  }

  // Toxic cloud area effect (repeating poison for bugs walking through)
  commands.push({
    kind: "repeatPoisonRadius",
    cx: targetX,
    cy: targetY,
    radius: CLOUD_RADIUS,
    dps: POISON_DPS,
    durationMs: POISON_DURATION_MS,
    intervalMs: CLOUD_INTERVAL_MS,
    totalMs: CLOUD_MS,
  });

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
      radius: CLOUD_RADIUS,
      durationMs: CLOUD_MS,
    },
  });

  // Cursor reload bar update (zapper not in OVERLAY_EFFECT_WEAPONS → no SVG event)
  commands.push({
    kind: "spawnEffect",
    descriptor: {
      type: "overlayEffect",
      weaponId: "zapper",
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
