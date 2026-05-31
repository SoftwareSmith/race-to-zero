import { afterEach, describe, expect, it, vi } from "vitest";

import { EntityState } from "@game/types";
import { BugEntity } from "./BugEntity";
import { Entity } from "./Entity";
import {
  beginEntitySteps,
  createBugUpdateContext,
  updateEntitiesForFrame,
} from "./engineUpdate";
import { DEFAULT_GAME_CONFIG } from "./types";

class LegacyEntity extends Entity {
  updateArgCount = 0;

  override update(dt: number): void {
    this.updateArgCount = arguments.length;
    this.x += dt;
  }
}

class TestBugEntity extends BugEntity {
  receivedContext: unknown = null;

  override update(_: number, context: unknown): void {
    this.receivedContext = context;
    this.state = EntityState.Dead;
  }
}

describe("engineUpdate", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("builds bound bug update context", () => {
    const getCrowdingAt = vi.fn(() => ({
      centerX: 10,
      centerY: 12,
      count: 2,
      score: 3,
    }));
    const getNeighbors = vi.fn(() => []);

    const context = createBugUpdateContext({
      config: DEFAULT_GAME_CONFIG,
      getCrowdingAt,
      getNeighbors,
      height: 200,
      targetX: 90,
      targetY: 120,
      width: 300,
    });

    expect(context.bounds).toEqual({ height: 200, width: 300 });
    expect(context.config).toBe(DEFAULT_GAME_CONFIG);
    expect(context.targetX).toBe(90);
    expect(context.targetY).toBe(120);

    context.getCrowdingAt(1, 2, 3);
    context.getNeighbors(new LegacyEntity({ x: 4, y: 5 }), 12);

    expect(getCrowdingAt).toHaveBeenCalledWith(1, 2, 3);
    expect(getNeighbors).toHaveBeenCalledTimes(1);
  });

  it("recycles dead bugs after update and reports death metadata", () => {
    vi.spyOn(performance, "now").mockReturnValue(1_000);

    const bug = new TestBugEntity({ size: 10, variant: "low", x: 80, y: 40 });
    bug.deathCredited = false;
    bug.deathPointValue = 3;
    bug.dotSourceWeaponId = "bug-spray";
    bug.finalBlowStatus = "poison";
    bug.slow = { expiresAt: 1_500, multiplier: 0.5 };
    bug.supportStatusesAtDeath = ["poison"];

    const entities: Entity[] = [bug];
    const pool: BugEntity[] = [];
    const onEntityDeath = vi.fn();
    const recordWeaponKill = vi.fn();
    const updateContext = createBugUpdateContext({
      config: DEFAULT_GAME_CONFIG,
      getCrowdingAt: () => ({ centerX: 0, centerY: 0, count: 0, score: 0 }),
      getNeighbors: () => [],
      height: 200,
      width: 200,
    });

    updateEntitiesForFrame({
      dt: 1 / 60,
      entities,
      onEntityDeath,
      pool,
      recordWeaponKill,
      updateContext,
    });

    expect(bug.receivedContext).toBe(updateContext);
    expect(recordWeaponKill).toHaveBeenCalledWith("bug-spray");
    expect(onEntityDeath).toHaveBeenCalledWith(
      80,
      40,
      "low",
      expect.objectContaining({
        credited: false,
        finisherStatus: "poison",
        frozen: true,
        pointValue: 3,
        supportStatuses: ["poison"],
      }),
    );
    expect(entities).toHaveLength(0);
    expect(pool).toEqual([bug]);
  });

  it("preserves legacy single-argument entity updates", () => {
    const entity = new LegacyEntity({ x: 10, y: 20 });
    const entities: Entity[] = [entity];

    beginEntitySteps(entities);
    updateEntitiesForFrame({
      dt: 0.5,
      entities,
      pool: [],
      recordWeaponKill: vi.fn(),
      updateContext: createBugUpdateContext({
        config: DEFAULT_GAME_CONFIG,
        getCrowdingAt: () => ({ centerX: 0, centerY: 0, count: 0, score: 0 }),
        getNeighbors: () => [],
        height: 100,
        width: 100,
      }),
    });

    expect(entity.prevX).toBe(10);
    expect(entity.prevY).toBe(20);
    expect(entity.updateArgCount).toBe(1);
    expect(entity.x).toBe(10.5);
    expect(entities).toEqual([entity]);
  });
});