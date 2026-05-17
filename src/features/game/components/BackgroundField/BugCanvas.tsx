import {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import Engine from "@game/engine/Engine";
import type { GameConfig } from "@game/engine/types";
import { isTerminalEntityState } from "@game/types";
import type {
  SiegeCombatStats,
  SiegeGameMode,
  SiegeWeaponId,
  SiegeZoneRect,
} from "@game/types";
import type {
  BugCounts,
  BugVisualSettings,
  ChartFocusState,
  MotionProfile,
  SceneProfile,
} from "../../../../types/dashboard";
import type { SurvivalSpawnPlan } from "@game/sim/survivalDirector";
import VfxCanvas from "@game/components/VfxCanvas";
import type { VfxEngine } from "@game/engine/VfxEngine";
import type {
  BackgroundFieldHandle,
  BugHitPayload,
  BugTransitionSnapshotItem,
  RenderedBugPosition,
} from "./types";
import { type CanvasBounds, type ReseedInfo } from "./canvasState";
import {
  clearBugCanvasQaBindings,
  installBugCanvasQaBindings,
  setupBugCanvasEngine,
} from "./bugCanvasEngineSetup";
import { setupBugCanvasRenderLoop } from "./bugCanvasRenderLoop";
import {
  applySurvivalSpawnPlan,
  clearInteractiveSwarm,
  getActiveBugCount,
  getLocalSiegeZones as computeLocalSiegeZones,
} from "./bugCanvasLiveState";

function clampNumber(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getSpeedMultiplier(chaosMultiplier?: number) {
  return clampNumber(
    Math.pow(Math.max(0.25, chaosMultiplier ?? 1), 0.32),
    0.5,
    1.35,
  );
}

export interface BugCanvasProps {
  bugVisualSettings: BugVisualSettings;
  chartFocus: ChartFocusState | null;
  combatStats?: SiegeCombatStats | null;
  gameMode?: SiegeGameMode;
  motionProfile: MotionProfile;
  onHit: (payload: BugHitPayload) => void;
  onCoreBreach?: (payload: { damage: number; variant: string }) => void;
  onWeaponFire?: (
    weapon: SiegeWeaponId,
    x: number,
    y: number,
    extras?: {
      angle?: number;
      chainNodes?: Array<{ x: number; y: number }>;
      jagOffsets?: number[];
      targetPoints?: Array<{ x: number; y: number }>;
      targetX?: number;
      targetY?: number;
      color?: string;
      beamWidth?: number;
      beamGlowWidth?: number;
      impactRadius?: number;
      reticleRadius?: number;
      shockwaveRadius?: number;
      chaosScale?: number;
      segments?: Array<{ x1: number; y1: number; x2: number; y2: number }>;
    },
  ) => void;
  selectedWeaponId?: SiegeWeaponId;
  streakMultiplier?: number;
  survivalSpawnPlan?: (SurvivalSpawnPlan & { sequenceId: number }) | null;
  maxWeaponTier?: import("@game/types").WeaponTier;
  bugCounts: BugCounts;
  runtimeSpeedMultiplier?: number;
  gamePaused?: boolean;
  runSeed?: string | null;
  sceneProfile: SceneProfile;
  sessionKey: string;
  siegeZones?: SiegeZoneRect[];
  interactiveMode: boolean;
  onEntityDeath?: (
    x: number,
    y: number,
    variant: string,
    meta: {
      credited: boolean;
      finisherStatus?:
        | import("@game/status/statusCatalog").SiegeStatusId
        | null;
      frozen: boolean;
      pointValue: number;
      supportStatuses?: import("@game/status/statusCatalog").SiegeStatusId[];
    },
  ) => void;
  gameConfig?: GameConfig;
  hammerPositionRef?: { current: { x: number; y: number } };
  getWeaponTier?: (id: SiegeWeaponId) => import("@game/types").WeaponTier;
  onWeaponEvolutionStatesChange?: (
    states: Map<SiegeWeaponId, import("@game/types").WeaponEvolutionState>,
  ) => void;
  onWeaponEvolution?: (
    weaponId: SiegeWeaponId,
    newTier: import("@game/types").WeaponTier,
  ) => void;
  clearSwarmRequestId?: number;
  onLiveBugCountChange?: (count: number) => void;
  onPhysicsBackendChange?: (backendId: string) => void;
  initialEvolutionStates?: Partial<
    Record<SiegeWeaponId, import("@game/types").WeaponEvolutionState>
  >;
  consumeTransitionSwarm?: () => Engine | null;
  transitionSnapshot?: BugTransitionSnapshotItem[] | null;
}

const BugCanvas = memo(
  forwardRef<BackgroundFieldHandle, BugCanvasProps>(function BugCanvas(
    {
      bugVisualSettings,
      chartFocus,
      combatStats,
      gameMode = "purge",
      motionProfile,
      onHit,
      onCoreBreach,
      onWeaponFire,
      selectedWeaponId = "hammer",
      streakMultiplier = 1,
      survivalSpawnPlan = null,
      maxWeaponTier,
      bugCounts,
      runtimeSpeedMultiplier = 1,
      gamePaused = false,
      runSeed = null,
      sceneProfile,
      sessionKey,
      siegeZones = [],
      interactiveMode,
      onEntityDeath,
      gameConfig,
      hammerPositionRef,
      getWeaponTier = () => 1 as import("@game/types").WeaponTier,
      onWeaponEvolutionStatesChange,
      onWeaponEvolution,
      clearSwarmRequestId = 0,
      onLiveBugCountChange,
      onPhysicsBackendChange,
      initialEvolutionStates,
      consumeTransitionSwarm,
      transitionSnapshot = null,
    }: BugCanvasProps,
    ref,
  ) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const swarmRef = useRef<any | null>(null);
    const motionProfileRef = useRef(motionProfile);
    const sceneProfileRef = useRef(sceneProfile);
    const chartFocusRef = useRef(chartFocus);
    const interactiveModeRef = useRef(interactiveMode);
    const combatStatsRef = useRef<SiegeCombatStats | null>(combatStats ?? null);
    const onHitRef = useRef(onHit);
    const onCoreBreachRef = useRef(onCoreBreach);
    const onEntityDeathRef = useRef(onEntityDeath);
    const onWeaponFireRef = useRef(onWeaponFire);
    const onWeaponEvolutionStatesChangeRef = useRef(
      onWeaponEvolutionStatesChange,
    );
    const getWeaponTierRef = useRef(getWeaponTier);
    const onLiveBugCountChangeRef = useRef(onLiveBugCountChange);
    const onPhysicsBackendChangeRef = useRef(onPhysicsBackendChange);
    const gameConfigRef = useRef(gameConfig);
    const initialEvolutionStatesRef = useRef(initialEvolutionStates);
    const consumeTransitionSwarmRef = useRef(consumeTransitionSwarm);
    const transitionSnapshotRef = useRef(transitionSnapshot);
    const vfxRef = useRef<VfxEngine | null>(null);
    const blackHoleVfxIdRef = useRef<string | null>(null);
    const streakMultiplierRef = useRef(streakMultiplier);
    const syncWeaponEvolutionStates = useCallback(() => {
      const states = swarmRef.current?.getWeaponEvolutionStates?.();
      if (states) {
        onWeaponEvolutionStatesChangeRef.current?.(states);
      }
    }, []);
    const selectedWeaponIdRef = useRef<SiegeWeaponId>(selectedWeaponId);
    const lastFireTimeRef = useRef<Record<string, number>>({});
    const currentMouseRef = useRef<{ x: number; y: number } | null>(null);
    const fireIntervalRef = useRef<number | null>(null);
    const isFiringRef = useRef(false);
    const reseedInfoRef = useRef<ReseedInfo | null>(null);
    const siegeZonesRef = useRef<SiegeZoneRect[]>(siegeZones);
    const boundsRef = useRef<CanvasBounds>({
      height: 0,
      left: 0,
      top: 0,
      width: 0,
    });
    const latestBugPositionsRef = useRef<RenderedBugPosition[]>([]);
    const lastReportedLiveBugCountRef = useRef<number | null>(null);
    const qaBindingOwnerRef = useRef<object | null>(null);
    const lastAppliedSpawnPlanRef = useRef(0);
    const gamePausedRef = useRef(gamePaused);
    const targetSettingsRef = useRef({
      sizeMultiplier: bugVisualSettings?.sizeMultiplier ?? 1,
      speedMultiplier: getSpeedMultiplier(bugVisualSettings?.chaosMultiplier),
    });
    const animatedStateRef = useRef({
      sizeMultiplier: bugVisualSettings?.sizeMultiplier ?? 1,
      speedMultiplier: getSpeedMultiplier(bugVisualSettings?.chaosMultiplier),
    });
    const [reseedInfo, setReseedInfo] = useState<ReseedInfo | null>(null);
    const gameConfigKey = useMemo(
      () => JSON.stringify(gameConfig ?? {}),
      [gameConfig],
    );

    useImperativeHandle(
      ref,
      () => ({
        captureTransitionSnapshot: () => {
          const bugs = swarmRef.current?.getAllBugs?.() as
            | Array<any>
            | undefined;
          if (!bugs?.length) {
            return [];
          }

          return bugs
            .filter((bug) => !isTerminalEntityState(bug.state))
            .map((bug) => ({
              cruiseSpeed:
                typeof bug.cruiseSpeed === "number"
                  ? bug.cruiseSpeed
                  : undefined,
              fleeTimer:
                typeof bug.fleeTimer === "number" ? bug.fleeTimer : null,
              hasEnteredField: bug.hasEnteredField === true,
              heading:
                typeof bug.heading === "number"
                  ? bug.heading
                  : Math.atan2(bug.vy ?? 0, bug.vx ?? 1),
              hp: bug.hp ?? bug.maxHp ?? 1,
              maxHp: bug.maxHp ?? 1,
              motionTime:
                typeof bug.motionTime === "number" ? bug.motionTime : undefined,
              movementMood:
                bug.movementMood === "startled" ? "startled" : "patrol",
              nextRoamTargetDelayMs:
                typeof bug.nextRoamTargetAt === "number"
                  ? Math.max(0, bug.nextRoamTargetAt - performance.now())
                  : undefined,
              opacity: bug.opacity ?? 1,
              prevX: typeof bug.prevX === "number" ? bug.prevX : bug.x,
              prevY: typeof bug.prevY === "number" ? bug.prevY : bug.y,
              roamTargetGeneration:
                typeof bug.roamTargetGeneration === "number"
                  ? bug.roamTargetGeneration
                  : undefined,
              roamTargetLongPath: bug.roamTargetLongPath === true,
              roamTargetWide: bug.roamTargetWide === true,
              roamTargetX:
                typeof bug.roamTargetX === "number" ? bug.roamTargetX : null,
              roamTargetY:
                typeof bug.roamTargetY === "number" ? bug.roamTargetY : null,
              seed: typeof bug.seed === "number" ? bug.seed : undefined,
              size: bug.size ?? 12,
              state: bug.state === "flee" ? "flee" : "patrol",
              turnRate:
                typeof bug.turnRate === "number" ? bug.turnRate : undefined,
              variant: bug.variant,
              vx: bug.vx ?? 0,
              vy: bug.vy ?? 0,
              wanderAngle:
                typeof bug.wanderAngle === "number"
                  ? bug.wanderAngle
                  : undefined,
              x: bug.x,
              y: bug.y,
            }));
        },
        detachTransitionSwarm: () => {
          const liveSwarm = swarmRef.current as Engine | null;

          if (!liveSwarm) {
            return null;
          }

          clearBugCanvasQaBindings(qaBindingOwnerRef.current ?? undefined);
          qaBindingOwnerRef.current = null;
          swarmRef.current = null;
          latestBugPositionsRef.current = [];
          lastReportedLiveBugCountRef.current = null;
          return liveSwarm;
        },
      }),
      [],
    );

    useEffect(() => {
      interactiveModeRef.current = interactiveMode;
      gamePausedRef.current = gamePaused;
      onWeaponEvolutionStatesChangeRef.current = onWeaponEvolutionStatesChange;
      getWeaponTierRef.current = getWeaponTier;
      onLiveBugCountChangeRef.current = onLiveBugCountChange;
      onPhysicsBackendChangeRef.current = onPhysicsBackendChange;
      gameConfigRef.current = gameConfig;
      initialEvolutionStatesRef.current = initialEvolutionStates;
      consumeTransitionSwarmRef.current = consumeTransitionSwarm;
      transitionSnapshotRef.current = transitionSnapshot;
      streakMultiplierRef.current = streakMultiplier;
      motionProfileRef.current = motionProfile;
      sceneProfileRef.current = sceneProfile;
      chartFocusRef.current = chartFocus;
      onHitRef.current = onHit;
      onCoreBreachRef.current = onCoreBreach;
      onEntityDeathRef.current = onEntityDeath;
      onWeaponFireRef.current = onWeaponFire;
      selectedWeaponIdRef.current = selectedWeaponId;
      combatStatsRef.current = combatStats ?? null;
      reseedInfoRef.current = reseedInfo;
      siegeZonesRef.current = siegeZones;
      targetSettingsRef.current = {
        sizeMultiplier: bugVisualSettings?.sizeMultiplier ?? 1,
        speedMultiplier: getSpeedMultiplier(bugVisualSettings?.chaosMultiplier),
      };
    }, [
      bugVisualSettings,
      chartFocus,
      combatStats,
      getWeaponTier,
      gameConfig,
      initialEvolutionStates,
      motionProfile,
      onEntityDeath,
      onHit,
      onCoreBreach,
      onWeaponEvolutionStatesChange,
      onLiveBugCountChange,
      onPhysicsBackendChange,
      onWeaponFire,
      reseedInfo,
      sceneProfile,
      selectedWeaponId,
      siegeZones,
      streakMultiplier,
      transitionSnapshot,
      consumeTransitionSwarm,
      interactiveMode,
      gamePaused,
    ]);

    const getLocalSiegeZones = useCallback(
      () => computeLocalSiegeZones(canvasRef, boundsRef, siegeZonesRef),
      [],
    );

    const ensureQaBindings = useCallback(() => {
      if (typeof window === "undefined") {
        return;
      }

      const qaState = (
        window as Window & {
          __RTZ_QA__?: {
            clearLiveBugs?: () => number;
            enabled?: boolean;
            getLiveBugCount?: () => number;
            repositionLiveBug?: (request: {
              heading?: number;
              index: number;
              vx?: number;
              vy?: number;
              x: number;
              y: number;
            }) => boolean;
          };
        }
      ).__RTZ_QA__;

      if (!qaState?.enabled || !swarmRef.current) {
        return;
      }

      if (
        typeof qaState.repositionLiveBug === "function" &&
        typeof qaState.getLiveBugCount === "function" &&
        typeof qaState.clearLiveBugs === "function"
      ) {
        return;
      }

      qaBindingOwnerRef.current = installBugCanvasQaBindings({
        bounds: boundsRef.current,
        engine: swarmRef.current,
        height: canvasRef.current?.clientHeight || boundsRef.current.height || 600,
        latestBugPositionsRef,
        onLiveBugCountChange: onLiveBugCountChangeRef.current ?? undefined,
        width: canvasRef.current?.clientWidth || boundsRef.current.width || 800,
      });
    }, []);

    useEffect(() => {
      applySurvivalSpawnPlan({
        getLocalZones: getLocalSiegeZones,
        interactiveMode,
        lastAppliedSpawnPlanRef,
        onLiveBugCountChange: onLiveBugCountChangeRef.current,
        spawnPlan: survivalSpawnPlan,
        swarm: swarmRef.current,
      });
    }, [getLocalSiegeZones, interactiveMode, survivalSpawnPlan]);

    useEffect(() => {
      // Recreate the engine only when the logical session changes.
      // In interactive play, live bug counts can change on every kill and must
      // not rebuild the entire swarm or the canvas will visibly flicker.
      const canvas = canvasRef.current;
      const currentVfx = vfxRef.current;
      const w = canvas?.clientWidth || boundsRef.current.width || 800;
      const h = canvas?.clientHeight || boundsRef.current.height || 600;
      let cancelled = false;
      let disposePhysicsAdapter: (() => void) | undefined;

      const setupEngine = async () => {
        if (!canvas) {
          return;
        }

        if (
          swarmRef.current &&
          typeof (swarmRef.current as any).destroy === "function"
        ) {
          try {
            (swarmRef.current as any).destroy();
          } catch {
            void 0;
          }
        }

        const result = await setupBugCanvasEngine({
          bugCounts,
          bounds: boundsRef.current,
          canvas,
          gameConfig: (gameConfigRef.current as any) ?? undefined,
          getLocalSiegeZones,
          height: h,
          initialEvolutionStates:
            initialEvolutionStatesRef.current ?? undefined,
          interactiveMode,
          latestBugPositionsRef,
          maxWeaponTier,
          notifyPhysicsBackendChange: (backendId) =>
            onPhysicsBackendChangeRef.current?.(backendId),
          notifyWeaponEvolution: (weaponId, newTier) => {
            const bounds = boundsRef.current;
            vfxRef.current?.spawnLevelUp?.(
              Math.round((bounds.width || w) * 0.5),
              Math.round(Math.max(72, (bounds.height || h) * 0.24)),
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
          width: w,
        });
        if (cancelled) {
          result.physicsAdapter.dispose?.();
          return;
        }

        swarmRef.current = result.engine;
        disposePhysicsAdapter = () => result.physicsAdapter.dispose?.();
        qaBindingOwnerRef.current = installBugCanvasQaBindings({
          bounds: boundsRef.current,
          engine: result.engine,
          height: h,
          latestBugPositionsRef,
          onLiveBugCountChange: onLiveBugCountChangeRef.current ?? undefined,
          width: w,
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
        // if effect re-runs or component unmounts, clear engine reference
        if (
          swarmRef.current &&
          typeof (swarmRef.current as any).destroy === "function"
        ) {
          try {
            (swarmRef.current as any).destroy();
          } catch {
            void 0;
          }
        }
        disposePhysicsAdapter?.();
        clearBugCanvasQaBindings(qaBindingOwnerRef.current ?? undefined);
        qaBindingOwnerRef.current = null;
        swarmRef.current = null;
      };
    }, [
      bugCounts,
      gameConfigKey,
      gameMode,
      getLocalSiegeZones,
      interactiveMode,
      maxWeaponTier,
      onWeaponEvolution,
      runSeed,
      sessionKey,
      syncWeaponEvolutionStates,
    ]);

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) {
        return undefined;
      }
      return setupBugCanvasRenderLoop({
        animatedStateRef,
        blackHoleVfxIdRef,
        boundsRef,
        canvas,
        canvasRef,
        chartFocusRef,
        currentMouseRef,
        ensureQaBindings,
        fireIntervalRef,
        gamePausedRef,
        getWeaponTierRef,
        hammerPositionRef,
        interactiveModeRef,
        isFiringRef,
        lastFireTimeRef,
        lastReportedLiveBugCountRef,
        latestBugPositionsRef,
        motionProfileRef,
        onHitRef,
        onLiveBugCountChangeRef,
        onWeaponFireRef,
        reseedInfoRef,
        runtimeSpeedMultiplier,
        selectedWeaponIdRef,
        setReseedInfo,
        streakMultiplierRef,
        swarmRef,
        syncWeaponEvolutionStates,
        targetSettingsRef,
        vfxRef,
      });
    }, [
      ensureQaBindings,
      hammerPositionRef,
      runtimeSpeedMultiplier,
      syncWeaponEvolutionStates,
    ]);

    useEffect(() => {
      clearInteractiveSwarm({
        boundsRef,
        clearSwarmRequestId,
        interactiveMode,
        latestBugPositionsRef,
        lastReportedLiveBugCountRef,
        onLiveBugCountChange: onLiveBugCountChangeRef.current,
        swarm: swarmRef.current as
          | (Engine & { clearAllBugs?: () => number })
          | null,
      });
    }, [clearSwarmRequestId, interactiveMode]);

    return (
      <>
        <canvas
          ref={canvasRef}
          className="absolute inset-0 h-full w-full opacity-96"
          aria-hidden="true"
          style={{
            backfaceVisibility: "hidden",
            contain: "layout paint",
            transform: "translateZ(0)",
          }}
        />
        {interactiveMode ? <VfxCanvas ref={vfxRef} /> : null}
        {reseedInfo ? (
          <div className="pointer-events-none fixed left-3 bottom-3 z-[120] rounded-md bg-black/60 px-2 py-1 text-xs text-white backdrop-blur-sm">
            <div>Reseeded: {new Date(reseedInfo.ts).toLocaleTimeString()}</div>
            <div className="opacity-80">
              clustered: {reseedInfo.clustered} / {reseedInfo.total}
            </div>
          </div>
        ) : null}
      </>
    );
  }),
);

export default BugCanvas;
