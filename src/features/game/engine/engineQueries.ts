import { isTerminalEntityState } from "@game/types";
import type { Entity } from "./Entity";
import { getWrappedDistance } from "./toroidalMath";

interface QueryHelpers {
  getDistanceFromPointToEntity: (x: number, y: number, entity: Entity) => number;
  getEntityDeltaFromPoint: (
    x: number,
    y: number,
    entity: Entity,
  ) => { dx: number; dy: number };
  height: number;
  isToroidalEntity: (entity: Entity | null | undefined) => boolean;
  width: number;
}

export function hitTestEntity(
  entities: Entity[],
  x: number,
  y: number,
  { getDistanceFromPointToEntity }: Pick<QueryHelpers, "getDistanceFromPointToEntity">,
) {
  let best: { index: number; distance: number } | null = null;
  for (let index = 0; index < entities.length; index += 1) {
    const entity = entities[index] as any;
    if (isTerminalEntityState(entity.state)) continue;
    const distance = getDistanceFromPointToEntity(x, y, entity);
    const radius = Math.max((entity.size ?? 12) * 0.5, 12);
    if (distance <= radius && (!best || distance < best.distance)) {
      best = { distance, index };
    }
  }
  return best;
}

export function lineHitTestEntities(
  entities: Entity[],
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  hitRadius: number,
  {
    getEntityDeltaFromPoint,
  }: Pick<QueryHelpers, "getEntityDeltaFromPoint">,
) {
  const result: number[] = [];
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;

  for (let index = 0; index < entities.length; index += 1) {
    const entity = entities[index] as any;
    if (isTerminalEntityState(entity.state)) continue;

    const projected = getEntityDeltaFromPoint(x1, y1, entity);
    const px = x1 + projected.dx;
    const py = y1 + projected.dy;

    let t = 0;
    if (lenSq > 0) {
      t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lenSq));
    }
    const closestX = x1 + t * dx;
    const closestY = y1 + t * dy;
    const distance = Math.hypot(px - closestX, py - closestY);

    if (distance <= Math.max((entity.size ?? 12) * 0.5, 8) + hitRadius) {
      result.push(index);
    }
  }

  return result;
}

export function radiusHitTestEntities(
  entities: Entity[],
  cx: number,
  cy: number,
  radius: number,
  { getDistanceFromPointToEntity }: Pick<QueryHelpers, "getDistanceFromPointToEntity">,
) {
  const result: number[] = [];

  for (let index = 0; index < entities.length; index += 1) {
    const entity = entities[index] as any;
    if (isTerminalEntityState(entity.state)) continue;
    const distance = getDistanceFromPointToEntity(cx, cy, entity);
    if (distance <= radius + Math.max((entity.size ?? 12) * 0.5, 8)) {
      result.push(index);
    }
  }

  return result;
}

export function coneHitTestEntities(
  entities: Entity[],
  cx: number,
  cy: number,
  angleDeg: number,
  arcDeg: number,
  depth: number,
  { getEntityDeltaFromPoint }: Pick<QueryHelpers, "getEntityDeltaFromPoint">,
) {
  const result: number[] = [];
  const halfArc = (arcDeg / 2) * (Math.PI / 180);
  const centerAngle = angleDeg * (Math.PI / 180);

  for (let index = 0; index < entities.length; index += 1) {
    const entity = entities[index] as any;
    if (isTerminalEntityState(entity.state)) continue;

    const { dx, dy } = getEntityDeltaFromPoint(cx, cy, entity);
    const distance = Math.hypot(dx, dy);
    const entityRadius = Math.max((entity.size ?? 12) * 0.5, 8);

    if (distance > depth + entityRadius) continue;
    if (distance < 1) {
      result.push(index);
      continue;
    }

    let diff = Math.atan2(dy, dx) - centerAngle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    if (Math.abs(diff) <= halfArc) {
      result.push(index);
    }
  }

  return result;
}

export function chainHitTestEntities(
  entities: Entity[],
  startIndex: number,
  chainRadius: number,
  maxBounces: number,
  { isToroidalEntity, width, height }: Pick<QueryHelpers, "height" | "isToroidalEntity" | "width">,
) {
  const result: number[] = [];
  if (startIndex < 0 || startIndex >= entities.length) return result;

  const visited = new Set<number>([startIndex]);
  let currentIndex = startIndex;

  for (let bounce = 0; bounce < maxBounces; bounce += 1) {
    const current = entities[currentIndex] as any;
    if (!current) break;

    let bestDist = Infinity;
    let bestIndex = -1;

    for (let index = 0; index < entities.length; index += 1) {
      if (visited.has(index)) continue;
      const entity = entities[index] as any;
      if (isTerminalEntityState(entity.state)) continue;
      const distance =
        isToroidalEntity(current) && isToroidalEntity(entity)
          ? getWrappedDistance(current.x, current.y, entity.x, entity.y, width, height)
          : Math.hypot(current.x - entity.x, current.y - entity.y);
      if (distance <= chainRadius && distance < bestDist) {
        bestDist = distance;
        bestIndex = index;
      }
    }

    if (bestIndex === -1) break;
    result.push(bestIndex);
    visited.add(bestIndex);
    currentIndex = bestIndex;
  }

  return result;
}

export function closestTargetIndexForEntities(
  entities: Entity[],
  cx: number,
  cy: number,
  searchRadius: number,
  { getDistanceFromPointToEntity }: Pick<QueryHelpers, "getDistanceFromPointToEntity">,
) {
  let bestIndex = -1;
  let bestHp = -1;
  let bestDist = Infinity;
  const useRadius = Number.isFinite(searchRadius) ? searchRadius : Infinity;

  for (let index = 0; index < entities.length; index += 1) {
    const entity = entities[index] as any;
    if (isTerminalEntityState(entity.state)) continue;
    const distance = getDistanceFromPointToEntity(cx, cy, entity);
    if (distance > useRadius) continue;
    const hp = entity.hp ?? 1;
    if (hp > bestHp || (hp === bestHp && distance < bestDist)) {
      bestHp = hp;
      bestDist = distance;
      bestIndex = index;
    }
  }

  return bestIndex;
}

export function chainHitTestPreferUnfrozenEntities(
  entities: Entity[],
  startIndex: number,
  chainRadius: number,
  maxBounces: number,
  {
    isToroidalEntity,
    width,
    height,
  }: Pick<QueryHelpers, "height" | "isToroidalEntity" | "width">,
) {
  const result: number[] = [];
  if (startIndex < 0 || startIndex >= entities.length) return result;

  const visited = new Set<number>([startIndex]);
  let currentIndex = startIndex;

  for (let bounce = 0; bounce < maxBounces; bounce += 1) {
    const current = entities[currentIndex] as any;
    if (!current) break;
    let bestDist = Infinity;
    let bestIndex = -1;
    let bestFrozen = true;
    const now = performance.now();

    for (let index = 0; index < entities.length; index += 1) {
      if (visited.has(index)) continue;
      const entity = entities[index] as any;
      if (isTerminalEntityState(entity.state)) continue;
      const distance =
        isToroidalEntity(current) && isToroidalEntity(entity)
          ? getWrappedDistance(current.x, current.y, entity.x, entity.y, width, height)
          : Math.hypot(current.x - entity.x, current.y - entity.y);
      if (distance > chainRadius) continue;

      const frozen = entity.slow != null && now < (entity.slow?.expiresAt ?? 0);
      if (
        bestIndex === -1 ||
        (!frozen && bestFrozen) ||
        (frozen === bestFrozen && distance < bestDist)
      ) {
        bestDist = distance;
        bestIndex = index;
        bestFrozen = frozen;
      }
    }

    if (bestIndex === -1) break;
    result.push(bestIndex);
    visited.add(bestIndex);
    currentIndex = bestIndex;
  }

  return result;
}