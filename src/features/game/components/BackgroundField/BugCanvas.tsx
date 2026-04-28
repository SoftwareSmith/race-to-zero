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
import {
  createPreferredPhysicsAdapter,
  type PhysicsAdapter,
} from "@game/engine/physicsAdapter";
import type { GameConfig } from "@game/engine/types";
import { DEFAULT_GAME_CONFIG } from "@game/engine/types";
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
import {
  isQaEnabled,
  recordQaFrameTiming,
  updateQaBugPositions,
  syncQaBugPositionsFromEngine,
  stabilizeQaEngine,
} from "./qa";
import { drawBugFramePass } from "./bugFramePass";
import {
  measureCanvasBounds,
  reseedClusteredBugs,
  updateLiveCanvasBounds,
  type CanvasBounds,
  type ReseedInfo,
} from "./canvasState";
import { createPointerDownHandler } from "./weaponInput";

const AMBIENT_TARGET_FRAME_MS = 1000 / 24;
const INTERACTIVE_TARGET_FRAME_MS = 1000 / 45;
const TRANSITION_EASING = 0.08;
const STRESS_STEP_CAP_1200 = 3;
const STRESS_STEP_CAP_2500 = 2;
const STRESS_STEP_CAP_5000 = 1;

function interpolate(
  currentValue: number,
  targetValue: number,
  easing = TRANSITION_EASING,
) {
  return currentValue + (targetValue - currentValue) * easing;
}

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

function getSimulationSteps(frameTimeSeconds: number, bugCount: number) {
  const requestedSteps = Math.max(1, Math.floor(frameTimeSeconds * 60));

  if (bugCount >= 5000) {
    return Math.min(requestedSteps, STRESS_STEP_CAP_5000);
  }

  if (bugCount >= 2500) {
    return Math.min(requestedSteps, STRESS_STEP_CAP_2500);
  }

  if (bugCount >= 1200) {
    return Math.min(requestedSteps, STRESS_STEP_CAP_1200);
  }

  return requestedSteps;
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
  transitionSnapshot?: BugTransitionSnapshotItem[] | null;
}

function shouldHandlePointerDown(
  interactiveMode: boolean,
  eventTarget: EventTarget | null,
) {
  if (!interactiveMode) {
    return false;
  }

  return eventTarget instanceof Element
    ? !eventTarget.closest("[data-no-hammer]")
    : true;
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
    const lastAppliedSpawnPlanRef = useRef(0);
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
              heading:
                typeof bug.heading === "number"
                  ? bug.heading
                  : Math.atan2(bug.vy ?? 0, bug.vx ?? 1),
              hp: bug.hp ?? bug.maxHp ?? 1,
              maxHp: bug.maxHp ?? 1,
              opacity: bug.opacity ?? 1,
              size: bug.size ?? 12,
              variant: bug.variant,
              vx: bug.vx ?? 0,
              vy: bug.vy ?? 0,
              x: bug.x,
              y: bug.y,
            }));
        },
      }),
      [],
    );

    useEffect(() => {
      interactiveModeRef.current = interactiveMode;
      onWeaponEvolutionStatesChangeRef.current = onWeaponEvolutionStatesChange;
      getWeaponTierRef.current = getWeaponTier;
      onLiveBugCountChangeRef.current = onLiveBugCountChange;
      onPhysicsBackendChangeRef.current = onPhysicsBackendChange;
      gameConfigRef.current = gameConfig;
      initialEvolutionStatesRef.current = initialEvolutionStates;
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
      interactiveMode,
    ]);

    const getLocalSiegeZones = useCallback(() => {
      const canvasBounds = canvasRef.current?.getBoundingClientRect();
      const left = canvasBounds?.left ?? boundsRef.current.left;
      const top = canvasBounds?.top ?? boundsRef.current.top;

      return siegeZonesRef.current
        .map((zone) => ({
          height: zone.height,
          left: zone.left - left,
          top: zone.top - top,
          width: zone.width,
        }))
        .filter((zone) => zone.width > 0 && zone.height > 0);
    }, []);

    useEffect(() => {
      if (
        !interactiveMode ||
        !survivalSpawnPlan ||
        !swarmRef.current ||
        survivalSpawnPlan.sequenceId <= lastAppliedSpawnPlanRef.current
      ) {
        return;
      }

      lastAppliedSpawnPlanRef.current = survivalSpawnPlan.sequenceId;
      swarmRef.current.spawnBurst?.(
        survivalSpawnPlan.counts as any,
        getLocalSiegeZones(),
      );
      onLiveBugCountChangeRef.current?.(
        (swarmRef.current.getAllBugs?.() as Array<unknown>)?.length ?? 0,
      );
    }, [getLocalSiegeZones, interactiveMode, survivalSpawnPlan]);

    useEffect(() => {
      // Recreate the engine only when the logical session changes.
      // In interactive play, live bug counts can change on every kill and must
      // not rebuild the entire swarm or the canvas will visibly flicker.
      const canvas = canvasRef.current;
      const w = canvas?.clientWidth || boundsRef.current.width || 800;
      const h = canvas?.clientHeight || boundsRef.current.height || 600;
      let cancelled = false;
      let physicsAdapter: PhysicsAdapter | null = null;

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

        physicsAdapter = await createPreferredPhysicsAdapter(interactiveMode);
        if (cancelled) {
          physicsAdapter.dispose?.();
          return;
        }

        onPhysicsBackendChangeRef.current?.(physicsAdapter.id);
        const engine = new Engine(canvas, {
          width: w,
          height: h,
          config: (gameConfigRef.current as any) ?? undefined,
          maxWeaponTier,
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
          onWeaponEvolution: (weaponId, newTier) => {
            const bounds = boundsRef.current;
            vfxRef.current?.spawnLevelUp?.(
              Math.round((bounds.width || w) * 0.5),
              Math.round(Math.max(72, (bounds.height || h) * 0.24)),
            );
            onWeaponEvolution?.(weaponId, newTier);
          },
          initialEvolutionStates:
            initialEvolutionStatesRef.current ?? undefined,
        });
        try {
          (engine as any).__baseSpeedOriginal = engine.config.baseSpeed;
        } catch {
          void 0;
        }
        const nextTransitionSnapshot = transitionSnapshotRef.current;
        if (interactiveMode && nextTransitionSnapshot?.length) {
          engine.spawnFromSnapshot(nextTransitionSnapshot);
        } else {
          engine.spawnFromCounts(
            bugCounts as any,
            interactiveMode ? getLocalSiegeZones() : [],
          );
        }
        stabilizeQaEngine(engine, w, h);
        swarmRef.current = engine;
        syncQaBugPositionsFromEngine(engine, boundsRef.current);

        const maybeBugs = swarmRef.current.getAllBugs() as Array<any>;
        const nextReseedInfo = reseedClusteredBugs(
          maybeBugs,
          w,
          h,
          targetSettingsRef.current.speedMultiplier,
          {
            baseSpeed:
              (swarmRef.current as any)?.__baseSpeedOriginal ??
              DEFAULT_GAME_CONFIG.baseSpeed,
            thresholdRatio: 0.25,
          },
        );
        if (nextReseedInfo) {
          setReseedInfo(nextReseedInfo);
        }
      };

      void setupEngine();

      return () => {
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
        physicsAdapter?.dispose?.();
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

      const context = canvas.getContext("2d", { alpha: true });
      if (!context) {
        return undefined;
      }

      let animationFrameId = 0;
      let lastDrawTime = 0;
      let width = 0;
      let height = 0;
      let isActive = !document.hidden && document.hasFocus();

      const resizeCanvas = () => {
        const measurement = measureCanvasBounds(canvas);
        if (!measurement) {
          return;
        }

        width = measurement.width;
        height = measurement.height;
        boundsRef.current = measurement.bounds;
        canvas.width = Math.floor(width * measurement.devicePixelRatio);
        canvas.height = Math.floor(height * measurement.devicePixelRatio);
        context.setTransform(
          measurement.devicePixelRatio,
          0,
          0,
          measurement.devicePixelRatio,
          0,
          0,
        );
        swarmRef.current?.setSize?.(width, height);
      };

      const updateActivity = () => {
        isActive = !document.hidden && document.hasFocus();

        if (isActive && !animationFrameId) {
          animationFrameId = window.requestAnimationFrame(renderFrame);
        }
      };

      const renderFrame = (timestamp: number) => {
        const frameStart = performance.now();

        if (!isActive) {
          animationFrameId = 0;
          return;
        }

        if (!lastDrawTime) {
          lastDrawTime = timestamp;
          animationFrameId = window.requestAnimationFrame(renderFrame);
          return;
        }

        const dtSec = Math.min(0.12, (timestamp - lastDrawTime) / 1000);
        lastDrawTime = timestamp;
        const nextSettings = targetSettingsRef.current;
        const animatedState = animatedStateRef.current;
        animatedState.sizeMultiplier = interpolate(
          animatedState.sizeMultiplier,
          nextSettings.sizeMultiplier,
        );
        animatedState.speedMultiplier = interpolate(
          animatedState.speedMultiplier,
          nextSettings.speedMultiplier,
        );

        const sizeMultiplier = animatedState.sizeMultiplier;
        const speedMultiplier = clampNumber(
          animatedState.speedMultiplier * runtimeSpeedMultiplier,
          0.2,
          6,
        );

        // advance engine or swarm according to elapsed time to create continuous motion
        if (swarmRef.current) {
          if ((swarmRef.current as any).config) {
            const engine = swarmRef.current as any;
            const base =
              engine.__baseSpeedOriginal ??
              engine.config.baseSpeed ??
              DEFAULT_GAME_CONFIG.baseSpeed;
            engine.config.baseSpeed = base * speedMultiplier;
          }
          const steps = getSimulationSteps(
            dtSec,
            (swarmRef.current as any).getAllBugs().length,
          );
          for (let s = 0; s < steps; s++) {
            if ((swarmRef.current as any).update.length >= 1) {
              (swarmRef.current as any).update(1 / 60, null, null);
            } else {
              (swarmRef.current as any).update();
            }
          }
        }
        context.clearRect(0, 0, width, height);

        // ensure width/height are valid before math that divides by them
        if (!width || !height) {
          width = canvas.clientWidth || boundsRef.current.width || 800;
          height = canvas.clientHeight || boundsRef.current.height || 600;
        }
        const activeParticles = swarmRef.current
          ? swarmRef.current.getAllBugs()
          : [];
        const activeMotionProfile = motionProfileRef.current;
        const activeChartFocus = chartFocusRef.current;
        const frameNow = performance.now();
        const nextBugPositions = drawBugFramePass({
          chartFocus: activeChartFocus,
          context,
          frameNow,
          height,
          interactiveMode: interactiveModeRef.current,
          motionProfile: activeMotionProfile,
          particles: activeParticles,
          qaEnabled: isQaEnabled(),
          reusablePositions: latestBugPositionsRef.current,
          sizeMultiplier,
          width,
        });
        latestBugPositionsRef.current = nextBugPositions;
        if (interactiveModeRef.current) {
          const liveBugCount = nextBugPositions.length;
          if (lastReportedLiveBugCountRef.current !== liveBugCount) {
            lastReportedLiveBugCountRef.current = liveBugCount;
            onLiveBugCountChangeRef.current?.(liveBugCount);
          }
        } else {
          lastReportedLiveBugCountRef.current = null;
        }
        updateQaBugPositions(nextBugPositions, boundsRef.current);
        recordQaFrameTiming(
          performance.now() - frameStart,
          nextBugPositions.length,
        );

        // Tick black hole gravity well (Void Pulse weapon)
        if (
          swarmRef.current &&
          typeof swarmRef.current.tickBlackHole === "function"
        ) {
          swarmRef.current.tickBlackHole(
            dtSec * 1000,
            (bx: number, by: number, brad: number) => {
              if (vfxRef.current) {
                vfxRef.current.spawnVoidCollapse(
                  bx,
                  by,
                  Math.max(56, brad * 0.46),
                );
              }
              // Clean up the black hole visual
              if (blackHoleVfxIdRef.current && vfxRef.current) {
                vfxRef.current.destroyBlackHole(blackHoleVfxIdRef.current);
                blackHoleVfxIdRef.current = null;
              }
            },
          );
          // Animate the persistent black hole rings each frame
          const bhId = blackHoleVfxIdRef.current;
          if (bhId && vfxRef.current) {
            vfxRef.current.tickBlackHoleVfx(bhId);
          }
        }

        // one-time safety reseed: if many bugs still sit at 0,0, reseed and surface badge
        if (!reseedInfoRef.current && swarmRef.current) {
          const bugs = swarmRef.current.getAllBugs() as Array<any>;
          const nextReseedInfo = reseedClusteredBugs(
            bugs,
            width,
            height,
            targetSettingsRef.current.speedMultiplier,
            {
              baseSpeed:
                (swarmRef.current as any)?.__baseSpeedOriginal ??
                DEFAULT_GAME_CONFIG.baseSpeed,
              thresholdRatio: 0.2,
            },
          );
          if (nextReseedInfo) {
            reseedInfoRef.current = nextReseedInfo;
            setReseedInfo(nextReseedInfo);
          }
        }

        animationFrameId = window.requestAnimationFrame(renderFrame);
      };

      resizeCanvas();

      const resizeObserver = new ResizeObserver(() => {
        resizeCanvas();
      });
      resizeObserver.observe(canvas);

      const handlePointerDown = createPointerDownHandler(
        {
          blackHoleVfxIdRef,
          boundsRef,
          canvasRef,
          currentMouseRef,
          fireIntervalRef,
          getWeaponTier: (weaponId) => getWeaponTierRef.current(weaponId),
          hammerPositionRef,
          isFiringRef,
          onHit: (payload) => onHitRef.current(payload as any),
          getOnWeaponFire: () => onWeaponFireRef.current,
          getSelectedWeaponId: () => selectedWeaponIdRef.current,
          streakMultiplier: streakMultiplierRef.current,
          getSwarm: () => swarmRef.current,
          syncWeaponEvolutionStates,
          updateBounds: () => {
            boundsRef.current = updateLiveCanvasBounds(
              canvas,
              boundsRef.current,
            );
            return boundsRef.current;
          },
          vfxRef,
        },
        lastFireTimeRef,
      );

      const handleInteractivePointerDown = (event: MouseEvent) => {
        if (
          !shouldHandlePointerDown(interactiveModeRef.current, event.target)
        ) {
          return;
        }

        handlePointerDown(event);
      };

      document.addEventListener("visibilitychange", updateActivity);
      window.addEventListener("focus", updateActivity);
      window.addEventListener("blur", updateActivity);
      // Single registration - the useEffect cleanup in React Strict Mode re-runs will
      // remove the previous listener before re-registering, so no double-fire risk.
      window.addEventListener("mousedown", handleInteractivePointerDown);
      animationFrameId = window.requestAnimationFrame(renderFrame);

      return () => {
        resizeObserver.disconnect();
        document.removeEventListener("visibilitychange", updateActivity);
        window.removeEventListener("focus", updateActivity);
        window.removeEventListener("blur", updateActivity);
        window.removeEventListener("mousedown", handleInteractivePointerDown);
        if (animationFrameId) {
          window.cancelAnimationFrame(animationFrameId);
        }
      };
    }, [hammerPositionRef, runtimeSpeedMultiplier, syncWeaponEvolutionStates]);

    useEffect(() => {
      if (!interactiveMode || clearSwarmRequestId === 0) {
        return;
      }

      const engine = swarmRef.current as
        | (Engine & { clearAllBugs?: () => number })
        | null;
      if (!engine?.clearAllBugs) {
        return;
      }

      engine.clearAllBugs();
      latestBugPositionsRef.current = [];
      lastReportedLiveBugCountRef.current = 0;
      onLiveBugCountChangeRef.current?.(0);
      updateQaBugPositions([], boundsRef.current);
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
