/**
 * Flamethrower — behavior plugin (HoldFireSession)
 *
 * Hold to continuously spray fire in a 70° cone. Two modes:
 *   tick()  — cooldown-gated shots: cone hit test, burn per-bug, burn radius patch
 *   paint() — mousemove interpolation: visual-only flame trail + tiny burn radius
 *             (paint fires every frame while dragging between cooldown ticks)
 */

import type {
  WeaponContext,
  HoldFireSession,
  WeaponCommand,
} from "@game/weapons/runtime/types";
import { coneAngleAway } from "@game/weapons/runtime/targetingHelpers";

// Match flamethrower.ts + BackgroundField handler values
const CONE_ARC = 70;
const HIT_RADIUS = 150;
const BURN_DPS = 6;
// Burn duration is kept short so bugs stop burning quickly once they leave
// the cone — prevents phantom kills after the player stops firing.
const BURN_DURATION_MS = 400;
const BURN_DECAY = 3.2;
const PATCH_RADIUS = 90;
const PATCH_MS = 400;
// Trail paint (visual fill between cooldown ticks)
const TRAIL_PATCH_RADIUS = 52;
const TRAIL_PATCH_MS = 180;
const TRAIL_BURN_DPS = 4.5;
const TRAIL_BURN_MS = 400;

function buildTickCommands(ctx: WeaponContext, tier = 1): WeaponCommand[] {
  const { engine, targetX, targetY, centerX, centerY } = ctx;
  const flameDir = coneAngleAway(targetX, targetY, centerX, centerY);
  const commands: WeaponCommand[] = [];

  const hitIndexes = engine.coneHitTest(
    targetX,
    targetY,
    flameDir,
    CONE_ARC,
    HIT_RADIUS,
  );

  for (const idx of hitIndexes) {
    commands.push({
      kind: "damage",
      targetIndex: idx,
      amount: 0,
      creditOnDeath: true,
    });
    // Intensity falls off with distance from muzzle tip
    const bug = engine.getAllBugs()[idx];
    const dist = bug
      ? Math.hypot(bug.x - targetX, bug.y - targetY)
      : HIT_RADIUS * 0.5;
    const norm = dist / Math.max(1, HIT_RADIUS);
    const intensity = 0.2 + 0.8 * Math.exp(-3.2 * norm * norm);
    commands.push({
      kind: "applyBurn",
      targetIndex: idx,
      dps: BURN_DPS * intensity,
      durationMs: BURN_DURATION_MS,
      decayPerSecond: BURN_DECAY,
    });
    // T2: spread fire to nearby bugs around each hit bug
    if (tier >= 2 && bug) {
      commands.push({
        kind: "burnRadius",
        cx: bug.x,
        cy: bug.y,
        radius: 60,
        peakDps: BURN_DPS * 0.5,
        durationMs: BURN_DURATION_MS,
        decayPerSecond: BURN_DECAY,
      });
    }
    // T3: trigger kernel panic explosion on each burning bug
    if (tier >= 3) {
      commands.push({
        kind: "triggerKernelPanic",
        targetIndex: idx,
        splashRadius: 50,
        damage: 2,
      });
    }
  }

  // Ground fire patch at tip
  commands.push({
    kind: "burnRadius",
    cx: targetX,
    cy: targetY,
    radius: PATCH_RADIUS,
    peakDps: BURN_DPS,
    durationMs: BURN_DURATION_MS,
    decayPerSecond: BURN_DECAY,
  });

  // Pixi: large ember burst + persistent fire patch
  commands.push({
    kind: "spawnEffect",
    descriptor: {
      type: "flameTrailBurst",
      x: targetX,
      y: targetY,
      angleDeg: flameDir,
      count: 10,
    },
  });
  commands.push({
    kind: "spawnEffect",
    descriptor: {
      type: "firePatch",
      x: targetX,
      y: targetY,
      radius: PATCH_RADIUS,
      durationMs: PATCH_MS,
    },
  });

  // SVG overlay (flame is in OVERLAY_EFFECT_WEAPONS — always enqueue)
  // Note: extras includes angle so the WeaponEffectLayer can render cone gfx
  commands.push({
    kind: "spawnEffect",
    descriptor: {
      type: "overlayEffect",
      weaponId: "flame",
      viewportX: ctx.viewportX,
      viewportY: ctx.viewportY,
      extras: { angle: (flameDir * Math.PI) / 180 },
    },
  });

  return commands;
}

function buildPaintCommands(ctx: WeaponContext): WeaponCommand[] {
  const { targetX, targetY, centerX, centerY } = ctx;
  const flameDir = coneAngleAway(targetX, targetY, centerX, centerY);
  const commands: WeaponCommand[] = [];

  // Small trail burn (catches bugs crossing the drag path)
  commands.push({
    kind: "burnRadius",
    cx: targetX,
    cy: targetY,
    radius: TRAIL_PATCH_RADIUS,
    peakDps: TRAIL_BURN_DPS,
    durationMs: TRAIL_BURN_MS,
    decayPerSecond: BURN_DECAY,
  });

  // Visual-only flame trail
  commands.push({
    kind: "spawnEffect",
    descriptor: {
      type: "flameTrailBurst",
      x: targetX,
      y: targetY,
      angleDeg: flameDir,
      count: 4,
    },
  });
  commands.push({
    kind: "spawnEffect",
    descriptor: {
      type: "fireTrailStamp",
      x: targetX,
      y: targetY,
      radius: TRAIL_PATCH_RADIUS,
      durationMs: TRAIL_PATCH_MS,
    },
  });

  return commands;
}

export function createSession(_ctx?: WeaponContext): HoldFireSession {
  const tier = _ctx?.tier ?? 1;
  return {
    mode: "hold",
    begin(ctx: WeaponContext): WeaponCommand[] { return buildTickCommands(ctx, tier); },
    tick(ctx: WeaponContext): WeaponCommand[] { return buildTickCommands(ctx, tier); },
    paint: buildPaintCommands,
    end() {
      // No cleanup needed
    },
  };
}
