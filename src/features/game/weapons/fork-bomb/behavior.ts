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

export function createSession(ctx: WeaponContext): ClickFireResult {
  const { engine, targetX, targetY, viewportX, viewportY, bounds } = ctx;
  const tier = ctx.tier ?? WeaponTier.TIER_ONE;
  const damage = ctx.config?.damage ?? BASE_TOGGLES.damage;
  const hitRadius = ctx.config?.hitRadius ?? BASE_TOGGLES.hitRadius;
  const burstRadius = ctx.config?.burstRadius ?? BASE_TOGGLES.burstRadius;
  const burstOffsetDistance =
    ctx.config?.burstOffsetDistance ?? BASE_TOGGLES.burstOffsetDistance;
  const secondaryRadius =
    ctx.config?.secondaryRadius ?? BASE_TOGGLES.secondaryRadius;
  const ringRadius = ctx.config?.ringRadius ?? BASE_TOGGLES.ringRadius;
  const commands: WeaponCommand[] = [];
  const burstOffsets = [
    { x: 0, y: 0 },
    { x: burstOffsetDistance, y: 0 },
    { x: -burstOffsetDistance, y: 0 },
    { x: 0, y: burstOffsetDistance },
    { x: 0, y: -burstOffsetDistance },
  ] as const;

  const hitSet = new Set<number>();
  const viewportNodes: Array<{ x: number; y: number }> = [];

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

    viewportNodes.push(canvasToViewport(burstX, burstY, bounds));

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
    const ringOffsets = [
      { x: ringRadius, y: 0 }, { x: -ringRadius, y: 0 }, { x: 0, y: ringRadius }, { x: 0, y: -ringRadius },
      { x: Math.round(ringRadius * 0.72), y: Math.round(ringRadius * 0.72) },
      { x: -Math.round(ringRadius * 0.72), y: Math.round(ringRadius * 0.72) },
      { x: Math.round(ringRadius * 0.72), y: -Math.round(ringRadius * 0.72) },
      { x: -Math.round(ringRadius * 0.72), y: -Math.round(ringRadius * 0.72) },
    ];
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
      extras: { chainNodes: viewportNodes },
    },
  });

  return { mode: "once", commands };
}
