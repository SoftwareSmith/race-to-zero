import type {
  ClickFireResult,
  WeaponCommand,
  WeaponContext,
} from "@game/weapons/runtime/types";
import { WeaponId, WeaponTier } from "@game/types";
import { BASE_TOGGLES } from "./constants";

export function createSession(ctx: WeaponContext): ClickFireResult {
  const tier = ctx.tier ?? WeaponTier.TIER_ONE;
  const commands: WeaponCommand[] = [];
  const damage = ctx.config.damage ?? BASE_TOGGLES.damage;
  const markRadius = ctx.config.markRadius ?? BASE_TOGGLES.markRadius;
  const markDurationMs = ctx.config.markDurationMs ?? BASE_TOGGLES.markDurationMs;
  const snareDurationMs =
    ctx.config.secondaryDurationMs ?? BASE_TOGGLES.secondaryDurationMs;
  const impactRadius = ctx.config.impactRadius ?? BASE_TOGGLES.impactRadius;
  const shockwaveRadius =
    ctx.config.shockwaveRadius ?? BASE_TOGGLES.shockwaveRadius;

  const hits = ctx.engine.radiusHitTest(ctx.targetX, ctx.targetY, markRadius);

  for (const index of hits) {
    commands.push({ kind: "applyMarked", targetIndex: index, durationMs: markDurationMs });
    if (tier >= WeaponTier.TIER_TWO) {
      commands.push({ kind: "applyEnsnare", targetIndex: index, durationMs: snareDurationMs });
    }
    if (tier >= WeaponTier.TIER_FOUR) {
      commands.push({ kind: "damage", targetIndex: index, amount: damage, creditOnDeath: true });
    }
  }

  if (tier >= WeaponTier.TIER_THREE) {
    commands.push({
      kind: "startEventHorizon",
      x: ctx.targetX,
      y: ctx.targetY,
      radius: Math.max(markRadius * 0.75, 108),
      durationMs: Math.max(snareDurationMs, 1800),
    });
  }

  if (tier >= WeaponTier.TIER_FIVE) {
    commands.push({
      kind: "unstableRadius",
      cx: ctx.targetX,
      cy: ctx.targetY,
      radius: Math.max(markRadius * 0.85, 120),
      durationMs: Math.max(markDurationMs, 3600),
    });
  }

  commands.push({
    kind: "spawnEffect",
    descriptor: {
      type: "empBurst",
      x: ctx.targetX,
      y: ctx.targetY,
      count: tier >= WeaponTier.TIER_THREE ? 18 : 12,
    },
  });
  commands.push({
    kind: "spawnEffect",
    descriptor: {
      type: "explosion",
      x: ctx.targetX,
      y: ctx.targetY,
      radius: tier >= WeaponTier.TIER_THREE ? shockwaveRadius : impactRadius,
      colorHex: 0xfbbf24,
    },
  });
  commands.push({
    kind: "spawnEffect",
    descriptor: {
      type: "overlayEffect",
      weaponId: WeaponId.PulseBeacon,
      viewportX: ctx.viewportX,
      viewportY: ctx.viewportY,
      extras: {
        impactRadius,
        reticleRadius: ctx.config.reticleRadius ?? BASE_TOGGLES.reticleRadius,
        shockwaveRadius,
        chaosScale: tier >= WeaponTier.TIER_THREE ? 1.2 : 0.92,
        color: "#fbbf24",
      },
    },
  });

  return { mode: "once", commands };
}