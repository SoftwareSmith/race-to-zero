/**
 * Chain Zap — behavior plugin (ClickFireResult)
 * Starts from nearest bug, bounces up to 3 times preferring unfrozen targets.
 * Synergy: explicitly prefers bugs NOT already frozen (pairs with Freeze Cone).
 */

import type {
  WeaponContext,
  ClickFireResult,
  WeaponCommand,
} from "@game/weapons/runtime/types";
import { WeaponId, WeaponTier } from "@game/types";
import {
  findNearestBugInRadius,
  canvasToViewport,
} from "@game/weapons/runtime/targetingHelpers";
import { BASE_TOGGLES } from "./constants";

export function createSession(ctx: WeaponContext): ClickFireResult {
  const { engine, targetX, targetY, viewportX, viewportY, bounds } = ctx;
  const tier = ctx.tier ?? WeaponTier.TIER_ONE;
  const commands: WeaponCommand[] = [];
  const damage = ctx.config?.damage ?? BASE_TOGGLES.damage;
  const chainRadius = ctx.config?.chainRadius ?? BASE_TOGGLES.chainRadius;
  const maxBounces = ctx.config?.chainMaxBounces ?? BASE_TOGGLES.chainMaxBounces;
  const beamWidth = ctx.config?.beamWidth ?? BASE_TOGGLES.beamWidth;
  const beamGlowWidth = ctx.config?.beamGlowWidth ?? BASE_TOGGLES.beamGlowWidth;
  const chaosScale = ctx.config?.chaosScale ?? BASE_TOGGLES.chaosScale;
  const secondaryDamage =
    ctx.config?.secondaryDamage ?? BASE_TOGGLES.secondaryDamage;

  const initial = findNearestBugInRadius(
    engine,
    targetX,
    targetY,
    chainRadius,
  );

  if (!initial) {
    // No target — fire overlay at click position with empty chain
    commands.push({
      kind: "spawnEffect",
      descriptor: {
        type: "overlayEffect",
        weaponId: WeaponId.ChainZap,
        viewportX,
        viewportY,
        extras: {
          beamGlowWidth,
          beamWidth,
          chainNodes: [],
          chaosScale,
        },
      },
    });
    return { mode: "once", commands };
  }

  // Build chain index list: start + bounces
  const chainFn =
    typeof engine.chainHitTestPreferUnfrozen === "function"
      ? engine.chainHitTestPreferUnfrozen.bind(engine)
      : engine.chainHitTest.bind(engine);

  const chainIndexes = [
    initial.index,
    ...chainFn(initial.index, chainRadius, maxBounces),
  ];

  const bugs = engine.getAllBugs();

  // Canvas-local positions for Pixi lightning (starts at click, then each bug)
  const lightningNodes = [
    { x: targetX, y: targetY },
    ...chainIndexes.map((idx) => ({
      x: bugs[idx]?.x ?? targetX,
      y: bugs[idx]?.y ?? targetY,
    })),
  ];

  // Viewport positions for SVG overlay arc
  const viewportChainNodes = chainIndexes
    .map((idx) => {
      const bug = bugs[idx];
      return bug ? canvasToViewport(bug.x, bug.y, bounds) : null;
    })
    .filter(Boolean) as Array<{ x: number; y: number }>;

  // Damage each target in the chain
  for (const idx of chainIndexes) {
    commands.push({
      kind: "damage",
      targetIndex: idx,
      amount: damage,
      creditOnDeath: true,
    });
    // T2+: apply Charged status to each hit bug
    if (tier >= WeaponTier.TIER_TWO) {
      commands.push({ kind: "applyCharged", targetIndex: idx, durationMs: 5000 });
    }
  }

  // T3: propagate charged network after hitting the chain
  if (tier >= WeaponTier.TIER_THREE && chainIndexes.length > 0) {
    commands.push({
      kind: "propagateChargedNetwork",
      sourceIndex: chainIndexes[0],
        damage: secondaryDamage,
      falloff: 0.7,
    });
  }

  if (tier >= WeaponTier.TIER_FOUR) {
    for (const idx of chainIndexes) {
      const bug = bugs[idx];
      if (!bug) {
        continue;
      }

      for (const nearbyIndex of engine.radiusHitTest(bug.x, bug.y, Math.max(32, chainRadius * 0.42))) {
        if (chainIndexes.includes(nearbyIndex)) {
          continue;
        }
        commands.push({
          kind: "applyCharged",
          targetIndex: nearbyIndex,
          durationMs: 3200,
        });
        if (tier >= WeaponTier.TIER_FIVE) {
          commands.push({
            kind: "damage",
            targetIndex: nearbyIndex,
            amount: 1,
            creditOnDeath: true,
          });
        }
      }
    }
  }

  if (tier >= WeaponTier.TIER_FIVE && chainIndexes.length > 1) {
    commands.push({
      kind: "propagateChargedNetwork",
      sourceIndex: chainIndexes[chainIndexes.length - 1],
      damage: secondaryDamage,
      falloff: 0.82,
    });
  }

  // Pixi: multi-node lightning arc
  commands.push({
    kind: "spawnEffect",
    descriptor: {
      type: "lightning",
      nodes: lightningNodes,
      lifetimeMs: 1200,
      colorHex: 0x6ee7b7,
    },
  });

  // Pixi: spark crown at every bounce node
  for (const idx of chainIndexes) {
    const bug = bugs[idx];
    if (bug) {
      commands.push({
        kind: "spawnEffect",
        descriptor: {
          type: "sparkCrown",
          x: bug.x,
          y: bug.y,
          colorHex: 0x6ee7b7,
        },
      });
    }
  }

  // SVG overlay (chain is in OVERLAY_EFFECT_WEAPONS)
  commands.push({
    kind: "spawnEffect",
    descriptor: {
      type: "overlayEffect",
      weaponId: WeaponId.ChainZap,
      viewportX,
      viewportY,
      extras: {
        beamGlowWidth,
        beamWidth,
        chainNodes: viewportChainNodes,
        chaosScale,
      },
    },
  });

  return { mode: "once", commands };
}
