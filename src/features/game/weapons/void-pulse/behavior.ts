/**
 * Void Pulse — behavior plugin
 *
 * Creates a black hole gravity well for 2s, pulling all bugs within 300px.
 * Core contact deals 1 dmg/tick (handled by Engine.tickBlackHole).
 * On collapse: 300px shockring deals 2 dmg to all bugs in radius.
 *
 * The VFX createBlackHole descriptor stores the Pixi ID in blackHoleVfxIdRef
 * so the renderFrame loop can call tickBlackHoleVfx each frame until the
 * engine-owned timer collapses the well.
 */

import type {
  WeaponContext,
  ClickFireResult,
  WeaponCommand,
} from "@game/weapons/runtime/types";
import { WeaponId, WeaponTier } from "@game/types";
import { BASE_TOGGLES } from "./constants";

export function createSession(ctx: WeaponContext): ClickFireResult {
  const { targetX, targetY, viewportX, viewportY, engine } = ctx;
  const tier = ctx.tier ?? WeaponTier.TIER_ONE;
  const damage = ctx.config?.damage ?? BASE_TOGGLES.damage;
  const blackHoleRadius =
    ctx.config?.blackHoleRadius ?? BASE_TOGGLES.blackHoleRadius;
  const coreRadius =
    ctx.config?.blackHoleCoreRadius ?? BASE_TOGGLES.blackHoleCoreRadius;
  const durationMs =
    ctx.config?.blackHoleDurationMs ?? BASE_TOGGLES.blackHoleDurationMs;
  const impactRadius = ctx.config?.impactRadius ?? BASE_TOGGLES.impactRadius;
  const reticleRadius =
    ctx.config?.reticleRadius ?? BASE_TOGGLES.reticleRadius;
  const shockwaveRadius =
    ctx.config?.shockwaveRadius ?? BASE_TOGGLES.shockwaveRadius;
  const burnRadius = ctx.config?.secondaryRadius ?? BASE_TOGGLES.secondaryRadius;
  const burnDps = ctx.config?.burnDps ?? BASE_TOGGLES.burnDps;
  const burnDurationMs =
    ctx.config?.burnDurationMs ?? BASE_TOGGLES.burnDurationMs;
  const burnDecayPerSecond =
    ctx.config?.burnDecayPerSecond ?? BASE_TOGGLES.burnDecayPerSecond;
  const eventHorizonRadius =
    ctx.config?.eventHorizonRadius ?? BASE_TOGGLES.eventHorizonRadius;
  const eventHorizonDurationMs =
    ctx.config?.eventHorizonDurationMs ?? BASE_TOGGLES.eventHorizonDurationMs;
  const chaosScale = ctx.config?.chaosScale ?? BASE_TOGGLES.chaosScale;

  // Singleton guard — refuse if a black hole is already active
  if (engine.getBlackHole()?.active) {
    return {
      mode: "once",
      commands: [],
    };
  }

  const commands: WeaponCommand[] = [
    {
      kind: "startBlackHole",
      x: targetX,
      y: targetY,
      radius: blackHoleRadius,
      coreRadius,
      durationMs,
      collapseDamage: damage,
      eventHorizonRadius:
        tier >= WeaponTier.TIER_THREE ? eventHorizonRadius : undefined,
      eventHorizonDurationMs:
        tier >= WeaponTier.TIER_THREE ? eventHorizonDurationMs : undefined,
    },
    {
      kind: "spawnEffect",
      descriptor: { type: "createBlackHole", x: targetX, y: targetY },
    },
    {
      kind: "spawnEffect",
      descriptor: {
        type: "overlayEffect",
        weaponId: WeaponId.VoidPulse,
        viewportX,
        viewportY,
        extras: {
          chaosScale,
          impactRadius,
          reticleRadius,
          shockwaveRadius,
        },
      },
    },
  ];

  if (tier >= WeaponTier.TIER_TWO) {
    commands.push({
      kind: "burnRadius",
      cx: targetX,
      cy: targetY,
      radius: burnRadius,
      peakDps: burnDps,
      durationMs: burnDurationMs,
      decayPerSecond: burnDecayPerSecond,
    });
  }

  if (tier >= WeaponTier.TIER_FOUR) {
    commands.push({
      kind: "unstableRadius",
      cx: targetX,
      cy: targetY,
      radius: Math.max(96, burnRadius),
      durationMs: Math.max(2600, Math.round(eventHorizonDurationMs * 0.5)),
    });
  }

  if (tier >= WeaponTier.TIER_FIVE) {
    commands.push({
      kind: "startEventHorizon",
      x: targetX,
      y: targetY,
      radius: Math.max(eventHorizonRadius * 0.78, 140),
      durationMs: Math.max(2400, Math.round(eventHorizonDurationMs * 0.55)),
    });
  }

  return {
    mode: "once",
    commands,
  };
}
