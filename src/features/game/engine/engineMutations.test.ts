import { describe, expect, it, vi } from "vitest";

import { EntityState } from "@game/types";
import { BugEntity } from "./BugEntity";
import type { Entity } from "./Entity";
import { allyBugOnEntities, splitBugOnEntities } from "./engineMutations";

describe("engineMutations", () => {
  it("splits a bug into two half-health bugs and resets clone statuses", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);

    const source = new BugEntity({ size: 10, variant: "high", x: 100, y: 80 });
    source.maxHp = 9;
    source.hp = 9;

    const pooled = new BugEntity({ size: 10, variant: "low", x: 0, y: 0 });
    pooled.slow = { expiresAt: 1000, multiplier: 0.4 };
    pooled.poison = { accumulatedDmg: 0, dps: 1, expiresAt: 1000 };
    pooled.burn = { accumulatedDmg: 0, dps: 2, expiresAt: 1000, decayPerSecond: 0.1 };
    pooled.ensnare = { canInstakill: true, expiresAt: 1000 };
    pooled.charged = { expiresAt: 1000 };
    pooled.marked = { expiresAt: 1000 };
    pooled.unstable = { expiresAt: 1000 };
    pooled.looped = { accumulatedDmg: 0, dps: 1, expiresAt: 1000 };
    pooled.ally = {
      expireBurstDamage: 1,
      expireBurstRadius: 1,
      expiresAt: 1000,
      interceptForce: 1,
    };
    pooled.dotSourceWeaponId = "bug-spray";
    pooled.deathCredited = true;
    pooled.deathProgress = 0.7;

    const entities: Entity[] = [source];
    splitBugOnEntities({
      entities,
      height: 200,
      index: 0,
      isToroidalEntity: () => false,
      pool: [pooled],
      width: 200,
    });

    const clone = entities[1] as BugEntity;
    expect(entities).toHaveLength(2);
    expect(source.hp).toBe(5);
    expect(clone).toBe(pooled);
    expect(clone.hp).toBe(5);
    expect(clone.maxHp).toBe(9);
    expect(clone.variant).toBe("high");
    expect(clone.state).toBe("patrol");
    expect(clone.x).toBe(100);
    expect(clone.y).toBe(80);
    expect(clone.deathCredited).toBe(false);
    expect(clone.deathProgress).toBe(0);
    expect(clone.dotSourceWeaponId).toBeNull();
    expect(clone.slow).toBeNull();
    expect(clone.poison).toBeNull();
    expect(clone.burn).toBeNull();
    expect(clone.ensnare).toBeNull();
    expect(clone.charged).toBeNull();
    expect(clone.marked).toBeNull();
    expect(clone.unstable).toBeNull();
    expect(clone.looped).toBeNull();
    expect(clone.ally).toBeNull();
  });

  it("respects configurable ally caps and ignores dead bugs", () => {
    vi.spyOn(performance, "now").mockReturnValue(500);

    const active = Array.from({ length: 4 }, (_, index) =>
      new BugEntity({ size: 10, variant: "low", x: 40 + index * 10, y: 100 }),
    );
    const dead = new BugEntity({ size: 10, variant: "low", x: 100, y: 100 });
    dead.state = EntityState.Dead;

    const entities: Entity[] = [...active, dead];

    for (let index = 0; index < entities.length; index += 1) {
      allyBugOnEntities({
        config: { durationMs: 2000, maxActiveAllies: 2 },
        defaultMaxActiveAllies: 5,
        entities,
        index,
      });
    }

    const allies = entities.filter((entity) => (entity as BugEntity).ally);
    expect(allies).toHaveLength(2);
    expect((dead as BugEntity).ally).toBeNull();
  });
});