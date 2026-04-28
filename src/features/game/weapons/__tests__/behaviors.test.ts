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
    matchup: "steady",
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
    applyChargedInRadius: vi.fn(),
    applyMarkedInRadius: vi.fn(),
    applyUnstableInRadius: vi.fn(),
    propagateChargedNetwork: vi.fn(),
    splitBug: vi.fn(),
    allyBug: vi.fn(),
    startEventHorizon: vi.fn(),
    triggerKernelPanicExplosion: vi.fn(),
    triggerAutoScalerPulse: vi.fn(),
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
    tier: 1 as const,
    weaponId: "hammer" as import("@game/types").SiegeWeaponId,
    config: {},
    ...overrides,
  };
}

beforeEach(() => {
  _resetForTests();
});

// ---------------------------------------------------------------------------
// Hammer
// ---------------------------------------------------------------------------

describe("hammer behavior", () => {
  it("returns a once session", async () => {
    const { createSession } = await import("../hammer/behavior");
    const engine = makeMockEngine();
    const session = createSession(makeCtx(engine) as any);
    expect(session.mode).toBe("once");
  });

  it("emits a crack effect when a bug is nearby", async () => {
    const { createSession } = await import("../hammer/behavior");
    const engine = makeMockEngine([makeBug({ x: 100, y: 100 })]);
    const session = createSession(makeCtx(engine) as any);
    if (session.mode !== "once") throw new Error("expected once");
    const effectCmds = session.commands.filter(
      (c) => c.kind === "spawnEffect" && (c as any).descriptor.type === "crack",
    );
    expect(effectCmds.length).toBeGreaterThan(0);
  });

  it("emits config-driven ally conversion data at tier three", async () => {
    const { createSession } = await import("../hammer/behavior");
    const engine = makeMockEngine([makeBug({ x: 100, y: 100, hp: 4 })]);
    const session = createSession(
      makeCtx(engine, {
        tier: 3,
        weaponId: "hammer",
        config: {
          damage: 2,
          hitRadius: 48,
          allyDurationMs: 6500,
          allyCap: 5,
          allyInterceptForce: 2.5,
          allyExpireBurstRadius: 54,
          allyExpireBurstDamage: 1,
        },
      }) as any,
    );
    if (session.mode !== "once") throw new Error("expected once");

    const allyCommand = session.commands.find((c) => c.kind === "allyBug") as any;

    expect(allyCommand?.config).toMatchObject({
      durationMs: 6500,
      expireBurstDamage: 1,
      expireBurstRadius: 54,
      interceptForce: 2.5,
      maxActiveAllies: 5,
    });
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

  it("adds lane-control clouds and ensnare fields at survival tiers", async () => {
    const { createSession } = await import("../bug-spray/behavior");
    const { BASE_TOGGLES } = await import("../bug-spray/constants");
    const engine = makeMockEngine([makeBug({ x: 110, y: 110 })]);
    const ctx = makeCtx(engine, {
      tier: 5,
      config: {
        ...(BASE_TOGGLES as any),
        cloudRadius: 180,
        secondaryRadius: 96,
      },
      weaponId: "zapper",
    }) as any;
    const session = createSession(ctx);
    if (session.mode !== "hold") throw new Error("expected hold");

    const commands = session.begin(ctx);
    const repeatedClouds = commands.filter((c) => c.kind === "repeatPoisonRadius");
    const ensnare = commands.find((c) => c.kind === "ensnareRadius");

    expect(repeatedClouds.length).toBeGreaterThanOrEqual(4);
    expect(ensnare).toBeDefined();
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

  it("scales overlay width and branch chaos from config at higher tiers", async () => {
    const { createSession } = await import("../chain-zap/behavior");
    const { BASE_TOGGLES } = await import("../chain-zap/constants");
    const engine = makeMockEngine([
      makeBug({ x: 100, y: 100 }),
      makeBug({ x: 138, y: 108 }),
      makeBug({ x: 170, y: 124 }),
      makeBug({ x: 205, y: 136 }),
    ]);
    const session = createSession(
      makeCtx(engine, {
        tier: 3,
        config: {
          ...(BASE_TOGGLES as any),
          beamGlowWidth: 10.4,
          beamWidth: 4,
          chainMaxBounces: 6,
          chainRadius: 108,
          chaosScale: 1.42,
          secondaryDamage: 1,
        },
        weaponId: "chain",
      }) as any,
    );

    if (session.mode !== "once") throw new Error("expected once");

    const overlayCommand = session.commands.find(
      (c) =>
        c.kind === "spawnEffect" &&
        (c as any).descriptor.type === "overlayEffect",
    ) as any;

    expect(overlayCommand?.descriptor?.extras?.beamWidth).toBe(4);
    expect(overlayCommand?.descriptor?.extras?.beamGlowWidth).toBe(10.4);
    expect(overlayCommand?.descriptor?.extras?.chaosScale).toBe(1.42);
    expect(overlayCommand?.descriptor?.extras?.chainNodes?.length).toBeGreaterThan(1);
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

  it("scales into multiple independent target locks at higher tiers", async () => {
    const { createSession } = await import("../null-pointer/behavior");
    const engine = makeMockEngine([
      makeBug({ hp: 6, x: 110, y: 110, variant: "urgent" }),
      makeBug({ hp: 5, x: 140, y: 90, variant: "high" }),
      makeBug({ hp: 4, x: 170, y: 120, variant: "medium" }),
      makeBug({ hp: 2, x: 220, y: 220, variant: "low" }),
    ]);
    const session = createSession(
      makeCtx(engine, {
        tier: 3,
        config: {
          ...((await import("../null-pointer/constants")).BASE_TOGGLES as any),
          targetCount: 3,
          binaryBurstCount: 3,
        },
        weaponId: "nullpointer",
      }) as any,
    );
    if (session.mode !== "once") throw new Error("expected once");

    const damageCommands = session.commands.filter((c) => c.kind === "damage");
    const overlayCommand = session.commands.find(
      (c) =>
        c.kind === "spawnEffect" &&
        (c as any).descriptor.type === "overlayEffect",
    ) as any;

    expect(damageCommands.length).toBeGreaterThanOrEqual(3);
    expect(overlayCommand?.descriptor?.extras?.targetPoints).toHaveLength(3);
  });

  it("adds unstable execution fields and kernel panic at overdrive tiers", async () => {
    const { createSession } = await import("../null-pointer/behavior");
    const engine = makeMockEngine([
      makeBug({ hp: 3, x: 110, y: 110 }),
      makeBug({ hp: 1, x: 145, y: 120 }),
      makeBug({ hp: 2, x: 172, y: 130 }),
    ]);
    const session = createSession(
      makeCtx(engine, {
        tier: 5,
        config: {
          ...((await import("../null-pointer/constants")).BASE_TOGGLES as any),
          targetCount: 2,
          executeHpLimit: 3,
          markRadius: 140,
          splashRadius: 92,
        },
        weaponId: "nullpointer",
      }) as any,
    );
    if (session.mode !== "once") throw new Error("expected once");

    expect(session.commands.some((c) => c.kind === "unstableRadius")).toBe(true);
    expect(session.commands.some((c) => c.kind === "triggerKernelPanic")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Fork Bomb (plasma)
// ---------------------------------------------------------------------------

describe("fork-bomb behavior", () => {
  it("returns a once session", async () => {
    const { createSession } = await import("../fork-bomb/behavior");
    const engine = makeMockEngine();
    const session = createSession(makeCtx(engine) as any);
    expect(session.mode).toBe("once");
  });

  it("returns 5 clustered explosions", async () => {
    const { createSession } = await import("../fork-bomb/behavior");
    const engine = makeMockEngine([makeBug()]);
    const session = createSession(makeCtx(engine) as any);
    if (session.mode !== "once") throw new Error("expected once");
    const bursts = session.commands.filter(
      (c) => c.kind === "spawnEffect" && (c as any).descriptor.type === "explosion",
    );
    expect(bursts).toHaveLength(5);
  });

  it("scales cluster, implosion, and ring overlay data from config", async () => {
    const { createSession } = await import("../fork-bomb/behavior");
    const { BASE_TOGGLES } = await import("../fork-bomb/constants");
    const engine = makeMockEngine([makeBug()]);
    const session = createSession(
      makeCtx(engine, {
        tier: 3,
        config: {
          ...(BASE_TOGGLES as any),
          clusterCount: 9,
          implosionRadius: 40,
          ringCount: 12,
          chaosScale: 1.34,
          impactRadius: 28,
          reticleRadius: 66,
          shockwaveRadius: 122,
        },
        weaponId: "plasma",
      }) as any,
    );

    if (session.mode !== "once") throw new Error("expected once");

    const implosion = session.commands.find(
      (c) =>
        c.kind === "spawnEffect" &&
        (c as any).descriptor.type === "plasmaImplosion",
    ) as any;
    const overlayCommand = session.commands.find(
      (c) =>
        c.kind === "spawnEffect" &&
        (c as any).descriptor.type === "overlayEffect",
    ) as any;

    expect(implosion?.descriptor?.radius).toBe(40);
    expect(overlayCommand?.descriptor?.extras?.targetPoints).toHaveLength(21);
    expect(overlayCommand?.descriptor?.extras?.chaosScale).toBe(1.34);
  });

  it("adds unstable web nodes and collapse detonations at overdrive tiers", async () => {
    const { createSession } = await import("../fork-bomb/behavior");
    const { BASE_TOGGLES } = await import("../fork-bomb/constants");
    const engine = makeMockEngine([
      makeBug({ x: 100, y: 100 }),
      makeBug({ x: 150, y: 100 }),
      makeBug({ x: 180, y: 120 }),
    ]);
    const session = createSession(
      makeCtx(engine, {
        tier: 5,
        config: {
          ...(BASE_TOGGLES as any),
          ringCount: 10,
          ringRadius: 120,
          secondaryRadius: 48,
        },
        weaponId: "plasma",
      }) as any,
    );
    if (session.mode !== "once") throw new Error("expected once");

    expect(session.commands.some((c) => c.kind === "unstableRadius")).toBe(true);
    expect(session.commands.some((c) => c.kind === "triggerKernelPanic")).toBe(true);
    expect(
      session.commands.filter(
        (c) => c.kind === "spawnEffect" && (c as any).descriptor.type === "plasmaExplosion",
      ).length,
    ).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Void Pulse
// ---------------------------------------------------------------------------

describe("void-pulse behavior", () => {
  it("returns a one-shot timed session", async () => {
    const { createSession } = await import("../void-pulse/behavior");
    const engine = makeMockEngine();
    const session = createSession(makeCtx(engine) as any);
    expect(session.mode).toBe("once");
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
    if (session.mode !== "once") throw new Error("expected once");
    expect(session.commands).toHaveLength(0);
  });

  it("stores event-horizon timing on the black-hole command for collapse handling", async () => {
    const { createSession } = await import("../void-pulse/behavior");
    const ctx = makeCtx(makeMockEngine(), {
      tier: 3 as const,
      weaponId: "void" as import("@game/types").SiegeWeaponId,
    });
    const session = createSession(ctx as any);

    if (session.mode !== "once") throw new Error("expected once");

    const blackHoleCommand = session.commands.find((command) => command.kind === "startBlackHole");

    expect(blackHoleCommand).toMatchObject({
      x: 100,
      y: 100,
      radius: 300,
      coreRadius: 80,
      durationMs: 2000,
      collapseDamage: 2,
      eventHorizonRadius: 200,
      eventHorizonDurationMs: 5000,
    });
  });

  it("scales collapse overlay and burn ring from config", async () => {
    const { createSession } = await import("../void-pulse/behavior");
    const { BASE_TOGGLES } = await import("../void-pulse/constants");
    const engine = makeMockEngine();
    const ctx = makeCtx(engine, {
      tier: 3 as const,
      weaponId: "void" as import("@game/types").SiegeWeaponId,
      config: {
        ...(BASE_TOGGLES as any),
        impactRadius: 360,
        reticleRadius: 118,
        shockwaveRadius: 90,
        secondaryRadius: 210,
        chaosScale: 1.38,
      },
    });
    const session = createSession(ctx as any);

    if (session.mode !== "once") throw new Error("expected once");

    const commands = session.commands as any[];
    const overlayCommand = commands.find(
      (c) => c.kind === "spawnEffect" && c.descriptor.type === "overlayEffect",
    );
    const burnRadiusCommand = commands.find((c) => c.kind === "burnRadius");

    expect(overlayCommand?.descriptor?.extras?.impactRadius).toBe(360);
    expect(overlayCommand?.descriptor?.extras?.reticleRadius).toBe(118);
    expect(overlayCommand?.descriptor?.extras?.shockwaveRadius).toBe(90);
    expect(overlayCommand?.descriptor?.extras?.chaosScale).toBe(1.38);
    expect(burnRadiusCommand?.radius).toBe(210);
  });
});
