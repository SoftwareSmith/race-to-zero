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
import { BASE_TOGGLES } from "./constants";

function buildTickCommands(ctx: WeaponContext): WeaponCommand[] {
  const { targetX, targetY, centerX, centerY } = ctx;
  const sprayAngle = coneAngleAway(targetX, targetY, centerX, centerY);
  const sprayRadians = (sprayAngle * Math.PI) / 180;
  const commands: WeaponCommand[] = [];
  const tier = ctx.tier ?? WeaponTier.TIER_ONE;
  const poisonDps = ctx.config?.poisonDps ?? BASE_TOGGLES.poisonDps;
  const poisonDurationMs =
    ctx.config?.poisonDurationMs ?? BASE_TOGGLES.poisonDurationMs;
  const cloudRadius = ctx.config?.cloudRadius ?? BASE_TOGGLES.cloudRadius;
  const cloudMs = ctx.config?.cloudDurationMs ?? BASE_TOGGLES.cloudDurationMs;
  const cloudIntervalMs =
    ctx.config?.cloudIntervalMs ?? BASE_TOGGLES.cloudIntervalMs;
  const secondaryRadius =
    ctx.config?.secondaryRadius ?? BASE_TOGGLES.secondaryRadius;
  const secondaryDurationMs =
    ctx.config?.secondaryDurationMs ?? BASE_TOGGLES.secondaryDurationMs;

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
    dps: poisonDps,
    durationMs: poisonDurationMs,
    intervalMs: cloudIntervalMs,
    totalMs: cloudMs,
  });

  if (tier >= WeaponTier.TIER_FOUR) {
    const frontDistance = Math.max(cloudRadius * 0.55, 78);
    const frontX = targetX + Math.cos(sprayRadians) * frontDistance;
    const frontY = targetY + Math.sin(sprayRadians) * frontDistance;

    commands.push({
      kind: "repeatPoisonRadius",
      cx: frontX,
      cy: frontY,
      radius: Math.max(cloudRadius * 0.88, 144),
      dps: poisonDps,
      durationMs: poisonDurationMs + 120,
      intervalMs: Math.max(180, cloudIntervalMs - 60),
      totalMs: cloudMs,
    });
    commands.push({
      kind: "ensnareRadius",
      cx: frontX,
      cy: frontY,
      radius: Math.max(cloudRadius * 0.72, 112),
      durationMs: Math.max(1500, secondaryDurationMs * 2),
    });
    commands.push({
      kind: "spawnEffect",
      descriptor: {
        type: "toxicCloud",
        x: frontX,
        y: frontY,
        radius: Math.max(cloudRadius * 0.82, 140),
        durationMs: cloudMs,
      },
    });
  }

  if (tier >= WeaponTier.TIER_FIVE) {
    const lateralAngle = sprayRadians + Math.PI / 2;
    const frontDistance = Math.max(cloudRadius * 0.68, 104);
    const frontX = targetX + Math.cos(sprayRadians) * frontDistance;
    const frontY = targetY + Math.sin(sprayRadians) * frontDistance;
    const lateralOffset = Math.max(cloudRadius * 0.5, 90);
    const flankClouds = [-1, 1].map((direction) => ({
      x: frontX + Math.cos(lateralAngle) * lateralOffset * direction,
      y: frontY + Math.sin(lateralAngle) * lateralOffset * direction,
    }));

    for (const cloud of flankClouds) {
      commands.push({
        kind: "repeatPoisonRadius",
        cx: cloud.x,
        cy: cloud.y,
        radius: Math.max(cloudRadius * 0.92, 156),
        dps: poisonDps + 0.08,
        durationMs: poisonDurationMs + 200,
        intervalMs: Math.max(160, cloudIntervalMs - 90),
        totalMs: cloudMs + 300,
      });
      commands.push({
        kind: "poisonRadius",
        cx: cloud.x,
        cy: cloud.y,
        radius: Math.max(secondaryRadius * 1.45, 112),
        dps: poisonDps + 0.08,
        durationMs: Math.max(secondaryDurationMs * 2, 1600),
      });
      commands.push({
        kind: "spawnEffect",
        descriptor: {
          type: "toxicCloud",
          x: cloud.x,
          y: cloud.y,
          radius: Math.max(cloudRadius * 0.88, 148),
          durationMs: cloudMs + 300,
        },
      });
    }
  }

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
        radius: secondaryRadius,
        dps: poisonDps,
        durationMs: secondaryDurationMs,
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
  void _ctx;
  return {
    mode: "hold",
    begin: buildTickCommands,
    tick: buildTickCommands,
    end() {
      // No cleanup needed for spray
    },
  };
}
