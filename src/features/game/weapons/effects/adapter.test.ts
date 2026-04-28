import { describe, expect, it, vi } from "vitest";

import { applyEffectDescriptor } from "./adapter";
import type { ExecutionContext } from "@game/weapons/runtime/types";

function createExecutionContext(overrides: Partial<ExecutionContext> = {}): ExecutionContext {
  return {
    blackHoleVfxIdRef: { current: null },
    bounds: { height: 300, left: 0, top: 0, width: 300 },
    canvas: null,
    damageMultiplier: 1,
    engine: {
      allyBug: vi.fn(),
      applyBurnInRadius: vi.fn(),
      applyChargedInRadius: vi.fn(),
      applyEnsnareInRadius: vi.fn(),
      applyMarkedInRadius: vi.fn(),
      applyPoisonInRadius: vi.fn(),
      applyUnstableInRadius: vi.fn(),
      chainHitTest: vi.fn(),
      chainHitTestPreferUnfrozen: vi.fn(),
      closestTargetIndex: vi.fn(),
      coneHitTest: vi.fn(),
      getAllBugs: vi.fn(() => []),
      getBlackHole: vi.fn(),
      handleHit: vi.fn(),
      hitTest: vi.fn(),
      lineHitTest: vi.fn(),
      propagateChargedNetwork: vi.fn(),
      radiusHitTest: vi.fn(),
      splitBug: vi.fn(),
      startBlackHole: vi.fn(),
      startEventHorizon: vi.fn(),
      triggerAutoScalerPulse: vi.fn(),
      triggerKernelPanicExplosion: vi.fn(),
    },
    enqueueOverlay: vi.fn(),
    onHit: vi.fn(),
    updateQaLastHit: vi.fn(),
    vfx: null,
    viewportX: 120,
    viewportY: 160,
    weaponId: "hammer",
    ...overrides,
  } as ExecutionContext;
}

describe("effect adapter", () => {
  it("forwards overlay effects through the execution overlay seam", () => {
    const enqueueOverlay = vi.fn();
    const ctx = createExecutionContext({ enqueueOverlay, weaponId: "chain" });

    applyEffectDescriptor(
      {
        type: "overlayEffect",
        weaponId: "chain",
        viewportX: 220,
        viewportY: 180,
        extras: {
          beamGlowWidth: 10,
          beamWidth: 4,
          chainNodes: [
            { x: 220, y: 180 },
            { x: 260, y: 200 },
          ],
          chaosScale: 1.4,
        },
      },
      ctx,
    );

    expect(enqueueOverlay).toHaveBeenCalledWith(
      "chain",
      220,
      180,
      expect.objectContaining({
        beamGlowWidth: 10,
        beamWidth: 4,
        chaosScale: 1.4,
      }),
    );
  });
});