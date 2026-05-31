import { describe, expect, it, vi } from "vitest";

import { EntityState } from "@game/types";
import { BugEntity } from "./BugEntity";
import type { Entity } from "./Entity";
import { triggerKernelPanicExplosionOnEntities } from "./engineCombatActions";

describe("engineCombatActions", () => {
  it("damages nearby non-terminal bugs and skips the source", () => {
    const source = new BugEntity({ size: 10, variant: "high", x: 100, y: 100 });
    const nearby = new BugEntity({ size: 10, variant: "low", x: 120, y: 100 });
    const distant = new BugEntity({ size: 10, variant: "medium", x: 180, y: 100 });
    const dead = new BugEntity({ size: 10, variant: "urgent", x: 110, y: 100 });
    dead.state = EntityState.Dead;

    const entities: Entity[] = [source, nearby, distant, dead];
    const handleHit = vi.fn();

    triggerKernelPanicExplosionOnEntities({
      damage: 3,
      entities,
      getDistanceFromPointToEntity: (x, y, entity) => Math.hypot(entity.x - x, entity.y - y),
      handleHit,
      index: 0,
      splashRadius: 30,
      weaponId: "daemon",
    });

    expect(handleHit).toHaveBeenCalledTimes(1);
    expect(handleHit).toHaveBeenCalledWith(1, 3, false, "daemon");
  });

  it("does nothing when the source bug does not exist", () => {
    const handleHit = vi.fn();

    triggerKernelPanicExplosionOnEntities({
      damage: 3,
      entities: [],
      getDistanceFromPointToEntity: () => 0,
      handleHit,
      index: 0,
      splashRadius: 30,
      weaponId: "daemon",
    });

    expect(handleHit).not.toHaveBeenCalled();
  });
});