import { describe, expect, it, vi } from "vitest";

import { BugEntity } from "./BugEntity";
import type { Entity } from "./Entity";
import {
  chainHitTestEntities,
  chainHitTestPreferUnfrozenEntities,
  closestTargetIndexForEntities,
  coneHitTestEntities,
  hitTestEntity,
  lineHitTestEntities,
  radiusHitTestEntities,
} from "./engineQueries";

function getDistanceFromPointToEntity(x: number, y: number, entity: Entity) {
  return Math.hypot(entity.x - x, entity.y - y);
}

function getEntityDeltaFromPoint(x: number, y: number, entity: Entity) {
  return { dx: entity.x - x, dy: entity.y - y };
}

describe("engineQueries", () => {
  it("finds point, line, and radius hits", () => {
    const entities = [
      new BugEntity({ size: 10, variant: "low", x: 12, y: 10 }),
      new BugEntity({ size: 10, variant: "low", x: 80, y: 80 }),
    ];

    expect(
      hitTestEntity(entities, 10, 10, { getDistanceFromPointToEntity }),
    ).toEqual({ distance: 2, index: 0 });
    expect(
      lineHitTestEntities(entities, 0, 10, 20, 10, 0, {
        getEntityDeltaFromPoint,
      }),
    ).toEqual([0]);
    expect(
      radiusHitTestEntities(entities, 10, 10, 4, { getDistanceFromPointToEntity }),
    ).toEqual([0]);
  });

  it("supports cone, chain, closest-target, and unfrozen-preferred chain queries", () => {
    vi.spyOn(performance, "now").mockReturnValue(1000);
    const entities = [
      new BugEntity({ size: 10, variant: "low", x: 10, y: 10 }),
      new BugEntity({ size: 10, variant: "low", x: 20, y: 10 }),
      new BugEntity({ size: 10, variant: "low", x: 30, y: 10 }),
    ];
    (entities[1] as any).slow = { expiresAt: 2000 };
    (entities[2] as any).hp = 5;

    expect(
      coneHitTestEntities(entities, 0, 10, 0, 60, 40, { getEntityDeltaFromPoint }),
    ).toEqual([0, 1, 2]);
    expect(
      chainHitTestEntities(entities, 0, 15, 2, {
        height: 100,
        isToroidalEntity: () => false,
        width: 100,
      }),
    ).toEqual([1, 2]);
    expect(
      closestTargetIndexForEntities(entities, 0, 10, 100, {
        getDistanceFromPointToEntity,
      }),
    ).toBe(2);
    expect(
      chainHitTestPreferUnfrozenEntities(entities, 0, 25, 1, {
        height: 100,
        isToroidalEntity: () => false,
        width: 100,
      }),
    ).toEqual([2]);
    vi.restoreAllMocks();
  });
});