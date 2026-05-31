import { describe, expect, it } from "vitest";

import {
  applyAllyToBug,
  applyBurnToBug,
  applyChargedToBug,
  applyEnsnareToBug,
  applyFreezeToBug,
  applyLoopedToBug,
  applyMarkedToBug,
  applyPoisonToBug,
  applyUnstableToBug,
  type BugStatusApplicationTarget,
} from "./bugStatusApplications";

function createTarget(): BugStatusApplicationTarget {
  return {
    ally: null,
    allyContactReadyAt: 0,
    burn: null,
    charged: null,
    dotSourceWeaponId: null,
    ensnare: null,
    fleeTimer: 3,
    looped: null,
    marked: null,
    poison: null,
    slow: null,
    state: "flee",
    unstable: null,
    vx: 6,
    vy: -4,
  };
}

describe("bugStatusApplications", () => {
  it("extends freeze and poison durations while retaining weapon attribution", () => {
    const bug = createTarget();

    applyFreezeToBug(bug, 0.5, 1000, 100);
    applyFreezeToBug(bug, 0.5, 400, 200);
    applyPoisonToBug(bug, 4, 1200, 100, "daemon");
    applyPoisonToBug(bug, 2, 500, 200, undefined);

    expect(bug.slow).toEqual({ multiplier: 0.5, expiresAt: 1500 });
    expect(bug.poison).toEqual(
      expect.objectContaining({ dps: 4, expiresAt: 1800, sourceWeaponId: "daemon" }),
    );
    expect(bug.dotSourceWeaponId).toBe("daemon");
  });

  it("keeps stronger burn and looped values on reapplication", () => {
    const bug = createTarget();

    applyBurnToBug(bug, 3, 1000, 100, 2.2, "plasma");
    applyBurnToBug(bug, 5, 400, 200, 3.2, undefined);
    applyLoopedToBug(bug, 1, 500, 100, "void");
    applyLoopedToBug(bug, 4, 300, 200, undefined);

    expect(bug.burn).toEqual(
      expect.objectContaining({ dps: 5, decayPerSecond: 3.2, expiresAt: 1100, sourceWeaponId: "plasma" }),
    );
    expect(bug.looped).toEqual(
      expect.objectContaining({ dps: 4, expiresAt: 600 }),
    );
    expect(bug.dotSourceWeaponId).toBe("void");
  });

  it("extends timed charged, marked, and unstable statuses", () => {
    const bug = createTarget();

    applyChargedToBug(bug, 500, 100);
    applyChargedToBug(bug, 400, 200);
    applyMarkedToBug(bug, 250, 300);
    applyMarkedToBug(bug, 250, 400);
    applyUnstableToBug(bug, 300, 500);
    applyUnstableToBug(bug, 200, 600);

    expect(bug.charged?.expiresAt).toBe(1000);
    expect(bug.marked?.expiresAt).toBe(800);
    expect(bug.unstable?.expiresAt).toBe(1000);
  });

  it("ally and ensnare reset motion state and clear transient combat state", () => {
    const bug = createTarget();
    bug.dotSourceWeaponId = "daemon";

    applyAllyToBug(
      bug,
      { durationMs: 1200, expireBurstDamage: 2, expireBurstRadius: 20, interceptForce: 3 },
      100,
    );

    expect(bug.ally).toEqual(
      expect.objectContaining({ expiresAt: 1300, expireBurstDamage: 2, expireBurstRadius: 20, interceptForce: 3 }),
    );
    expect(bug.allyContactReadyAt).toBe(280);
    expect(bug.dotSourceWeaponId).toBeNull();
    expect(bug.state).toBe("patrol");
    expect(bug.fleeTimer).toBeNull();

    bug.vx = 9;
    bug.vy = -7;
    bug.state = "flee";
    bug.fleeTimer = 1;
    applyEnsnareToBug(bug, 900, 500);

    expect(bug.ensnare).toEqual({ canInstakill: true, expiresAt: 1400 });
    expect(bug.vx).toBe(0);
    expect(bug.vy).toBe(0);
    expect(bug.state).toBe("patrol");
    expect(bug.fleeTimer).toBeNull();
  });
});