import { describe, expect, it, vi } from "vitest";

import { EntityState } from "@game/types";
import { BugEntity } from "./BugEntity";
import type { Entity } from "./Entity";
import {
  startBlackHoleState,
  startEventHorizonState,
  tickBlackHoleState,
  tickEventHorizons,
} from "./engineVoidEffects";

describe("engineVoidEffects", () => {
  it("starts black holes once and blocks duplicates while active", () => {
    const first = startBlackHoleState(null, {
      collapseDamage: 3,
      coreRadius: 24,
      durationMs: 1000,
      elapsedMs: 200,
      radius: 80,
      x: 10,
      y: 20,
    });

    const second = startBlackHoleState(first.blackHole, {
      collapseDamage: 5,
      coreRadius: 30,
      durationMs: 1500,
      elapsedMs: 400,
      radius: 100,
      x: 50,
      y: 60,
    });

    expect(first.started).toBe(true);
    expect(first.blackHole).toEqual(
      expect.objectContaining({ active: true, startedAt: 200, x: 10, y: 20 }),
    );
    expect(second.started).toBe(false);
    expect(second.blackHole).toBe(first.blackHole);
  });

  it("kills core contacts, collapses, and spawns an event horizon", () => {
    const bug = new BugEntity({ size: 10, variant: "high", x: 112, y: 100 });
    const entities: Entity[] = [bug];
    const handleHit = vi.fn();
    const onCollapse = vi.fn();
    const startEventHorizon = vi.fn();

    const started = startBlackHoleState(null, {
      collapseDamage: 4,
      coreRadius: 24,
      durationMs: 1000,
      elapsedMs: 0,
      eventHorizonDurationMs: 5000,
      eventHorizonRadius: 140,
      radius: 80,
      weaponId: "void",
      x: 100,
      y: 100,
    });

    const afterTick = tickBlackHoleState({
      blackHole: started.blackHole,
      dtMs: 16,
      elapsedMs: 1000,
      entities,
      handleHit,
      height: 200,
      isToroidalEntity: () => false,
      onCollapse,
      radiusHitTest: () => [0],
      startEventHorizon,
      width: 200,
    });

    expect(handleHit).toHaveBeenCalledWith(0, bug.maxHp, false, "void");
    expect(handleHit).toHaveBeenCalledWith(0, 4, false, "void");
    expect(startEventHorizon).toHaveBeenCalledWith(100, 100, 140, 5000, "void");
    expect(onCollapse).toHaveBeenCalledWith(100, 100, 80);
    expect(afterTick).toBeNull();
  });

  it("filters expired horizons and consumes unstable bugs inside them", () => {
    const unstable = new BugEntity({ size: 10, variant: "medium", x: 100, y: 100 });
    unstable.state = "patrol";
    unstable.unstable = { expiresAt: 5000 };

    const safe = new BugEntity({ size: 10, variant: "low", x: 180, y: 180 });
    safe.state = EntityState.Dead;
    safe.unstable = { expiresAt: 5000 };

    const nextHorizons = tickEventHorizons({
      elapsedMs: 2000,
      entities: [unstable, safe],
      eventHorizons: startEventHorizonState([], 1000, 100, 100, 40, 500, "void").concat(
        startEventHorizonState([], 1000, 100, 100, 40, 5000, "void"),
      ),
      getDistanceFromPointToEntity: (x, y, entity) => Math.hypot(entity.x - x, entity.y - y),
      handleHit: vi.fn(),
    });

    expect(nextHorizons).toHaveLength(1);
    expect(unstable.unstable).toBeNull();
  });
});