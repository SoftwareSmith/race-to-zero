/**
 * Targeting helpers — pure functions for hit detection that weapon behaviors
 * can call in createSession(). These wrap GameEngine methods and add fallback
 * logic (e.g. large-radius nearest-bug search when hitTest returns null).
 */

import type { GameEngine, CanvasBounds } from "@game/weapons/runtime/types";

// ─── Nearest bug ────────────────────────────────────────────────────────────

/**
 * Find the nearest bug within maxRadius pixels.
 * Tries engine.hitTest first (exact hit), then scans all bugs as fallback.
 */
export function findNearestBugInRadius(
  engine: GameEngine,
  cx: number,
  cy: number,
  maxRadius: number,
): { index: number; distance: number } | null {
  const direct = engine.hitTest(cx, cy);
  if (direct) return direct;

  const bugs = engine.getAllBugs();
  let best: { index: number; distance: number } | null = null;
  for (let i = 0; i < bugs.length; i++) {
    const bug = bugs[i];
    if (!bug) continue;
    const dist = Math.hypot(bug.x - cx, bug.y - cy);
    if (dist <= maxRadius && (!best || dist < best.distance)) {
      best = { index: i, distance: dist };
    }
  }
  return best;
}

// ─── Angle helpers ───────────────────────────────────────────────────────────

/**
 * Compute the cone aim angle (in degrees) pointing AWAY from canvas center
 * toward the target point. Used for flamethrower / bug spray (fire outward).
 */
export function coneAngleAway(
  targetX: number,
  targetY: number,
  centerX: number,
  centerY: number,
): number {
  return (
    (Math.atan2(centerY - targetY, centerX - targetX) * 180) / Math.PI + 180
  );
}

/**
 * Compute the cone aim angle pointing TOWARD canvas center from the target.
 * Used for freeze blast (fire inward / radial).
 */
export function coneAngleToward(
  targetX: number,
  targetY: number,
  centerX: number,
  centerY: number,
): number {
  return (Math.atan2(centerY - targetY, centerX - targetX) * 180) / Math.PI;
}

// ─── Bouncing disc path ──────────────────────────────────────────────────────

export interface DiscSegment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/**
 * Build the reflected path segments for a bouncing laser disc.
 * Starts at (startX, startY), fires toward (targetX, targetY), reflects
 * off canvas walls up to maxBounces times.
 *
 * @returns Canvas-local segments array + bounce point canvas coords
 */
export function resolveBouncingDiscPath(
  startX: number,
  startY: number,
  targetX: number,
  targetY: number,
  canvasWidth: number,
  canvasHeight: number,
  maxBounces: number,
): { segments: DiscSegment[]; bouncePoints: Array<{ x: number; y: number }> } {
  const discAngle = Math.atan2(targetY - startY, targetX - startX);
  const discLen = Math.max(canvasWidth, canvasHeight) * 2;

  const segments: DiscSegment[] = [];
  const bouncePoints: Array<{ x: number; y: number }> = [];
  let px = startX;
  let py = startY;
  let dx = Math.cos(discAngle);
  let dy = Math.sin(discAngle);
  const W = canvasWidth;
  const H = canvasHeight;

  for (let bounce = 0; bounce <= maxBounces; bounce++) {
    let tMin = discLen;
    if (dx > 0) tMin = Math.min(tMin, (W - px) / dx);
    else if (dx < 0) tMin = Math.min(tMin, -px / dx);
    if (dy > 0) tMin = Math.min(tMin, (H - py) / dy);
    else if (dy < 0) tMin = Math.min(tMin, -py / dy);

    const nx = px + dx * tMin;
    const ny = py + dy * tMin;
    segments.push({ x1: px, y1: py, x2: nx, y2: ny });

    if (bounce < maxBounces) {
      bouncePoints.push({ x: nx, y: ny });
      const hitLeft = Math.abs(nx) < 1;
      const hitRight = Math.abs(nx - W) < 1;
      const hitTop = Math.abs(ny) < 1;
      const hitBottom = Math.abs(ny - H) < 1;
      if (hitLeft || hitRight) dx = -dx;
      if (hitTop || hitBottom) dy = -dy;
    }
    px = nx;
    py = ny;
  }

  return { segments, bouncePoints };
}

/**
 * Convert canvas-local segments to viewport-space segments (add bounds offset).
 */
export function segmentsToViewport(
  segments: DiscSegment[],
  bounds: CanvasBounds,
): DiscSegment[] {
  return segments.map((s) => ({
    x1: Math.round(s.x1 + bounds.left),
    y1: Math.round(s.y1 + bounds.top),
    x2: Math.round(s.x2 + bounds.left),
    y2: Math.round(s.y2 + bounds.top),
  }));
}

// ─── Coordinate conversion ───────────────────────────────────────────────────

/** Convert viewport coordinates to canvas-local using bounds. */
export function viewportToCanvas(
  viewportX: number,
  viewportY: number,
  bounds: CanvasBounds,
): { x: number; y: number } {
  return { x: viewportX - bounds.left, y: viewportY - bounds.top };
}

/** Convert canvas-local coordinates to viewport using bounds. */
export function canvasToViewport(
  canvasX: number,
  canvasY: number,
  bounds: CanvasBounds,
): { x: number; y: number } {
  return {
    x: Math.round(canvasX + bounds.left),
    y: Math.round(canvasY + bounds.top),
  };
}
