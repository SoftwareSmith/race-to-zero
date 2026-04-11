/**
 * Laser Cutter (Bouncing Disc) — behavior plugin (ClickFireResult)
 *
 * Fires a laser disc from canvas center toward the click point.
 * Reflects off walls up to maxBounces times.
 * Hits every bug along any segment; adds burn scars per segment.
 * Spark crowns erupt at each wall bounce point.
 */

import type {
  WeaponContext,
  ClickFireResult,
  WeaponCommand,
} from "@game/weapons/runtime/types";
import {
  resolveBouncingDiscPath,
  segmentsToViewport,
  canvasToViewport,
} from "@game/weapons/runtime/targetingHelpers";

const DAMAGE = 1;
const HIT_RADIUS = 28;
const MAX_BOUNCES = 1;

export function createSession(ctx: WeaponContext): ClickFireResult {
  const {
    engine,
    targetX,
    targetY,
    centerX,
    centerY,
    canvasWidth,
    canvasHeight,
    viewportX,
    viewportY,
    bounds,
  } = ctx;
  const commands: WeaponCommand[] = [];

  const { segments, bouncePoints } = resolveBouncingDiscPath(
    centerX,
    centerY,
    targetX,
    targetY,
    canvasWidth,
    canvasHeight,
    MAX_BOUNCES,
  );

  // Hit detection across all segments (deduplicated)
  const hitSet = new Set<number>();
  for (const seg of segments) {
    for (const idx of engine.lineHitTest(
      seg.x1,
      seg.y1,
      seg.x2,
      seg.y2,
      HIT_RADIUS,
    )) {
      hitSet.add(idx);
    }
  }

  for (const idx of hitSet) {
    commands.push({
      kind: "damage",
      targetIndex: idx,
      amount: DAMAGE,
      creditOnDeath: true,
    });
  }

  // Burn scar decal along each segment
  for (const seg of segments) {
    commands.push({
      kind: "spawnEffect",
      descriptor: {
        type: "burnScar",
        x1: seg.x1,
        y1: seg.y1,
        x2: seg.x2,
        y2: seg.y2,
      },
    });
  }

  // Spark crown at each wall bounce point
  for (const pt of bouncePoints) {
    commands.push({
      kind: "spawnEffect",
      descriptor: { type: "sparkCrown", x: pt.x, y: pt.y, colorHex: 0xf87171 },
    });
  }

  // SVG overlay: bouncing disc path (laser is in OVERLAY_EFFECT_WEAPONS)
  const viewportSegments = segmentsToViewport(segments, bounds);
  commands.push({
    kind: "spawnEffect",
    descriptor: {
      type: "overlayEffect",
      weaponId: "laser",
      viewportX,
      viewportY,
      extras: { segments: viewportSegments },
    },
  });

  // Tracer line hint from cursor to first bounce (optional visual polish)
  if (segments.length > 0) {
    const firstSeg = segments[0];
    const vp1 = canvasToViewport(firstSeg.x1, firstSeg.y1, bounds);
    const vp2 = canvasToViewport(firstSeg.x2, firstSeg.y2, bounds);
    void vp1;
    void vp2;
  }

  return { mode: "once", commands };
}
