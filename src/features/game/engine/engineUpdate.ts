import type { SiegeStatusId } from "@game/status/statusCatalog";
import { EntityState } from "@game/types";
import type { BugVariant } from "../../../types/dashboard";
import type { SiegeWeaponId } from "../types";
import { BugEntity } from "./BugEntity";
import { Entity } from "./Entity";
import type { GameConfig } from "./types";

export interface BugUpdateContextLike {
  bounds: {
    height: number;
    width: number;
  };
  config: GameConfig;
  getCrowdingAt: (x: number, y: number, radius: number, exclude?: Entity) => {
    centerX: number;
    centerY: number;
    count: number;
    score: number;
  };
  getNeighbors: (entity: Entity, radius: number) => Entity[];
  targetX?: number | null;
  targetY?: number | null;
}

interface CreateBugUpdateContextOptions {
  config: GameConfig;
  getCrowdingAt: (x: number, y: number, radius: number, exclude?: Entity) => {
    centerX: number;
    centerY: number;
    count: number;
    score: number;
  };
  getNeighbors: (entity: Entity, radius: number) => Entity[];
  height: number;
  targetX?: number | null;
  targetY?: number | null;
  width: number;
}

interface DeathMeta {
  credited: boolean;
  finisherStatus?: SiegeStatusId | null;
  frozen: boolean;
  pointValue: number;
  supportStatuses?: SiegeStatusId[];
}

interface UpdateEntitiesForFrameOptions {
  dt: number;
  entities: Entity[];
  onEntityDeath?: (x: number, y: number, variant: string, meta: DeathMeta) => void;
  pool: BugEntity[];
  recordWeaponKill: (weaponId?: SiegeWeaponId) => void;
  updateContext: BugUpdateContextLike;
}

export function beginEntitySteps(entities: Entity[]) {
  for (const entity of entities) {
    entity.beginStep();
  }
}

export function createBugUpdateContext({
  config,
  getCrowdingAt,
  getNeighbors,
  height,
  targetX,
  targetY,
  width,
}: CreateBugUpdateContextOptions): BugUpdateContextLike {
  return {
    bounds: { height, width },
    config,
    getCrowdingAt,
    getNeighbors,
    targetX,
    targetY,
  };
}

export function updateEntitiesForFrame({
  dt,
  entities,
  onEntityDeath,
  pool,
  recordWeaponKill,
  updateContext,
}: UpdateEntitiesForFrameOptions) {
  for (let index = entities.length - 1; index >= 0; index -= 1) {
    const entity = entities[index];

    if ((entity as any).update.length >= 2) {
      (entity as any).update(dt, updateContext);
    } else {
      (entity as any).update(dt);
    }

    if ((entity as any).state !== EntityState.Dead) {
      continue;
    }

    const bug = entity as BugEntity;

    if (
      bug.dotSourceWeaponId &&
      !bug.deathCredited &&
      (bug.finalBlowStatus === "poison" ||
        bug.finalBlowStatus === "burn" ||
        bug.finalBlowStatus === "looped")
    ) {
      recordWeaponKill(bug.dotSourceWeaponId as SiegeWeaponId);
    }

    try {
      onEntityDeath?.(bug.x, bug.y, bug.variant as BugVariant, {
        credited: bug.deathCredited,
        finisherStatus: bug.finalBlowStatus,
        frozen: bug.slow !== null && performance.now() < bug.slow.expiresAt,
        pointValue: bug.deathPointValue,
        supportStatuses: bug.supportStatusesAtDeath,
      });
    } catch {
      void 0;
    }

    pool.push(bug);
    entities.splice(index, 1);
  }
}