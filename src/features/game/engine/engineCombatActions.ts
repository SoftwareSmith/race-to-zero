import { isTerminalEntityState } from "@game/types";
import type { SiegeWeaponId } from "../types";
import type { Entity } from "./Entity";

interface TriggerKernelPanicExplosionOptions {
  damage: number;
  entities: Entity[];
  getDistanceFromPointToEntity: (x: number, y: number, entity: Entity) => number;
  handleHit: (index: number, damage: number, creditOnDeath?: boolean, weaponId?: SiegeWeaponId) => void;
  index: number;
  splashRadius: number;
  weaponId?: SiegeWeaponId;
}

export function triggerKernelPanicExplosionOnEntities({
  damage,
  entities,
  getDistanceFromPointToEntity,
  handleHit,
  index,
  splashRadius,
  weaponId,
}: TriggerKernelPanicExplosionOptions): void {
  const source = entities[index] as any;
  if (!source) {
    return;
  }

  const { x, y } = source;
  for (let currentIndex = 0; currentIndex < entities.length; currentIndex += 1) {
    if (currentIndex === index) {
      continue;
    }

    const entity = entities[currentIndex] as any;
    if (isTerminalEntityState(entity.state)) {
      continue;
    }

    if (getDistanceFromPointToEntity(x, y, entity) <= splashRadius) {
      handleHit(currentIndex, damage, false, weaponId);
    }
  }
}