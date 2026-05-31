import { isTerminalEntityState } from "@game/types";
import type { SiegeWeaponId } from "../types";
import type { Entity } from "./Entity";
import { getWrappedDelta } from "./toroidalMath";

export interface EventHorizonState {
  x: number;
  y: number;
  radius: number;
  expiresAt: number;
  weaponId?: SiegeWeaponId;
}

export interface EngineBlackHoleState {
  x: number;
  y: number;
  radius: number;
  coreRadius: number;
  collapseDamage: number;
  startedAt: number;
  durationMs: number;
  active: boolean;
  weaponId?: SiegeWeaponId;
  eventHorizonRadius?: number;
  eventHorizonDurationMs?: number;
}

interface StartBlackHoleStateOptions {
  x: number;
  y: number;
  radius: number;
  coreRadius: number;
  durationMs: number;
  collapseDamage: number;
  elapsedMs: number;
  weaponId?: SiegeWeaponId;
  eventHorizonRadius?: number;
  eventHorizonDurationMs?: number;
}

interface TickBlackHoleStateOptions {
  blackHole: EngineBlackHoleState | null;
  dtMs: number;
  elapsedMs: number;
  entities: Entity[];
  height: number;
  width: number;
  handleHit: (index: number, damage: number, creditOnDeath?: boolean, weaponId?: SiegeWeaponId) => void;
  isToroidalEntity: (entity: Entity | null | undefined) => boolean;
  onCollapse: (x: number, y: number, radius: number) => void;
  radiusHitTest: (x: number, y: number, radius: number) => number[];
  startEventHorizon: (x: number, y: number, radius: number, durationMs: number, weaponId?: SiegeWeaponId) => void;
}

interface TickEventHorizonsOptions {
  elapsedMs: number;
  entities: Entity[];
  eventHorizons: EventHorizonState[];
  getDistanceFromPointToEntity: (x: number, y: number, entity: Entity) => number;
  handleHit: (index: number, damage: number, creditOnDeath?: boolean, weaponId?: SiegeWeaponId) => void;
}

export function startBlackHoleState(
  currentBlackHole: EngineBlackHoleState | null,
  {
    x,
    y,
    radius,
    coreRadius,
    durationMs,
    collapseDamage,
    elapsedMs,
    weaponId,
    eventHorizonRadius,
    eventHorizonDurationMs,
  }: StartBlackHoleStateOptions,
): { blackHole: EngineBlackHoleState | null; started: boolean } {
  if (currentBlackHole?.active) {
    return { blackHole: currentBlackHole, started: false };
  }

  return {
    blackHole: {
      x,
      y,
      radius,
      coreRadius,
      collapseDamage,
      startedAt: elapsedMs,
      durationMs,
      active: true,
      weaponId,
      eventHorizonRadius,
      eventHorizonDurationMs,
    },
    started: true,
  };
}

export function startEventHorizonState(
  eventHorizons: EventHorizonState[],
  elapsedMs: number,
  x: number,
  y: number,
  radius: number,
  durationMs: number,
  weaponId?: SiegeWeaponId,
): EventHorizonState[] {
  return [
    ...eventHorizons,
    {
      x,
      y,
      radius,
      expiresAt: elapsedMs + durationMs,
      weaponId,
    },
  ];
}

export function tickBlackHoleState({
  blackHole,
  dtMs,
  elapsedMs,
  entities,
  handleHit,
  isToroidalEntity,
  onCollapse,
  radiusHitTest,
  startEventHorizon,
  width,
  height,
}: TickBlackHoleStateOptions): EngineBlackHoleState | null {
  void height;
  if (!blackHole?.active) {
    return blackHole;
  }

  const age = elapsedMs - blackHole.startedAt;
  const {
    x,
    y,
    radius,
    coreRadius,
    collapseDamage,
    durationMs,
    weaponId,
    eventHorizonRadius,
    eventHorizonDurationMs,
  } = blackHole;

  for (let index = 0; index < entities.length; index += 1) {
    const bug = entities[index] as any;
    if (isTerminalEntityState(bug.state)) {
      continue;
    }

    const dx = isToroidalEntity(bug)
      ? getWrappedDelta(bug.x, x, width)
      : x - bug.x;
    const dy = isToroidalEntity(bug)
      ? getWrappedDelta(bug.y, y, height)
      : y - bug.y;
    const distance = Math.hypot(dx, dy);

    if (distance > radius || distance < 1) {
      continue;
    }

    const pull = (1 - distance / radius) * 2.5 * (dtMs / 16);
    bug.x += (dx / distance) * pull;
    bug.y += (dy / distance) * pull;

    if (distance <= coreRadius) {
      handleHit(index, bug.maxHp ?? 99, false, weaponId);
    }
  }

  if (age < durationMs) {
    return blackHole;
  }

  const hits = radiusHitTest(x, y, radius);
  for (const index of hits) {
    handleHit(index, collapseDamage, false, weaponId);
  }

  if (eventHorizonRadius && eventHorizonDurationMs) {
    startEventHorizon(x, y, eventHorizonRadius, eventHorizonDurationMs, weaponId);
  }

  onCollapse(x, y, radius);
  return null;
}

export function tickEventHorizons({
  elapsedMs,
  entities,
  eventHorizons,
  getDistanceFromPointToEntity,
  handleHit,
}: TickEventHorizonsOptions): EventHorizonState[] {
  const activeHorizons = eventHorizons.filter((horizon) => horizon.expiresAt > elapsedMs);

  for (const horizon of activeHorizons) {
    for (let index = 0; index < entities.length; index += 1) {
      const bug = entities[index] as any;
      if (isTerminalEntityState(bug.state)) {
        continue;
      }
      if (
        bug.unstable &&
        getDistanceFromPointToEntity(horizon.x, horizon.y, bug) <= horizon.radius
      ) {
        bug.unstable = null;
        handleHit(index, bug.maxHp ?? 99, false, horizon.weaponId);
      }
    }
  }

  return activeHorizons;
}