import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Engine from "@game/engine/Engine";
import type { GameConfig } from "@game/engine/types";
import { DEFAULT_GAME_CONFIG } from "@game/engine/types";
import type {
  PlacedStructure,
  SiegeCombatStats,
  SiegeWeaponId,
  SiegeZoneRect,
  StructureId,
} from "@game/types";
import type {
  BugCounts,
  BugVisualSettings,
  ChartFocusState,
  MotionProfile,
  SceneProfile,
} from "../../../../types/dashboard";
import VfxCanvas from "@game/components/VfxCanvas";
import type { VfxEngine } from "@game/engine/VfxEngine";
import type { BugHitPayload, RenderedBugPosition } from "./types";
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
  return clampNumber(Math.sqrt(Math.max(0.2, chaosMultiplier ?? 1)), 0.45, 2.2);
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
  motionProfile: MotionProfile;
  onHit: (payload: BugHitPayload) => void;
  onWeaponFire?: (
    weapon: SiegeWeaponId,
    x: number,
    y: number,
    extras?: {
      angle?: number;
      chainNodes?: Array<{ x: number; y: number }>;
      jagOffsets?: number[];
      targetX?: number;
      targetY?: number;
      color?: string;
      segments?: Array<{ x1: number; y1: number; x2: number; y2: number }>;
    },
  ) => void;
  placingStructureId?: StructureId | null;
  onStructurePlace?: (
    structureType: StructureId,
    viewportX: number,
    viewportY: number,
    canvasX: number,
    canvasY: number,
    structureId?: string,
  ) => void;
  selectedWeaponId?: SiegeWeaponId;
  streakMultiplier?: number;
  bugCounts: BugCounts;
  sceneProfile: SceneProfile;
  sessionKey: string;
  siegeZones?: SiegeZoneRect[];
  interactiveMode: boolean;
  onEntityDeath?: (
    x: number,
    y: number,
    variant: string,
    meta: { credited: boolean; frozen: boolean; pointValue: number },
  ) => void;
  onStructureKill?: (
    structureId: string,
    x: number,
    y: number,
    variant: string,
  ) => void;
  placedStructures?: PlacedStructure[];
  onAgentAbsorb?: (data: {
    structureId: string;
    phase: "absorbing" | "pulling" | "done" | "failed";
    variant: string;
    bugX: number;
    bugY: number;
    srcX?: number;
    srcY?: number;
    processingMs?: number;
  }) => void;
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
  initialEvolutionStates?: Partial<
    Record<SiegeWeaponId, import("@game/types").WeaponEvolutionState>
  >;
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

const BugCanvas = memo(function BugCanvas({
  bugVisualSettings,
  chartFocus,
  combatStats,
  motionProfile,
  onHit,
  onWeaponFire,
  placingStructureId,
  onStructurePlace,
  selectedWeaponId = "hammer",
  streakMultiplier = 1,
  bugCounts,
  sceneProfile,
  sessionKey,
  siegeZones = [],
  interactiveMode,
  onEntityDeath,
  onStructureKill,
  placedStructures,
  onAgentAbsorb,
  gameConfig,
  hammerPositionRef,
  getWeaponTier = () => 1 as import("@game/types").WeaponTier,
  onWeaponEvolutionStatesChange,
  onWeaponEvolution,
  clearSwarmRequestId = 0,
  onLiveBugCountChange,
  initialEvolutionStates,
}: BugCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const swarmRef = useRef<any | null>(null);
  const motionProfileRef = useRef(motionProfile);
  const sceneProfileRef = useRef(sceneProfile);
  const chartFocusRef = useRef(chartFocus);
  const interactiveModeRef = useRef(interactiveMode);
  const combatStatsRef = useRef<SiegeCombatStats | null>(combatStats ?? null);
  const onHitRef = useRef(onHit);
  const onEntityDeathRef = useRef(onEntityDeath);
  const onStructureKillRef = useRef(onStructureKill);
  const onAgentAbsorbRef = useRef(onAgentAbsorb);
  const onWeaponFireRef = useRef(onWeaponFire);
  const onWeaponEvolutionStatesChangeRef = useRef(
    onWeaponEvolutionStatesChange,
  );
  const getWeaponTierRef = useRef(getWeaponTier);
  const onLiveBugCountChangeRef = useRef(onLiveBugCountChange);
  const vfxRef = useRef<VfxEngine | null>(null);
  const blackHoleVfxIdRef = useRef<string | null>(null);
  const placingStructureIdRef = useRef(placingStructureId);
  const onStructurePlaceRef = useRef(onStructurePlace);
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

  useEffect(() => {
    interactiveModeRef.current = interactiveMode;
    onWeaponEvolutionStatesChangeRef.current = onWeaponEvolutionStatesChange;
    getWeaponTierRef.current = getWeaponTier;
    onLiveBugCountChangeRef.current = onLiveBugCountChange;
    streakMultiplierRef.current = streakMultiplier;
    motionProfileRef.current = motionProfile;
    sceneProfileRef.current = sceneProfile;
    chartFocusRef.current = chartFocus;
    onHitRef.current = onHit;
    onEntityDeathRef.current = onEntityDeath;
    onStructureKillRef.current = onStructureKill;
    onAgentAbsorbRef.current = onAgentAbsorb;
    onWeaponFireRef.current = onWeaponFire;
    placingStructureIdRef.current = placingStructureId;
    onStructurePlaceRef.current = onStructurePlace;
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
    motionProfile,
    onAgentAbsorb,
    onEntityDeath,
    onHit,
    onStructureKill,
    onStructurePlace,
    onWeaponEvolutionStatesChange,
    onLiveBugCountChange,
    onWeaponFire,
    placingStructureId,
    reseedInfo,
    sceneProfile,
    selectedWeaponId,
    siegeZones,
    streakMultiplier,
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
    // Recreate the engine only when the logical session changes.
    // In interactive play, live bug counts can change on every kill and must
    // not rebuild the entire swarm or the canvas will visibly flicker.
    const canvas = canvasRef.current;
    const w = canvas?.clientWidth || boundsRef.current.width || 800;
    const h = canvas?.clientHeight || boundsRef.current.height || 600;
    if (canvas) {
      // clean up previous engine if present
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

      const engine = new Engine(canvas, {
        width: w,
        height: h,
        config: (gameConfig as any) ?? undefined,
        onEntityDeath: (x, y, variant, meta) => {
          try {
            onEntityDeathRef.current?.(
              Math.round(x + (boundsRef.current.left || 0)),
              Math.round(y + (boundsRef.current.top || 0)),
              variant,
              meta,
            );
            syncWeaponEvolutionStates();
          } catch {
            void 0;
          }
        },
        onStructureKill: (structureId, x, y, variant) => {
          try {
            onStructureKillRef.current?.(
              structureId,
              Math.round(x + (boundsRef.current.left || 0)),
              Math.round(y + (boundsRef.current.top || 0)),
              variant,
            );
          } catch {
            void 0;
          }
        },
        onAgentAbsorb: (data) => {
          try {
            // VFX: lasso tracer during pull phase
            if (
              data.phase === "pulling" &&
              vfxRef.current &&
              data.srcX !== undefined &&
              data.srcY !== undefined
            ) {
              vfxRef.current.addTracerLine(
                data.bugX,
                data.bugY,
                data.srcX,
                data.srcY,
                120,
              );
            }
            // VFX: burst on fail
            if (data.phase === "failed" && vfxRef.current) {
              vfxRef.current.spawnExplosion(data.bugX, data.bugY, 60, 0x34d399);
            }
            onAgentAbsorbRef.current?.(data);
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
        initialEvolutionStates: initialEvolutionStates ?? undefined,
      });
      // store original baseSpeed so we can apply UI speedMultiplier without compounding
      try {
        (engine as any).__baseSpeedOriginal = engine.config.baseSpeed;
      } catch {
        // ignore in case shape differs
      }
      engine.spawnFromCounts(
        bugCounts as any,
        interactiveMode ? getLocalSiegeZones() : [],
      );
      stabilizeQaEngine(engine, w, h);
      swarmRef.current = engine;
      syncQaBugPositionsFromEngine(engine, boundsRef.current);
    }
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
    return () => {
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
      swarmRef.current = null;
    };
    // Note: interactiveMode is intentionally excluded from this dep array.
    // Removing it prevents the engine from being destroyed and recreated when
    // siege mode activates, giving a seamless visual transition.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionKey, gameConfigKey, getLocalSiegeZones]);

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
        animatedState.speedMultiplier,
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
              vfxRef.current.spawnVoidCollapse(bx, by, brad);
              vfxRef.current.spawnExplosion(bx, by, brad * 0.6, 0x7c3aed);
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
        getOnStructurePlace: () => onStructurePlaceRef.current,
        getOnWeaponFire: () => onWeaponFireRef.current,
        getPlacingStructureId: () => placingStructureIdRef.current ?? null,
        getSelectedWeaponId: () => selectedWeaponIdRef.current,
        streakMultiplier: streakMultiplierRef.current,
        getSwarm: () => swarmRef.current,
        syncWeaponEvolutionStates,
        updateBounds: () => {
          boundsRef.current = updateLiveCanvasBounds(canvas, boundsRef.current);
          return boundsRef.current;
        },
        vfxRef,
      },
      lastFireTimeRef,
    );

    const handleInteractivePointerDown = (event: MouseEvent) => {
      if (!shouldHandlePointerDown(interactiveModeRef.current, event.target)) {
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
  }, [hammerPositionRef, syncWeaponEvolutionStates]);

  useEffect(() => {
    const engine = swarmRef.current as
      | (Engine & {
          updateStructureTier?: (
            id: string,
            tier: import("@game/types").WeaponTier,
          ) => void;
        })
      | null;
    if (!engine || !placedStructures) {
      return;
    }

    for (const structure of placedStructures) {
      engine.updateStructureTier?.(structure.id, structure.tier);
    }
  }, [placedStructures]);

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
});

export default BugCanvas;
