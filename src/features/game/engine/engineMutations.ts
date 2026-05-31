import { isTerminalEntityState } from "@game/types";
import type { AllyConversionConfig } from "@game/weapons/runtime/types";
import { BugEntity } from "./BugEntity";
import type { Entity } from "./Entity";
import { wrapCoordinate } from "./toroidalMath";

interface SplitBugOnEntitiesOptions {
  entities: Entity[];
  height: number;
  index: number;
  isToroidalEntity: (entity: Entity | null | undefined) => boolean;
  pool: BugEntity[];
  width: number;
}

interface AllyBugOnEntitiesOptions {
  config: AllyConversionConfig;
  defaultMaxActiveAllies: number;
  entities: Entity[];
  index: number;
}

export function splitBugOnEntities({
  entities,
  height,
  index,
  isToroidalEntity,
  pool,
  width,
}: SplitBugOnEntitiesOptions): void {
  const entity = entities[index] as any;
  if (!entity || isTerminalEntityState(entity.state)) {
    return;
  }

  entity.hp = Math.max(1, Math.ceil(entity.maxHp / 2));

  const clone = pool.pop() ?? new BugEntity();
  clone.x = isToroidalEntity(entity)
    ? wrapCoordinate(entity.x + (Math.random() - 0.5) * 40, width)
    : entity.x + (Math.random() - 0.5) * 40;
  clone.y = isToroidalEntity(entity)
    ? wrapCoordinate(entity.y + (Math.random() - 0.5) * 40, height)
    : entity.y + (Math.random() - 0.5) * 40;
  clone.maxHp = entity.maxHp;
  clone.hp = Math.max(1, Math.ceil(entity.maxHp / 2));
  clone.variant = entity.variant;
  clone.state = "patrol";
  clone.deathCredited = false;
  clone.deathProgress = 0;
  clone.dotSourceWeaponId = null;
  clone.slow = null;
  clone.poison = null;
  clone.burn = null;
  clone.ensnare = null;
  clone.charged = null;
  clone.marked = null;
  clone.unstable = null;
  clone.looped = null;
  clone.ally = null;
  entities.push(clone);
}

export function allyBugOnEntities({
  config,
  defaultMaxActiveAllies,
  entities,
  index,
}: AllyBugOnEntitiesOptions): void {
  const entity = entities[index] as any;
  if (!entity || isTerminalEntityState(entity.state)) {
    return;
  }

  const maxActiveAllies = config.maxActiveAllies ?? defaultMaxActiveAllies;
  const activeAllies = entities.reduce((count, current) => {
    const bug = current as any;
    return bug.ally && !isTerminalEntityState(bug.state) ? count + 1 : count;
  }, 0);

  if (!entity.ally && activeAllies >= maxActiveAllies) {
    return;
  }

  if (typeof entity.applyAlly === "function") {
    entity.applyAlly(config);
  }
}