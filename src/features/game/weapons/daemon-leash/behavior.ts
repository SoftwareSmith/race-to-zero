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
  const seekRadius = ctx.config.seekRadius ?? BASE_TOGGLES.seekRadius;
  const splashRadius = ctx.config.splashRadius ?? BASE_TOGGLES.splashRadius;
  const damage = ctx.config.damage ?? BASE_TOGGLES.damage;
  const targetIndex = ctx.engine.closestTargetIndex(
    ctx.targetX,
    ctx.targetY,
    seekRadius,
  );

  if (targetIndex < 0) {
    commands.push({
      kind: "spawnEffect",
      descriptor: {
        type: "overlayEffect",
        weaponId: WeaponId.DaemonLeash,
        viewportX: ctx.viewportX,
        viewportY: ctx.viewportY,
        extras: {
          impactRadius: ctx.config.impactRadius ?? BASE_TOGGLES.impactRadius,
          reticleRadius: ctx.config.reticleRadius ?? BASE_TOGGLES.reticleRadius,
          shockwaveRadius: ctx.config.shockwaveRadius ?? BASE_TOGGLES.shockwaveRadius,
          chaosScale: 0.9,
          color: "#34d399",
        },
      },
    });
    return { mode: "once", commands };
  }

  const bugs = ctx.engine.getAllBugs();
  const target = bugs[targetIndex];
  const targetX = target?.x ?? ctx.targetX;
  const targetY = target?.y ?? ctx.targetY;

  commands.push({
    kind: "allyBug",
    targetIndex,
    config: {
      durationMs: ctx.config.allyDurationMs ?? BASE_TOGGLES.allyDurationMs,
      expireBurstDamage:
        ctx.config.allyExpireBurstDamage ?? BASE_TOGGLES.allyExpireBurstDamage,
      expireBurstRadius:
        ctx.config.allyExpireBurstRadius ?? BASE_TOGGLES.allyExpireBurstRadius,
      interceptForce:
        ctx.config.allyInterceptForce ?? BASE_TOGGLES.allyInterceptForce,
      maxActiveAllies: ctx.config.allyCap ?? BASE_TOGGLES.allyCap,
    },
  });

  if (tier >= WeaponTier.TIER_TWO) {
    commands.push({
      kind: "markedRadius",
      cx: targetX,
      cy: targetY,
      radius: splashRadius,
      durationMs: 2600,
    });
  }

  if (tier >= WeaponTier.TIER_THREE) {
    commands.push({
      kind: "damage",
      targetIndex,
      amount: damage,
      creditOnDeath: true,
    });
  }

  if (tier >= WeaponTier.TIER_FOUR) {
    commands.push({
      kind: "unstableRadius",
      cx: targetX,
      cy: targetY,
      radius: Math.max(116, splashRadius),
      durationMs: 3200,
    });
  }

  if (tier >= WeaponTier.TIER_FIVE) {
    commands.push({
      kind: "triggerKernelPanic",
      targetIndex,
      splashRadius: Math.max(124, splashRadius),
      damage,
    });
  }

  commands.push({
    kind: "spawnEffect",
    descriptor: {
      type: "tracerLine",
      x1: ctx.targetX,
      y1: ctx.targetY,
      x2: targetX,
      y2: targetY,
      durationMs: 180,
    },
  });
  commands.push({
    kind: "spawnEffect",
    descriptor: {
      type: "empBurst",
      x: targetX,
      y: targetY,
      count: tier >= WeaponTier.TIER_FOUR ? 18 : 10,
    },
  });
  commands.push({
    kind: "spawnEffect",
    descriptor: {
      type: "overlayEffect",
      weaponId: WeaponId.DaemonLeash,
      viewportX: ctx.bounds.left + targetX,
      viewportY: ctx.bounds.top + targetY,
      extras: {
        impactRadius: ctx.config.impactRadius ?? BASE_TOGGLES.impactRadius,
        reticleRadius: ctx.config.reticleRadius ?? BASE_TOGGLES.reticleRadius,
        shockwaveRadius: ctx.config.shockwaveRadius ?? BASE_TOGGLES.shockwaveRadius,
        chaosScale: tier >= WeaponTier.TIER_FOUR ? 1.25 : 1,
        color: "#34d399",
      },
    },
  });

  return { mode: "once", commands };
}