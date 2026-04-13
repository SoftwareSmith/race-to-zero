/**
 * Tracer Bloom — behavior plugin (ClickFireResult)
 *
 * Lays 4 bloom charges from the core toward the click point. Each charge
 * detonates in a small radius, avoiding the broken segment/ricochet logic
 * while preserving a clear route-to-target weapon feel.
 */

import type {
  WeaponContext,
  ClickFireResult,
  WeaponCommand,
} from "@game/weapons/runtime/types";
import { WeaponId, WeaponTier } from "@game/types";
import { canvasToViewport } from "@game/weapons/runtime/targetingHelpers";

const DAMAGE = 1;
const HIT_RADIUS = 38;
const BLOOM_RADIUS = 28;
const BLOOM_FRACTIONS = [0.28, 0.48, 0.68, 0.88] as const;
const T2_BONUS_DAMAGE = 2;
const T3_BONUS_DAMAGE = 3;

export function createSession(ctx: WeaponContext): ClickFireResult {
  const {
    engine,
    targetX,
    targetY,
    centerX,
    centerY,
    viewportX,
    viewportY,
    bounds,
  } = ctx;
  const tier = ctx.tier ?? WeaponTier.TIER_ONE;
  const commands: WeaponCommand[] = [];

  const hitSet = new Set<number>();
  const viewportNodes: Array<{ x: number; y: number }> = [];
  const dx = targetX - centerX;
  const dy = targetY - centerY;
  const bugs = engine.getAllBugs();

  for (const fraction of BLOOM_FRACTIONS) {
    const bloomX = centerX + dx * fraction;
    const bloomY = centerY + dy * fraction;

    for (const idx of engine.radiusHitTest(bloomX, bloomY, HIT_RADIUS)) {
      hitSet.add(idx);
    }

    commands.push({
      kind: "spawnEffect",
      descriptor: {
        type: "explosion",
        x: bloomX,
        y: bloomY,
        radius: BLOOM_RADIUS,
        colorHex: 0xfb7185,
      },
    });
    commands.push({
      kind: "spawnEffect",
      descriptor: { type: "sparkCrown", x: bloomX, y: bloomY, colorHex: 0xfb7185 },
    });

    viewportNodes.push(canvasToViewport(bloomX, bloomY, bounds));
  }

  const bonusDmg =
    tier >= WeaponTier.TIER_THREE
      ? T3_BONUS_DAMAGE
      : tier >= WeaponTier.TIER_TWO
        ? T2_BONUS_DAMAGE
        : 0;

  for (const idx of hitSet) {
    const bug = bugs[idx];
    const isAfflicted = bug && (bug.charged || bug.marked || bug.unstable || bug.looped);
    const dmg = DAMAGE + (bonusDmg > 0 && isAfflicted ? bonusDmg : 0);
    commands.push({
      kind: "damage",
      targetIndex: idx,
      amount: dmg,
      creditOnDeath: true,
    });
  }

  commands.push({
    kind: "spawnEffect",
    descriptor: {
      type: "overlayEffect",
      weaponId: WeaponId.TracerBloom,
      viewportX,
      viewportY,
      extras: { chainNodes: viewportNodes },
    },
  });

  return { mode: "once", commands };
}
