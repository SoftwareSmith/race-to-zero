/**
 * Structure behavior unit tests.
 *
 * Each test builds a minimal mock StructureGameEngine, calls tick(), and
 * asserts the resulting state mutations and callback invocations.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type {
  StructureGameEngine,
  StructureEntry,
  StructureTickContext,
  BugSnapshot,
} from "../runtime/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeBug(overrides: Partial<BugSnapshot & { x: number; y: number }> = {}): BugSnapshot & any {
  return {
    x: 100,
    y: 100,
    variant: "low",
    state: "alive",
    size: 10,
    hp: 2,
    ...overrides,
  };
}

function makeMockEngine(
  bugs: (BugSnapshot & any)[] = [makeBug()],
  elapsedMs = 0,
): StructureGameEngine & { _bugs: (BugSnapshot & any)[] } {
  const state = { bugs: [...bugs], elapsedMs };
  return {
    _bugs: state.bugs,
    get elapsedMs() { return state.elapsedMs; },
    getEntities: vi.fn(() => state.bugs),
    spliceEntity: vi.fn((index) => {
      const [removed] = state.bugs.splice(index, 1);
      return removed;
    }),
    returnToPool: vi.fn(),
    handleHit: vi.fn(() => ({
      defeated: true,
      remainingHp: 0,
      pointValue: 1,
      frozen: false,
      variant: "low",
    })),
  };
}

function makeEntry(
  type: StructureEntry["type"],
  overrides: Partial<StructureEntry> = {},
): StructureEntry {
  return {
    id: `${type}-test`,
    type,
    x: 200,
    y: 200,
    nextCaptureAt: 0,
    absorbing: null,
    placedAt: 0,
    firewallNextDamageAt: 0,
    ...overrides,
  };
}

function makeCtx(
  engine: StructureGameEngine,
  now = 1000,
  callbacks: Partial<StructureTickContext["callbacks"]> = {},
): StructureTickContext {
  return {
    now,
    dtMs: 16,
    engine,
    callbacks: {
      onStructureKill: vi.fn(),
      onAgentAbsorb: vi.fn(),
      onTurretFire: vi.fn(),
      onTeslaFire: vi.fn(),
      ...callbacks,
    },
  };
}

// ---------------------------------------------------------------------------
// Lantern
// ---------------------------------------------------------------------------

describe("lantern behavior", () => {
  it("moves bugs within attract radius toward an orbit", async () => {
    const { lanternBehavior } = await import("../lantern/behavior");
    // Place a bug 100px from the lantern at (200, 200)
    const bug = makeBug({ x: 280, y: 200 });
    const engine = makeMockEngine([bug]);
    const entry = makeEntry("lantern");
    const ctx = makeCtx(engine);

    lanternBehavior.tick(entry, ctx);

    // Bug should have moved (tangential + radial forces applied)
    const updated = engine.getEntities()[0] as any;
    expect(updated.x).not.toBe(280);
  });

  it("does not move dead bugs", async () => {
    const { lanternBehavior } = await import("../lantern/behavior");
    const bug = makeBug({ x: 280, y: 200, state: "dead" });
    const engine = makeMockEngine([bug]);
    const entry = makeEntry("lantern");

    lanternBehavior.tick(entry, makeCtx(engine));

    expect((engine.getEntities()[0] as any).x).toBe(280);
  });

  it("ignores bugs outside attract radius", async () => {
    const { lanternBehavior } = await import("../lantern/behavior");
    const bug = makeBug({ x: 600, y: 200 }); // 400px away, radius=280
    const engine = makeMockEngine([bug]);
    const entry = makeEntry("lantern");

    lanternBehavior.tick(entry, makeCtx(engine));

    expect((engine.getEntities()[0] as any).x).toBe(600);
  });
});

// ---------------------------------------------------------------------------
// Agent
// ---------------------------------------------------------------------------

describe("agent behavior", () => {
  beforeEach(() => { vi.restoreAllMocks(); });

  it("does not capture when cooldown has not elapsed", async () => {
    const { agentBehavior } = await import("../agent/behavior");
    const engine = makeMockEngine([makeBug({ x: 210, y: 200 })]);
    const entry = makeEntry("agent", { nextCaptureAt: 5000 });
    agentBehavior.tick(entry, makeCtx(engine, 1000));
    expect(engine.spliceEntity).not.toHaveBeenCalled();
  });

  it("captures and removes nearest bug when ready", async () => {
    const { agentBehavior } = await import("../agent/behavior");
    const bug = makeBug({ x: 210, y: 200 }); // 10px from agent at 200,200
    const engine = makeMockEngine([bug]);
    const entry = makeEntry("agent", { nextCaptureAt: 0 });
    const ctx = makeCtx(engine, 1000);

    agentBehavior.tick(entry, ctx);

    expect(engine.spliceEntity).toHaveBeenCalledWith(0);
    expect(entry.absorbing).not.toBeNull();
    expect(ctx.callbacks.onAgentAbsorb).toHaveBeenCalledWith(
      expect.objectContaining({ phase: "absorbing" }),
    );
  });

  it("fires onStructureKill on successful completion", async () => {
    const { agentBehavior } = await import("../agent/behavior");
    vi.spyOn(Math, "random").mockReturnValue(0.9); // always succeed (failChance=0.2)
    const engine = makeMockEngine([]);
    const entry = makeEntry("agent", {
      nextCaptureAt: 0,
      absorbing: {
        variant: "medium",
        bugX: 200,
        bugY: 200,
        pullFromX: 200,
        pullFromY: 200,
        pullStartedAt: 0,
        size: 10,
        completesAt: 500, // already elapsed at now=1000
        failChance: 0.2,
      },
    });
    const ctx = makeCtx(engine, 1000);

    agentBehavior.tick(entry, ctx);

    expect(ctx.callbacks.onStructureKill).toHaveBeenCalled();
    expect(ctx.callbacks.onAgentAbsorb).toHaveBeenCalledWith(
      expect.objectContaining({ phase: "done" }),
    );
    expect(entry.absorbing).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Turret
// ---------------------------------------------------------------------------

describe("turret behavior", () => {
  it("does nothing when cooldown has not elapsed", async () => {
    const { turretBehavior } = await import("../turret/behavior");
    const engine = makeMockEngine([makeBug({ x: 210, y: 200 })]);
    const entry = makeEntry("turret", { nextCaptureAt: 5000 });
    const ctx = makeCtx(engine, 1000);

    turretBehavior.tick(entry, ctx);

    expect(ctx.callbacks.onTurretFire).not.toHaveBeenCalled();
  });

  it("starts aim phase when a bug is in range", async () => {
    const { turretBehavior } = await import("../turret/behavior");
    const bug = makeBug({ x: 250, y: 200 }); // 50px from turret at 200,200
    const engine = makeMockEngine([bug]);
    const entry = makeEntry("turret", { nextCaptureAt: 0 });
    const ctx = makeCtx(engine, 1000);

    turretBehavior.tick(entry, ctx);

    expect(entry.aimPhase).not.toBeNull();
    expect(ctx.callbacks.onTurretFire).toHaveBeenCalledWith(
      expect.objectContaining({ phase: "aim" }),
    );
  });

  it("fires when aim phase completes", async () => {
    const { turretBehavior } = await import("../turret/behavior");
    const bug = makeBug({ x: 250, y: 200 });
    const engine = makeMockEngine([bug]);
    const entry = makeEntry("turret", {
      nextCaptureAt: 0,
      aimPhase: { targetX: 250, targetY: 200, angle: 0, firesAt: 500 },
    });
    const ctx = makeCtx(engine, 1000); // now > firesAt

    turretBehavior.tick(entry, ctx);

    expect(engine.handleHit).toHaveBeenCalled();
    expect(ctx.callbacks.onTurretFire).toHaveBeenCalledWith(
      expect.objectContaining({ phase: "fire" }),
    );
    expect(entry.aimPhase).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Tesla
// ---------------------------------------------------------------------------

describe("tesla behavior", () => {
  it("does nothing when cooldown has not elapsed", async () => {
    const { teslaBehavior } = await import("../tesla/behavior");
    const engine = makeMockEngine([makeBug({ x: 210, y: 200 })]);
    const entry = makeEntry("tesla", { nextCaptureAt: 5000 });
    const ctx = makeCtx(engine, 1000);

    teslaBehavior.tick(entry, ctx);

    expect(ctx.callbacks.onTeslaFire).not.toHaveBeenCalled();
  });

  it("zaps up to 3 bugs and fires onTeslaFire with nodes", async () => {
    const { teslaBehavior } = await import("../tesla/behavior");
    const bugs = [
      makeBug({ x: 210, y: 200 }),
      makeBug({ x: 220, y: 200 }),
      makeBug({ x: 230, y: 200 }),
      makeBug({ x: 240, y: 200 }), // 4th bug — should be excluded
    ];
    const engine = makeMockEngine(bugs);
    const entry = makeEntry("tesla", { nextCaptureAt: 0 });
    const ctx = makeCtx(engine, 1000);

    teslaBehavior.tick(entry, ctx);

    expect(engine.handleHit).toHaveBeenCalledTimes(3);
    expect(ctx.callbacks.onTeslaFire).toHaveBeenCalledWith(
      expect.objectContaining({
        nodes: expect.arrayContaining([{ x: 200, y: 200 }]),
      }),
    );
  });

  it("fires onStructureKill for each lethal hit", async () => {
    const { teslaBehavior } = await import("../tesla/behavior");
    const engine = makeMockEngine([makeBug({ x: 210, y: 200 })]);
    const entry = makeEntry("tesla", { nextCaptureAt: 0 });
    const ctx = makeCtx(engine, 1000);

    teslaBehavior.tick(entry, ctx);

    expect(ctx.callbacks.onStructureKill).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// Firewall
// ---------------------------------------------------------------------------

describe("firewall behavior", () => {
  it("does nothing when damage interval has not elapsed", async () => {
    const { firewallBehavior } = await import("../firewall/behavior");
    const engine = makeMockEngine([makeBug({ x: 200, y: 200 })]);
    const entry = makeEntry("firewall", { firewallNextDamageAt: 5000 });
    const ctx = makeCtx(engine, 1000);

    firewallBehavior.tick(entry, ctx);

    expect(engine.handleHit).not.toHaveBeenCalled();
  });

  it("damages bugs within the horizontal strip", async () => {
    const { firewallBehavior } = await import("../firewall/behavior");
    const bugs = [
      makeBug({ x: 205, y: 150 }), // within ±20px of wall x=200
      makeBug({ x: 350, y: 150 }), // outside
    ];
    const engine = makeMockEngine(bugs);
    const entry = makeEntry("firewall", { firewallNextDamageAt: 0 });
    const ctx = makeCtx(engine, 1000);

    firewallBehavior.tick(entry, ctx);

    expect(engine.handleHit).toHaveBeenCalledTimes(1);
    expect(engine.handleHit).toHaveBeenCalledWith(0, 1, true);
  });

  it("fires onStructureKill for lethal hits", async () => {
    const { firewallBehavior } = await import("../firewall/behavior");
    const engine = makeMockEngine([makeBug({ x: 205, y: 200 })]);
    const entry = makeEntry("firewall", { firewallNextDamageAt: 0 });
    const ctx = makeCtx(engine, 1000);

    firewallBehavior.tick(entry, ctx);

    expect(ctx.callbacks.onStructureKill).toHaveBeenCalledTimes(1);
  });

  it("advances the next damage timestamp after firing", async () => {
    const { firewallBehavior } = await import("../firewall/behavior");
    const engine = makeMockEngine([]);
    const entry = makeEntry("firewall", { firewallNextDamageAt: 0 });

    firewallBehavior.tick(entry, makeCtx(engine, 1000));

    expect(entry.firewallNextDamageAt).toBeGreaterThan(1000);
  });
});
