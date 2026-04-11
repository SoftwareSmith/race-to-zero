/**
 * Weapon behavior unit tests.
 *
 * Each test builds a minimal mock GameEngine, calls createSession(), and
 * asserts that the returned commands are well-formed. VFX effects are not
 * tested here (VfxEngine is kept null in all tests).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type {
  GameEngine,
  HitResult,
  BugSnapshot,
} from "../runtime/types";
import { _resetForTests } from "../runtime/registry";

// ---------------------------------------------------------------------------
// Mock factory
// ---------------------------------------------------------------------------

function makeHitResult(overrides: Partial<HitResult> = {}): HitResult {
  return {
    defeated: false,
    remainingHp: 2,
    pointValue: 1,
    frozen: false,
    variant: "low",
    ...overrides,
  };
}

function makeBug(overrides: Partial<BugSnapshot> = {}): BugSnapshot {
  return { x: 100, y: 100, variant: "low", hp: 3, size: 10, ...overrides };
}

function makeMockEngine(bugs: BugSnapshot[] = [makeBug()]): GameEngine {
  return {
    hitTest: vi.fn((x, y) => {
      for (let i = 0; i < bugs.length; i++) {
        const b = bugs[i];
        const dist = Math.hypot(b.x - x, b.y - y);
        if (dist < 50) return { index: i, distance: dist };
      }
      return null;
    }),
    lineHitTest: vi.fn(() => bugs.map((_, i) => i)),
    radiusHitTest: vi.fn(() => bugs.map((_, i) => i)),
    coneHitTest: vi.fn(() => bugs.map((_, i) => i)),
    chainHitTest: vi.fn(() => bugs.map((_, i) => i)),
    chainHitTestPreferUnfrozen: vi.fn(() => bugs.map((_, i) => i)),
    closestTargetIndex: vi.fn(() => 0),
    handleHit: vi.fn(() => makeHitResult({ defeated: true })),
    getAllBugs: vi.fn(() => bugs),
    applyPoisonInRadius: vi.fn(),
    applyBurnInRadius: vi.fn(),
    applyEnsnareInRadius: vi.fn(),
    startBlackHole: vi.fn(() => true),
    getBlackHole: vi.fn(() => null),
  };
}

function makeCtx(engine: GameEngine, overrides = {}) {
  return {
    targetX: 100,
    targetY: 100,
    centerX: 200,
    centerY: 200,
    canvasWidth: 400,
    canvasHeight: 400,
    viewportX: 300,
    viewportY: 300,
    bounds: { left: 200, top: 100, width: 400, height: 400 },
    now: 0,
    engine,
    ...overrides,
  };
}

beforeEach(() => {
  _resetForTests();
});

// ---------------------------------------------------------------------------
// Wrench
// ---------------------------------------------------------------------------

describe("wrench behavior", () => {
  it("returns a once session", async () => {
    const { createSession } = await import("../wrench/behavior");
    const engine = makeMockEngine();
    const session = createSession(makeCtx(engine) as any);
    expect(session.mode).toBe("once");
  });

  it("emits a crack effect when a bug is nearby", async () => {
    const { createSession } = await import("../wrench/behavior");
    const engine = makeMockEngine([makeBug({ x: 100, y: 100 })]);
    const session = createSession(makeCtx(engine) as any);
    if (session.mode !== "once") throw new Error("expected once");
    const effectCmds = session.commands.filter(
      (c) => c.kind === "spawnEffect" && (c as any).descriptor.type === "crack",
    );
    expect(effectCmds.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Bug Spray (zapper)
// ---------------------------------------------------------------------------

describe("bug-spray behavior", () => {
  it("returns a hold session", async () => {
    const { createSession } = await import("../bug-spray/behavior");
    const engine = makeMockEngine();
    const session = createSession(makeCtx(engine) as any);
    expect(session.mode).toBe("hold");
  });

  it("begin() emits spray particles", async () => {
    const { createSession } = await import("../bug-spray/behavior");
    const engine = makeMockEngine();
    const session = createSession(makeCtx(engine) as any);
    if (session.mode !== "hold") throw new Error("expected hold");
    const cmds = session.begin(makeCtx(engine) as any);
    const sprayCmd = cmds.find(
      (c) =>
        c.kind === "spawnEffect" &&
        (c as any).descriptor.type === "sprayParticles",
    );
    expect(sprayCmd).toBeDefined();
  });

  it("end() does not throw", async () => {
    const { createSession } = await import("../bug-spray/behavior");
    const session = createSession(makeCtx(makeMockEngine()) as any);
    if (session.mode !== "hold") throw new Error("expected hold");
    expect(() => session.end()).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Freeze Cone
// ---------------------------------------------------------------------------

describe("freeze-cone behavior", () => {
  it("returns a once session with freeze commands for bugs in range", async () => {
    const { createSession } = await import("../freeze-cone/behavior");
    const engine = makeMockEngine([makeBug({ x: 100, y: 100 })]);
    const session = createSession(makeCtx(engine) as any);
    if (session.mode !== "once") throw new Error("expected once");
    const freezeCmd = session.commands.find((c) => c.kind === "applyFreeze");
    expect(freezeCmd).toBeDefined();
  });

  it("emits a snowflake decal effect", async () => {
    const { createSession } = await import("../freeze-cone/behavior");
    const engine = makeMockEngine();
    const session = createSession(makeCtx(engine) as any);
    if (session.mode !== "once") throw new Error("expected once");
    const decal = session.commands.find(
      (c) =>
        c.kind === "spawnEffect" &&
        (c as any).descriptor.type === "snowflakeDecals",
    );
    expect(decal).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Chain Zap
// ---------------------------------------------------------------------------

describe("chain-zap behavior", () => {
  it("returns a once session", async () => {
    const { createSession } = await import("../chain-zap/behavior");
    const engine = makeMockEngine();
    const session = createSession(makeCtx(engine) as any);
    expect(session.mode).toBe("once");
  });

  it("emits a lightning effect", async () => {
    const { createSession } = await import("../chain-zap/behavior");
    const engine = makeMockEngine([makeBug(), makeBug({ x: 150, y: 150 })]);
    const session = createSession(makeCtx(engine) as any);
    if (session.mode !== "once") throw new Error("expected once");
    const lightning = session.commands.find(
      (c) =>
        c.kind === "spawnEffect" &&
        (c as any).descriptor.type === "lightning",
    );
    expect(lightning).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Flame
// ---------------------------------------------------------------------------

describe("flame behavior", () => {
  it("returns a hold session", async () => {
    const { createSession } = await import("../flame/behavior");
    const engine = makeMockEngine();
    const session = createSession(makeCtx(engine) as any);
    expect(session.mode).toBe("hold");
  });

  it("tick() emits a firePatch", async () => {
    const { createSession } = await import("../flame/behavior");
    const engine = makeMockEngine();
    const session = createSession(makeCtx(engine) as any);
    if (session.mode !== "hold") throw new Error("expected hold");
    const cmds = session.tick(makeCtx(engine) as any);
    const patch = cmds.find(
      (c) =>
        c.kind === "spawnEffect" && (c as any).descriptor.type === "firePatch",
    );
    expect(patch).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Laser Cutter
// ---------------------------------------------------------------------------

describe("laser-cutter behavior", () => {
  it("returns a once session", async () => {
    const { createSession } = await import("../laser-cutter/behavior");
    const engine = makeMockEngine();
    const session = createSession(makeCtx(engine) as any);
    expect(session.mode).toBe("once");
  });

  it("emits a burnScar effect", async () => {
    const { createSession } = await import("../laser-cutter/behavior");
    const engine = makeMockEngine([makeBug()]);
    const session = createSession(makeCtx(engine) as any);
    if (session.mode !== "once") throw new Error("expected once");
    const scar = session.commands.find(
      (c) =>
        c.kind === "spawnEffect" && (c as any).descriptor.type === "burnScar",
    );
    expect(scar).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Static Net (shockwave)
// ---------------------------------------------------------------------------

describe("static-net behavior", () => {
  it("returns a once session with ensnareRadius", async () => {
    const { createSession } = await import("../static-net/behavior");
    const engine = makeMockEngine();
    const session = createSession(makeCtx(engine) as any);
    if (session.mode !== "once") throw new Error("expected once");
    const ensnare = session.commands.find((c) => c.kind === "ensnareRadius");
    expect(ensnare).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Null Pointer
// ---------------------------------------------------------------------------

describe("null-pointer behavior", () => {
  it("returns a once session", async () => {
    const { createSession } = await import("../null-pointer/behavior");
    const engine = makeMockEngine([makeBug()]);
    const session = createSession(makeCtx(engine) as any);
    expect(session.mode).toBe("once");
  });

  it("emits a binaryBurst effect", async () => {
    const { createSession } = await import("../null-pointer/behavior");
    const engine = makeMockEngine([makeBug()]);
    const session = createSession(makeCtx(engine) as any);
    if (session.mode !== "once") throw new Error("expected once");
    const burst = session.commands.find(
      (c) =>
        c.kind === "spawnEffect" &&
        (c as any).descriptor.type === "binaryBurst",
    );
    expect(burst).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Plasma Bomb
// ---------------------------------------------------------------------------

describe("plasma-bomb behavior", () => {
  it("returns a persistent session", async () => {
    const { createSession } = await import("../plasma-bomb/behavior");
    const engine = makeMockEngine();
    const session = createSession(makeCtx(engine) as any);
    expect(session.mode).toBe("persistent");
  });

  it("begin() is callable and returns commands", async () => {
    const { createSession } = await import("../plasma-bomb/behavior");
    const engine = makeMockEngine([makeBug()]);
    const session = createSession(makeCtx(engine) as any);
    if (session.mode !== "persistent") throw new Error("expected persistent");
    const cmds = session.begin(makeCtx(engine) as any);
    expect(Array.isArray(cmds)).toBe(true);
  });

  it("goes inactive after begin()", async () => {
    vi.useFakeTimers();
    const { createSession } = await import("../plasma-bomb/behavior");
    const engine = makeMockEngine();
    const session = createSession(makeCtx(engine) as any);
    if (session.mode !== "persistent") throw new Error("expected persistent");
    session.begin(makeCtx(engine) as any);
    vi.advanceTimersByTime(700);
    expect(session.active).toBe(false);
    vi.useRealTimers();
  });
});

// ---------------------------------------------------------------------------
// Void Pulse
// ---------------------------------------------------------------------------

describe("void-pulse behavior", () => {
  it("returns a persistent session", async () => {
    const { createSession } = await import("../void-pulse/behavior");
    const engine = makeMockEngine();
    const session = createSession(makeCtx(engine) as any);
    expect(session.mode).toBe("persistent");
  });

  it("blocks if a black hole is already active", async () => {
    const { createSession } = await import("../void-pulse/behavior");
    const engine = makeMockEngine();
    (engine.getBlackHole as ReturnType<typeof vi.fn>).mockReturnValue({
      active: true,
      x: 0,
      y: 0,
      radius: 300,
    });
    const session = createSession(makeCtx(engine) as any);
    if (session.mode !== "persistent") throw new Error("expected persistent");
    // When a black hole is active, begin() should emit zero commands.
    const cmds = session.begin(makeCtx(engine) as any);
    expect(cmds).toHaveLength(0);
  });

  it("abort() does not throw", async () => {
    const { createSession } = await import("../void-pulse/behavior");
    const engine = makeMockEngine();
    const session = createSession(makeCtx(engine) as any);
    if (session.mode !== "persistent") throw new Error("expected persistent");
    expect(() => session.abort()).not.toThrow();
  });
});
