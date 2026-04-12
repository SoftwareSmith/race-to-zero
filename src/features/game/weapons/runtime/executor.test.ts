import { describe, expect, it, vi } from "vitest";

import { executeCommands } from "./executor";
import type { ExecutionContext, HitResult } from "./types";

function makeHitResult(overrides: Partial<HitResult> = {}): HitResult {
  return {
    defeated: true,
    frozen: false,
    matchup: "steady",
    pointValue: 1,
    remainingHp: 0,
    variant: "low",
    ...overrides,
  };
}

describe("weapon executor", () => {
  it("attributes direct damage kills to the firing weapon", () => {
    const handleHit = vi.fn(() => makeHitResult());
    const onHit = vi.fn();
    const ctx: ExecutionContext = {
      blackHoleVfxIdRef: { current: null },
      bounds: { height: 300, left: 10, top: 20, width: 300 },
      canvas: null,
      engine: {
        handleHit,
        getAllBugs: vi.fn(() => [{ x: 100, y: 120, variant: "low" }]),
        hitTest: vi.fn(),
        lineHitTest: vi.fn(),
        radiusHitTest: vi.fn(),
        coneHitTest: vi.fn(),
        chainHitTest: vi.fn(),
        chainHitTestPreferUnfrozen: vi.fn(),
        closestTargetIndex: vi.fn(),
        applyPoisonInRadius: vi.fn(),
        applyBurnInRadius: vi.fn(),
        applyEnsnareInRadius: vi.fn(),
        startBlackHole: vi.fn(),
        getBlackHole: vi.fn(),
        applyChargedInRadius: vi.fn(),
        applyMarkedInRadius: vi.fn(),
        applyUnstableInRadius: vi.fn(),
        propagateChargedNetwork: vi.fn(),
        applyGlobalSlow: vi.fn(),
        startDeadlockCluster: vi.fn(),
        splitBug: vi.fn(),
        allyBug: vi.fn(),
        startEventHorizon: vi.fn(),
        triggerKernelPanicExplosion: vi.fn(),
        triggerAutoScalerPulse: vi.fn(),
      },
      enqueueOverlay: vi.fn(),
      onHit,
      updateQaLastHit: vi.fn(),
      vfx: null,
      viewportX: 100,
      viewportY: 150,
      weaponId: "hammer",
    } as ExecutionContext;

    executeCommands(
      [{ amount: 3, creditOnDeath: true, kind: "damage", targetIndex: 0 }],
      ctx,
    );

    expect(handleHit).toHaveBeenCalledWith(0, 3, true, "hammer");
    expect(onHit).toHaveBeenCalledWith(
      expect.objectContaining({ defeated: true, pointValue: 1, variant: "low" }),
    );
  });
});