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
import { canvasToViewport } from "@game/weapons/runtime/targetingHelpers";

const DAMAGE = 2;
const HIT_RADIUS = 48;
const BURST_RADIUS = 34;
const BURST_OFFSETS = [
  { x: 0, y: 0 },
  { x: 52, y: 0 },
  { x: -52, y: 0 },
  { x: 0, y: 52 },
  { x: 0, y: -52 },
] as const;

export function createSession(ctx: WeaponContext): ClickFireResult {
  const { engine, targetX, targetY, viewportX, viewportY, bounds } = ctx;
  const tier = ctx.tier ?? 1;
  const commands: WeaponCommand[] = [];

  const hitSet = new Set<number>();
  const viewportNodes: Array<{ x: number; y: number }> = [];

  for (const offset of BURST_OFFSETS) {
    const burstX = targetX + offset.x;
    const burstY = targetY + offset.y;

    const burstHits = engine.radiusHitTest(burstX, burstY, HIT_RADIUS);
    for (const idx of burstHits) {
      hitSet.add(idx);
    }

    commands.push({
      kind: "spawnEffect",
      descriptor: {
        type: "explosion",
        x: burstX,
        y: burstY,
        radius: BURST_RADIUS,
        colorHex: 0x60a5fa,
      },
    });
    commands.push({
      kind: "spawnEffect",
      descriptor: { type: "sparkCrown", x: burstX, y: burstY, colorHex: 0x93c5fd },
    });

    viewportNodes.push(canvasToViewport(burstX, burstY, bounds));

    // T2: secondary explosions from each directly hit bug
    if (tier >= 2) {
      for (const idx of burstHits) {
        const bug = engine.getAllBugs()[idx];
        if (bug) {
          commands.push({
            kind: "spawnEffect",
            descriptor: { type: "explosion", x: bug.x, y: bug.y, radius: 28, colorHex: 0x93c5fd },
          });
          for (const i2 of engine.radiusHitTest(bug.x, bug.y, 36)) {
            hitSet.add(i2);
          }
        }
      }
    }
  }

  // T3: recursive cascade — extra outer ring detonations
  if (tier >= 3) {
    const ringOffsets = [
      { x: 90, y: 0 }, { x: -90, y: 0 }, { x: 0, y: 90 }, { x: 0, y: -90 },
      { x: 65, y: 65 }, { x: -65, y: 65 }, { x: 65, y: -65 }, { x: -65, y: -65 },
    ];
    for (const offset of ringOffsets) {
      const rx = targetX + offset.x;
      const ry = targetY + offset.y;
      for (const idx of engine.radiusHitTest(rx, ry, HIT_RADIUS)) {
        hitSet.add(idx);
      }
      commands.push({
        kind: "spawnEffect",
        descriptor: { type: "explosion", x: rx, y: ry, radius: BURST_RADIUS, colorHex: 0x60a5fa },
      });
    }
  }

  for (const idx of hitSet) {
    commands.push({ kind: "damage", targetIndex: idx, amount: DAMAGE, creditOnDeath: true });
  }

  commands.push({
    kind: "spawnEffect",
    descriptor: {
      type: "overlayEffect",
      weaponId: "plasma",
      viewportX,
      viewportY,
      extras: { chainNodes: viewportNodes },
    },
  });

  return { mode: "once", commands };
}
