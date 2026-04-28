/**
 * Fork Bomb — behavior plugin (ClickFireResult)
 *
 * Detonates one central blast plus 4 satellite bursts around the click point.
 * This keeps the weapon distinct from void pulse while avoiding any segment-
 * based radial line rendering.
 */

import type {
  WeaponContext,
  ClickFireResult,
  WeaponCommand,
} from "@game/weapons/runtime/types";
import { WeaponId, WeaponTier } from "@game/types";
import { canvasToViewport } from "@game/weapons/runtime/targetingHelpers";
import { BASE_TOGGLES } from "./constants";

function createClusterOffsets(clusterCount: number, distance: number) {
  if (clusterCount <= 1) {
    return [{ x: 0, y: 0 }];
  }

  const satelliteCount = Math.max(1, clusterCount - 1);
  const offsets = [{ x: 0, y: 0 }];

  for (let index = 0; index < satelliteCount; index += 1) {
    const angle = (Math.PI * 2 * index) / satelliteCount;
    offsets.push({
      x: Math.cos(angle) * distance,
      y: Math.sin(angle) * distance,
    });
  }

  return offsets;
}

function createRingOffsets(ringCount: number, radius: number) {
  const total = Math.max(0, ringCount);
  const offsets: Array<{ x: number; y: number }> = [];

  for (let index = 0; index < total; index += 1) {
    const angle = (Math.PI * 2 * index) / total;
    offsets.push({
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
    });
  }

  return offsets;
}

export function createSession(ctx: WeaponContext): ClickFireResult {
  const { engine, targetX, targetY, viewportX, viewportY, bounds } = ctx;
  const tier = ctx.tier ?? WeaponTier.TIER_ONE;
  const clusterCount = ctx.config?.clusterCount ?? BASE_TOGGLES.clusterCount;
  const damage = ctx.config?.damage ?? BASE_TOGGLES.damage;
  const hitRadius = ctx.config?.hitRadius ?? BASE_TOGGLES.hitRadius;
  const burstRadius = ctx.config?.burstRadius ?? BASE_TOGGLES.burstRadius;
  const burstOffsetDistance =
    ctx.config?.burstOffsetDistance ?? BASE_TOGGLES.burstOffsetDistance;
  const implosionRadius =
    ctx.config?.implosionRadius ?? BASE_TOGGLES.implosionRadius;
  const secondaryRadius =
    ctx.config?.secondaryRadius ?? BASE_TOGGLES.secondaryRadius;
  const ringCount = ctx.config?.ringCount ?? BASE_TOGGLES.ringCount;
  const ringRadius = ctx.config?.ringRadius ?? BASE_TOGGLES.ringRadius;
  const impactRadius = ctx.config?.impactRadius ?? BASE_TOGGLES.impactRadius;
  const reticleRadius =
    ctx.config?.reticleRadius ?? BASE_TOGGLES.reticleRadius;
  const shockwaveRadius =
    ctx.config?.shockwaveRadius ?? BASE_TOGGLES.shockwaveRadius;
  const chaosScale = ctx.config?.chaosScale ?? BASE_TOGGLES.chaosScale;
  const commands: WeaponCommand[] = [];
  const burstOffsets = createClusterOffsets(clusterCount, burstOffsetDistance);

  const hitSet = new Set<number>();
  const targetPoints: Array<{ x: number; y: number }> = [];

  commands.push({
    kind: "spawnEffect",
    descriptor: {
      type: "plasmaImplosion",
      x: targetX,
      y: targetY,
      radius: implosionRadius,
    },
  });

  for (const offset of burstOffsets) {
    const burstX = targetX + offset.x;
    const burstY = targetY + offset.y;

    const burstHits = engine.radiusHitTest(burstX, burstY, hitRadius);
    for (const idx of burstHits) {
      hitSet.add(idx);
    }

    commands.push({
      kind: "spawnEffect",
      descriptor: {
        type: "explosion",
        x: burstX,
        y: burstY,
        radius: burstRadius,
        colorHex: 0x60a5fa,
      },
    });
    commands.push({
      kind: "spawnEffect",
      descriptor: { type: "sparkCrown", x: burstX, y: burstY, colorHex: 0x93c5fd },
    });

    targetPoints.push(canvasToViewport(burstX, burstY, bounds));

    // T2: secondary explosions from each directly hit bug
    if (tier >= WeaponTier.TIER_TWO) {
      for (const idx of burstHits) {
        const bug = engine.getAllBugs()[idx];
        if (bug) {
          commands.push({
            kind: "spawnEffect",
            descriptor: { type: "explosion", x: bug.x, y: bug.y, radius: secondaryRadius, colorHex: 0x93c5fd },
          });
          for (const i2 of engine.radiusHitTest(bug.x, bug.y, secondaryRadius)) {
            hitSet.add(i2);
          }
        }
      }
    }
  }

  // T3: recursive cascade — extra outer ring detonations
  if (tier >= WeaponTier.TIER_THREE) {
    const ringOffsets = createRingOffsets(ringCount, ringRadius);
    for (const offset of ringOffsets) {
      const rx = targetX + offset.x;
      const ry = targetY + offset.y;
      for (const idx of engine.radiusHitTest(rx, ry, hitRadius)) {
        hitSet.add(idx);
      }
      commands.push({
        kind: "spawnEffect",
        descriptor: { type: "explosion", x: rx, y: ry, radius: burstRadius, colorHex: 0x60a5fa },
      });
      targetPoints.push(canvasToViewport(rx, ry, bounds));

      if (tier >= WeaponTier.TIER_FOUR) {
        commands.push({
          kind: "unstableRadius",
          cx: rx,
          cy: ry,
          radius: Math.max(secondaryRadius, hitRadius * 0.9),
          durationMs: 2600,
        });
        commands.push({
          kind: "spawnEffect",
          descriptor: { type: "plasmaExplosion", x: rx, y: ry, delayMs: 120 },
        });
      }

      if (tier >= WeaponTier.TIER_FIVE && Math.abs(offset.x) + Math.abs(offset.y) > ringRadius * 0.9) {
        const collapseX = targetX + offset.x * 0.52;
        const collapseY = targetY + offset.y * 0.52;
        for (const idx of engine.radiusHitTest(collapseX, collapseY, Math.max(hitRadius, secondaryRadius))) {
          hitSet.add(idx);
        }
        commands.push({
          kind: "spawnEffect",
          descriptor: {
            type: "explosion",
            x: collapseX,
            y: collapseY,
            radius: Math.max(burstRadius * 0.9, 34),
            colorHex: 0x7dd3fc,
          },
        });
      }
    }
  }

  if (tier >= WeaponTier.TIER_FIVE) {
    for (const idx of hitSet) {
      commands.push({
        kind: "triggerKernelPanic",
        targetIndex: idx,
        splashRadius: Math.max(secondaryRadius, hitRadius),
        damage: 1,
      });
    }
  }

  for (const idx of hitSet) {
    commands.push({ kind: "damage", targetIndex: idx, amount: damage, creditOnDeath: true });
  }

  commands.push({
    kind: "spawnEffect",
    descriptor: {
      type: "overlayEffect",
      weaponId: WeaponId.ForkBomb,
      viewportX,
      viewportY,
      extras: {
        chaosScale,
        impactRadius,
        reticleRadius,
        shockwaveRadius,
        targetPoints,
      },
    },
  });

  return { mode: "once", commands };
}
