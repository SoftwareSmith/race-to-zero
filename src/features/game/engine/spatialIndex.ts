import { Entity } from "./Entity";
import { getWrappedDelta, wrapCoordinate } from "./toroidalMath";
import { isTerminalEntityState } from "@game/types";

type SpatialCell = Entity[];

export interface CrowdingSnapshot {
  centerX: number;
  centerY: number;
  count: number;
  score: number;
}

export function isToroidalEntity(entity: Entity | null | undefined): boolean {
  return Boolean(
    entity && "hasEnteredField" in entity && (entity as Entity & { hasEnteredField?: boolean }).hasEnteredField,
  );
}

export function getEntityDeltaFromPoint(
  x: number,
  y: number,
  entity: Entity,
  width: number,
  height: number,
) {
  if (isToroidalEntity(entity)) {
    return {
      dx: getWrappedDelta(x, entity.x, width),
      dy: getWrappedDelta(y, entity.y, height),
    };
  }

  return {
    dx: entity.x - x,
    dy: entity.y - y,
  };
}

export function getEntityDelta(a: Entity, b: Entity, width: number, height: number) {
  if (isToroidalEntity(a) && isToroidalEntity(b)) {
    return {
      dx: getWrappedDelta(a.x, b.x, width),
      dy: getWrappedDelta(a.y, b.y, height),
    };
  }

  return {
    dx: b.x - a.x,
    dy: b.y - a.y,
  };
}

export class EntitySpatialIndex {
  private width = 0;
  private height = 0;
  private spatialGrid = new Map<string, SpatialCell>();
  private spatialBucketPool: SpatialCell[] = [];
  private activeSpatialBuckets: SpatialCell[] = [];

  constructor(private readonly spatialCellSize: number) {}

  setBounds(width: number, height: number) {
    this.width = width;
    this.height = height;
  }

  rebuild(entities: Entity[]): void {
    for (const bucket of this.activeSpatialBuckets) {
      bucket.length = 0;
      this.spatialBucketPool.push(bucket);
    }

    this.activeSpatialBuckets.length = 0;
    this.spatialGrid.clear();

    const columnCount = this.getSpatialColumnCount();
    const rowCount = this.getSpatialRowCount();

    for (const entity of entities) {
      if (isTerminalEntityState((entity as any).state)) {
        continue;
      }

      const entityX = isToroidalEntity(entity)
        ? wrapCoordinate(entity.x, this.width)
        : entity.x;
      const entityY = isToroidalEntity(entity)
        ? wrapCoordinate(entity.y, this.height)
        : entity.y;
      const cellX = isToroidalEntity(entity)
        ? this.getWrappedCellIndex(Math.floor(entityX / this.spatialCellSize), columnCount)
        : Math.floor(entityX / this.spatialCellSize);
      const cellY = isToroidalEntity(entity)
        ? this.getWrappedCellIndex(Math.floor(entityY / this.spatialCellSize), rowCount)
        : Math.floor(entityY / this.spatialCellSize);
      const key = this.getSpatialKey(cellX, cellY);
      const bucket = this.spatialGrid.get(key);
      if (bucket) {
        bucket.push(entity);
        continue;
      }

      const nextBucket = this.spatialBucketPool.pop() ?? [];
      nextBucket.push(entity);
      this.spatialGrid.set(key, nextBucket);
      this.activeSpatialBuckets.push(nextBucket);
    }
  }

  getNeighbors(entity: Entity, radius: number): Entity[] {
    const radiusSquared = radius * radius;
    const neighbors: Entity[] = [];

    this.forEachCandidate(entity.x, entity.y, radius, isToroidalEntity(entity), (candidate) => {
      if (candidate === entity) {
        return;
      }

      const { dx, dy } = getEntityDelta(entity, candidate, this.width, this.height);
      if (dx * dx + dy * dy <= radiusSquared) {
        neighbors.push(candidate);
      }
    });

    return neighbors;
  }

  getCrowdingAt(x: number, y: number, radius: number, exclude?: Entity): CrowdingSnapshot {
    const radiusSquared = radius * radius;
    let count = 0;
    let weightedCount = 0;
    let centerX = 0;
    let centerY = 0;

    const useToroidal = isToroidalEntity(exclude);

    this.forEachCandidate(x, y, radius, useToroidal, (entity) => {
      if (entity === exclude) {
        return;
      }

      const { dx, dy } = useToroidal
        ? {
            dx: getWrappedDelta(x, entity.x, this.width),
            dy: getWrappedDelta(y, entity.y, this.height),
          }
        : {
            dx: entity.x - x,
            dy: entity.y - y,
          };
      const distanceSquared = dx * dx + dy * dy;
      if (distanceSquared > radiusSquared) {
        return;
      }

      const distance = Math.max(1, Math.sqrt(distanceSquared));
      const weight = 1 - distance / radius;
      count += 1;
      weightedCount += weight;
      centerX += (x + dx) * weight;
      centerY += (y + dy) * weight;
    });

    const averagedCenterX = weightedCount > 0 ? centerX / weightedCount : x;
    const averagedCenterY = weightedCount > 0 ? centerY / weightedCount : y;

    return {
      centerX: useToroidal ? wrapCoordinate(averagedCenterX, this.width) : averagedCenterX,
      centerY: useToroidal ? wrapCoordinate(averagedCenterY, this.height) : averagedCenterY,
      count,
      score: weightedCount,
    };
  }

  private forEachCandidate(
    x: number,
    y: number,
    radius: number,
    useToroidal: boolean,
    visit: (entity: Entity) => void,
  ): void {
    const minCellX = Math.floor((x - radius) / this.spatialCellSize);
    const maxCellX = Math.floor((x + radius) / this.spatialCellSize);
    const minCellY = Math.floor((y - radius) / this.spatialCellSize);
    const maxCellY = Math.floor((y + radius) / this.spatialCellSize);

    const columnCount = this.getSpatialColumnCount();
    const rowCount = this.getSpatialRowCount();
    const visitedKeys = useToroidal ? new Set<string>() : null;

    for (let cellY = minCellY; cellY <= maxCellY; cellY += 1) {
      for (let cellX = minCellX; cellX <= maxCellX; cellX += 1) {
        const lookupCellX = useToroidal
          ? this.getWrappedCellIndex(cellX, columnCount)
          : cellX;
        const lookupCellY = useToroidal
          ? this.getWrappedCellIndex(cellY, rowCount)
          : cellY;
        const key = this.getSpatialKey(lookupCellX, lookupCellY);
        if (visitedKeys?.has(key)) {
          continue;
        }
        visitedKeys?.add(key);

        const bucket = this.spatialGrid.get(key);
        if (!bucket?.length) {
          continue;
        }

        for (let index = 0; index < bucket.length; index += 1) {
          visit(bucket[index]);
        }
      }
    }
  }

  private getSpatialKey(cellX: number, cellY: number): string {
    return `${cellX}:${cellY}`;
  }

  private getSpatialColumnCount(): number {
    return Math.max(1, Math.ceil(this.width / this.spatialCellSize));
  }

  private getSpatialRowCount(): number {
    return Math.max(1, Math.ceil(this.height / this.spatialCellSize));
  }

  private getWrappedCellIndex(index: number, count: number): number {
    if (count <= 0) {
      return index;
    }

    const wrapped = index % count;
    return wrapped < 0 ? wrapped + count : wrapped;
  }
}