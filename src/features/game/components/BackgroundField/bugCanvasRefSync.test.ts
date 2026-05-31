import { describe, expect, it, vi } from "vitest";

import {
  getBugCanvasTargetSettings,
  syncBugCanvasRefs,
} from "./bugCanvasRefSync";

function createRef<T>(current: T) {
  return { current };
}

describe("bugCanvasRefSync", () => {
  it("derives target settings from visual settings", () => {
    expect(getBugCanvasTargetSettings()).toEqual({
      sizeMultiplier: 1,
      speedMultiplier: 1,
    });

    const settings = getBugCanvasTargetSettings({
      chaosMultiplier: 4,
      sizeMultiplier: 1.5,
    } as any);

    expect(settings.sizeMultiplier).toBe(1.5);
    expect(settings.speedMultiplier).toBeGreaterThan(1);
  });

  it("syncs the live BugCanvas refs from current props", () => {
    const onHit = vi.fn();
    const onCoreBreach = vi.fn();
    const onEntityDeath = vi.fn();
    const onWeaponFire = vi.fn();
    const onWeaponEvolutionStatesChange = vi.fn();
    const onLiveBugCountChange = vi.fn();
    const onPhysicsBackendChange = vi.fn();
    const getWeaponTier = vi.fn(() => 2 as any);
    const consumeTransitionSwarm = vi.fn(() => null);

    const chartFocusRef = createRef(null as any);
    const combatStatsRef = createRef(null as any);
    const interactiveModeRef = createRef(false);
    const selectedWeaponIdRef = createRef("sword" as any);
    const sessionKeyRef = createRef("session-1");
    const targetSettingsRef = createRef({ sizeMultiplier: 0, speedMultiplier: 0 });

    syncBugCanvasRefs({
      bugVisualSettings: { chaosMultiplier: 4, sizeMultiplier: 1.5 } as any,
      chartFocus: { focus: "team", value: "alpha" } as any,
      chartFocusRef,
      combatStats: { totalHits: 3 } as any,
      combatStatsRef,
      consumeTransitionSwarm,
      consumeTransitionSwarmRef: createRef(undefined),
      gameConfig: { bugCap: 20 } as any,
      gameConfigRef: createRef(undefined),
      gamePaused: true,
      gamePausedRef: createRef(false),
      getWeaponTier,
      getWeaponTierRef: createRef(() => 1 as any),
      initialEvolutionStates: { hammer: { kills: 4, tier: 2 } } as any,
      initialEvolutionStatesRef: createRef(undefined),
      interactiveMode: true,
      interactiveModeRef,
      motionProfile: { jitter: 2 } as any,
      motionProfileRef: createRef({} as any),
      onCoreBreach,
      onCoreBreachRef: createRef(undefined),
      onEntityDeath,
      onEntityDeathRef: createRef(undefined),
      onHit,
      onHitRef: createRef(() => void 0),
      onLiveBugCountChange,
      onLiveBugCountChangeRef: createRef(undefined),
      onPhysicsBackendChange,
      onPhysicsBackendChangeRef: createRef(undefined),
      onWeaponEvolutionStatesChange,
      onWeaponEvolutionStatesChangeRef: createRef(undefined),
      onWeaponFire,
      onWeaponFireRef: createRef(undefined),
      reseedInfo: { clustered: 1, total: 3, ts: 123 } as any,
      reseedInfoRef: createRef(null),
      sceneProfile: { density: "high" } as any,
      sceneProfileRef: createRef({} as any),
      selectedWeaponId: "hammer",
      selectedWeaponIdRef,
      sessionKey: "session-2",
      sessionKeyRef,
      siegeZones: [{ height: 2, left: 3, top: 4, width: 5 }] as any,
      siegeZonesRef: createRef([]),
      streakMultiplier: 2,
      streakMultiplierRef: createRef(1),
      survivalSpawnPlan: { sequenceId: 9 } as any,
      survivalSpawnPlanRef: createRef(null),
      targetSettingsRef,
      transitionSnapshot: [{ x: 1, y: 2, hp: 1, maxHp: 1, heading: 0, opacity: 1, size: 12, variant: "low", vx: 0, vy: 0 }] as any,
      transitionSnapshotRef: createRef(null),
    });

    expect(interactiveModeRef.current).toBe(true);
    expect(selectedWeaponIdRef.current).toBe("hammer");
    expect(sessionKeyRef.current).toBe("session-2");
    expect(chartFocusRef.current).toEqual({ focus: "team", value: "alpha" });
    expect(combatStatsRef.current).toEqual({ totalHits: 3 });
    expect(targetSettingsRef.current.sizeMultiplier).toBe(1.5);
    expect(targetSettingsRef.current.speedMultiplier).toBeGreaterThan(1);
  });
});