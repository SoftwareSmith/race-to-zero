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
import {
  findNearestBugInRadius,
  canvasToViewport,
} from "@game/weapons/runtime/targetingHelpers";

const DAMAGE = 2;
const CHAIN_RADIUS = 90;
const MAX_BOUNCES = 3;
const MAX_BOUNCES_T2 = 6;

export function createSession(ctx: WeaponContext): ClickFireResult {
  const { engine, targetX, targetY, viewportX, viewportY, bounds } = ctx;
  const tier = ctx.tier ?? 1;
  const commands: WeaponCommand[] = [];
  const maxBounces = tier >= 2 ? MAX_BOUNCES_T2 : MAX_BOUNCES;

  const initial = findNearestBugInRadius(
    engine,
    targetX,
    targetY,
    CHAIN_RADIUS,
  );

  if (!initial) {
    // No target — fire overlay at click position with empty chain
    commands.push({
      kind: "spawnEffect",
      descriptor: {
        type: "overlayEffect",
        weaponId: "chain",
        viewportX,
        viewportY,
        extras: { chainNodes: [] },
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
    ...chainFn(initial.index, CHAIN_RADIUS, maxBounces),
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
      amount: DAMAGE,
      creditOnDeath: true,
    });
    // T2+: apply Charged status to each hit bug
    if (tier >= 2) {
      commands.push({ kind: "applyCharged", targetIndex: idx, durationMs: 5000 });
    }
  }

  // T3: propagate charged network after hitting the chain
  if (tier >= 3 && chainIndexes.length > 0) {
    commands.push({
      kind: "propagateChargedNetwork",
      sourceIndex: chainIndexes[0],
      damage: 1,
      falloff: 0.7,
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
      weaponId: "chain",
      viewportX,
      viewportY,
      extras: { chainNodes: viewportChainNodes },
    },
  });

  return { mode: "once", commands };
}
