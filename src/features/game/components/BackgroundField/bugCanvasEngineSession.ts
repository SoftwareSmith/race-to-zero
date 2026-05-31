import Engine from "@game/engine/Engine";
import type { GameConfig } from "@game/engine/types";
import type { VfxEngine } from "@game/engine/VfxEngine";
import type {
  SiegeCombatStats,
  SiegeWeaponId,
  SiegeZoneRect,
  WeaponEvolutionState,
  WeaponTier,
} from "@game/types";
import type {
  BugCounts,
  BugVisualSettings,
  ChartFocusState,
  MotionProfile,
  SceneProfile,
} from "../../../../types/dashboard";
import type { SurvivalSpawnPlan } from "@game/sim/survivalDirector";
import type { SiegeStatusId } from "@game/status/statusCatalog";
import type { BugTransitionSnapshotItem, RenderedBugPosition } from "./types";
import { type CanvasBounds, type ReseedInfo } from "./canvasState";
import {
  clearBugCanvasQaBindings,
  installBugCanvasQaBindings,
  setupBugCanvasEngine,
} from "./bugCanvasEngineSetup";
import { applySurvivalSpawnPlan } from "./bugCanvasLiveState";

type RefValue<T> = {
  current: T;
};

interface SetupBugCanvasEngineSessionOptions {
  blackHoleVfxIdRef: RefValue<string | null>;
  boundsRef: RefValue<CanvasBounds>;
  bugCounts: BugCounts;
  canvasRef: RefValue<HTMLCanvasElement | null>;
  consumeTransitionSwarmRef: RefValue<(() => Engine | null) | undefined>;
  gameConfigRef: RefValue<GameConfig | undefined>;
  getLocalSiegeZones: () => Pick<SiegeZoneRect, "height" | "left" | "top" | "width">[];
  initialEvolutionStatesRef: RefValue<
    Partial<Record<SiegeWeaponId, WeaponEvolutionState>> | undefined
  >;
  interactiveMode: boolean;
  interactiveModeRef: RefValue<boolean>;
  lastAppliedSpawnPlanRef: RefValue<number>;
  lastReportedLiveBugCountRef: RefValue<number | null>;
  lastReportedLiveBugCountsKeyRef: RefValue<string | null>;
  latestBugPositionsRef: RefValue<RenderedBugPosition[]>;
  maxWeaponTier?: WeaponTier;
  onEntityDeathRef: RefValue<
    | ((
        x: number,
        y: number,
        variant: string,
        meta: {
          credited: boolean;
          finisherStatus?: SiegeStatusId | null;
          frozen: boolean;
          pointValue: number;
          supportStatuses?: SiegeStatusId[];
        },
      ) => void)
    | undefined
  >;
  onLiveBugCountChangeRef: RefValue<
    | ((count: number, bugCounts?: BugCounts, sourceSessionKey?: string | null) => void)
    | undefined
  >;
  onPhysicsBackendChangeRef: RefValue<((backendId: string) => void) | undefined>;
  onWeaponEvolution?: (weaponId: SiegeWeaponId, newTier: WeaponTier) => void;
  qaBindingOwnerRef: RefValue<object | null>;
  setReseedInfo: (value: ReseedInfo | null) => void;
  sessionKeyRef: RefValue<string>;
  survivalSpawnPlanRef: RefValue<(SurvivalSpawnPlan & { sequenceId: number }) | null>;
  swarmRef: RefValue<Engine | null>;
  syncWeaponEvolutionStates: () => void;
  targetSettingsRef: RefValue<{ sizeMultiplier: number; speedMultiplier: number }>;
  transitionSnapshotRef: RefValue<BugTransitionSnapshotItem[] | null>;
  vfxRef: RefValue<VfxEngine | null>;
}

function destroySwarm(swarmRef: RefValue<Engine | null>) {
  if (swarmRef.current && typeof (swarmRef.current as any).destroy === "function") {
    try {
      (swarmRef.current as any).destroy();
    } catch {
      void 0;
    }
  }
}

function resetSwarmRuntimeState({
  lastReportedLiveBugCountRef,
  lastReportedLiveBugCountsKeyRef,
  latestBugPositionsRef,
  qaBindingOwnerRef,
  swarmRef,
}: Pick<
  SetupBugCanvasEngineSessionOptions,
  | "lastReportedLiveBugCountRef"
  | "lastReportedLiveBugCountsKeyRef"
  | "latestBugPositionsRef"
  | "qaBindingOwnerRef"
  | "swarmRef"
>) {
  clearBugCanvasQaBindings(qaBindingOwnerRef.current ?? undefined);
  qaBindingOwnerRef.current = null;
  swarmRef.current = null;
  latestBugPositionsRef.current = [];
  lastReportedLiveBugCountRef.current = null;
  lastReportedLiveBugCountsKeyRef.current = null;
}

export function setupBugCanvasEngineSession({
  blackHoleVfxIdRef,
  boundsRef,
  bugCounts,
  canvasRef,
  consumeTransitionSwarmRef,
  gameConfigRef,
  getLocalSiegeZones,
  initialEvolutionStatesRef,
  interactiveMode,
  interactiveModeRef,
  lastAppliedSpawnPlanRef,
  lastReportedLiveBugCountRef,
  lastReportedLiveBugCountsKeyRef,
  latestBugPositionsRef,
  maxWeaponTier,
  onEntityDeathRef,
  onLiveBugCountChangeRef,
  onPhysicsBackendChangeRef,
  onWeaponEvolution,
  qaBindingOwnerRef,
  setReseedInfo,
  sessionKeyRef,
  survivalSpawnPlanRef,
  swarmRef,
  syncWeaponEvolutionStates,
  targetSettingsRef,
  transitionSnapshotRef,
  vfxRef,
}: SetupBugCanvasEngineSessionOptions) {
  const canvas = canvasRef.current;
  const currentVfx = vfxRef.current;
  const width = canvas?.clientWidth || boundsRef.current.width || 800;
  const height = canvas?.clientHeight || boundsRef.current.height || 600;
  let cancelled = false;
  let disposePhysicsAdapter: (() => void) | undefined;

  const setupEngine = async () => {
    if (!canvas) {
      return;
    }

    destroySwarm(swarmRef);

    const result = await setupBugCanvasEngine({
      bugCounts,
      bounds: boundsRef.current,
      canvas,
      gameConfig: (gameConfigRef.current as any) ?? undefined,
      getLocalSiegeZones,
      height,
      initialEvolutionStates: initialEvolutionStatesRef.current ?? undefined,
      interactiveMode,
      latestBugPositionsRef,
      maxWeaponTier,
      notifyPhysicsBackendChange: (backendId) =>
        onPhysicsBackendChangeRef.current?.(backendId),
      notifyWeaponEvolution: (weaponId, newTier) => {
        const bounds = boundsRef.current;
        vfxRef.current?.spawnLevelUp?.(
          Math.round((bounds.width || width) * 0.5),
          Math.round(Math.max(72, (bounds.height || height) * 0.24)),
        );
        onWeaponEvolution?.(weaponId, newTier);
      },
      onEntityDeath: (x, y, variant, meta) => {
        try {
          const viewportX = Math.round(x + (boundsRef.current.left || 0));
          const viewportY = Math.round(y + (boundsRef.current.top || 0));
          if (meta.finisherStatus) {
            vfxRef.current?.spawnStatusResolution?.(
              viewportX,
              viewportY,
              meta.finisherStatus,
              "finisher",
            );
          } else {
            const supportStatus = meta.supportStatuses?.find(
              (status) => status !== "marked",
            );
            if (supportStatus) {
              vfxRef.current?.spawnStatusResolution?.(
                viewportX,
                viewportY,
                supportStatus,
                "support",
              );
            }
          }
          onEntityDeathRef.current?.(viewportX, viewportY, variant, meta);
          syncWeaponEvolutionStates();
        } catch {
          void 0;
        }
      },
      onLiveBugCountChange: onLiveBugCountChangeRef.current ?? undefined,
      reseedSpeedMultiplier: targetSettingsRef.current.speedMultiplier,
      syncWeaponEvolutionStates,
      consumeTransitionSwarm: () =>
        consumeTransitionSwarmRef.current?.() ?? null,
      transitionSnapshot: transitionSnapshotRef.current,
      width,
    });

    if (cancelled) {
      result.physicsAdapter.dispose?.();
      return;
    }

    swarmRef.current = result.engine;
    latestBugPositionsRef.current = [];
    lastReportedLiveBugCountRef.current = null;
    lastReportedLiveBugCountsKeyRef.current = null;
    lastAppliedSpawnPlanRef.current = 0;
    applySurvivalSpawnPlan({
      getLocalZones: getLocalSiegeZones,
      interactiveMode: interactiveModeRef.current,
      lastAppliedSpawnPlanRef,
      onLiveBugCountChange: onLiveBugCountChangeRef.current,
      sessionKey: sessionKeyRef.current,
      spawnPlan: survivalSpawnPlanRef.current,
      swarm: swarmRef.current,
    });
    disposePhysicsAdapter = () => result.physicsAdapter.dispose?.();
    qaBindingOwnerRef.current = installBugCanvasQaBindings({
      bounds: boundsRef.current,
      engine: result.engine,
      height,
      latestBugPositionsRef,
      onLiveBugCountChange: onLiveBugCountChangeRef.current ?? undefined,
      width,
    });

    if (result.reseedInfo) {
      setReseedInfo(result.reseedInfo);
    }
  };

  void setupEngine();

  return () => {
    if (blackHoleVfxIdRef.current && currentVfx) {
      currentVfx.destroyBlackHole(blackHoleVfxIdRef.current);
      blackHoleVfxIdRef.current = null;
    }

    cancelled = true;
    destroySwarm(swarmRef);
    disposePhysicsAdapter?.();
    resetSwarmRuntimeState({
      lastReportedLiveBugCountRef,
      lastReportedLiveBugCountsKeyRef,
      latestBugPositionsRef,
      qaBindingOwnerRef,
      swarmRef,
    });
  };
}