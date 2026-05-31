import { describe, expect, it } from "vitest";

import { BugEntity } from "./BugEntity";
import type { Entity } from "./Entity";
import {
  applyBurnInRadiusToEntities,
  applyChargedInRadiusToEntities,
  applyEnsnareInRadiusToEntities,
  applyMarkedInRadiusToEntities,
  applyPoisonInRadiusToEntities,
  applyUnstableInRadiusToEntities,
  propagateChargedNetworkOnEntities,
  triggerAutoScalerPulseOnEntities,
} from "./engineStatusEffects";

function distanceToEntity(x: number, y: number, entity: Entity) {
  return Math.hypot(entity.x - x, entity.y - y);
}

describe("engineStatusEffects", () => {
  it("applies radius-based statuses to nearby bugs", () => {
    const bug = new BugEntity({ size: 10, variant: "low", x: 100, y: 100 });
    const entities = [bug];

    applyPoisonInRadiusToEntities(entities, 100, 100, 20, 4, 800, distanceToEntity);
    applyBurnInRadiusToEntities(entities, 100, 100, 20, 6, 1200, 3.2, distanceToEntity);
    applyEnsnareInRadiusToEntities(entities, 100, 100, 20, 700, distanceToEntity);
    applyChargedInRadiusToEntities(entities, 100, 100, 20, 500, distanceToEntity);
    applyMarkedInRadiusToEntities(entities, 100, 100, 20, 500, distanceToEntity);
    applyUnstableInRadiusToEntities(entities, 100, 100, 20, 500, distanceToEntity);

    expect(bug.poison).not.toBeNull();
    expect(bug.burn).not.toBeNull();
    expect(bug.ensnare).not.toBeNull();
    expect(bug.charged).not.toBeNull();
    expect(bug.marked).not.toBeNull();
    expect(bug.unstable).not.toBeNull();
  });

  it("propagates charged damage and marks low-health marked bugs for death", () => {
    const charged = new BugEntity({ size: 10, variant: "low", x: 10, y: 10 });
    const marked = new BugEntity({ size: 10, variant: "low", x: 20, y: 10 });

    charged.charged = { expiresAt: performance.now() + 500 } as any;
    marked.marked = { expiresAt: performance.now() + 500 } as any;
    marked.hp = 1;
    marked.maxHp = 10;

    propagateChargedNetworkOnEntities([charged], 10, 0.5, "chain");
    triggerAutoScalerPulseOnEntities([marked], 0.2, "plasma");

    expect(charged.state).toBe("dying");
    expect(charged.dotSourceWeaponId).toBe("chain");
    expect(marked.state).toBe("dying");
    expect(marked.dotSourceWeaponId).toBe("plasma");
  });
});