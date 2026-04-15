/**
 * Structure behavior unit tests.
 *
 * Each test builds a minimal mock StructureGameEngine, calls tick(), and
 * asserts the resulting state mutations and callback invocations.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { WeaponTier } from "@game/types";
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
    tier: WeaponTier.TIER_ONE,
    x: 200,
    y: 200,
    nextCaptureAt: 0,
    absorbing: null,
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
