import type { Dispatch, MutableRefObject, RefObject, SetStateAction } from "react";
import { DEFAULT_GAME_CONFIG } from "@game/engine/types";
import { isTerminalEntityState, type SiegeCombatStats, type SiegeWeaponId } from "@game/types";
import type {
  BugVisualSettings,
  ChartFocusState,
  MotionProfile,
  SceneProfile,
} from "../../../../types/dashboard";
import { drawBugFramePass } from "./bugFramePass";
import {
  measureCanvasBounds,
  reseedClusteredBugs,
  updateLiveCanvasBounds,
  type CanvasBounds,
  type ReseedInfo,
} from "./canvasState";
import {
  isQaEnabled,
  recordQaDurationSample,
  recordQaFrameTiming,
  syncQaBugTelemetryFromEngine,
  updateQaBugPositions,
} from "./qa";
import type { BugHitPayload, RenderedBugPosition } from "./types";
import { createPointerDownHandler } from "./weaponInput";
import type { VfxEngine } from "@game/engine/VfxEngine";

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

function getActiveBugCount(bugs: Array<any> | undefined | null) {
  if (!bugs?.length) {
    return 0;
  }

  return bugs.reduce((count, bug) => {
    return isTerminalEntityState(bug?.state) ? count : count + 1;
  }, 0);
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

function getInteractiveCursorTarget(
  bounds: CanvasBounds,
  hammerPositionRef?: { current: { x: number; y: number } },
) {
  if (!bounds.width || !bounds.height || !hammerPositionRef) {
    return null;
  }

  const { x, y } = hammerPositionRef.current;
  if (!Number.isFinite(x) || !Number.isFinite(y) || (x === 0 && y === 0)) {
    return null;
  }

  const hoverPadding = DEFAULT_GAME_CONFIG.fleeRadius * 3.5;
  const withinHoverRange =
    x >= bounds.left - hoverPadding &&
    x <= bounds.left + bounds.width + hoverPadding &&
    y >= bounds.top - hoverPadding &&
    y <= bounds.top + bounds.height + hoverPadding;

  if (!withinHoverRange) {
    return null;
  }

  return {
    targetX: x - bounds.left,
    targetY: y - bounds.top,
  };
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

interface BugCanvasRenderLoopOptions {
  animatedStateRef: MutableRefObject<{
    sizeMultiplier: number;
    speedMultiplier: number;
  }>;
  blackHoleVfxIdRef: MutableRefObject<string | null>;
  boundsRef: MutableRefObject<CanvasBounds>;
  canvas: HTMLCanvasElement;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  chartFocusRef: MutableRefObject<ChartFocusState | null>;
  currentMouseRef: MutableRefObject<{ x: number; y: number } | null>;
  fireIntervalRef: MutableRefObject<number | null>;
  gamePausedRef: MutableRefObject<boolean>;
  getWeaponTierRef: MutableRefObject<
    (id: SiegeWeaponId) => import("@game/types").WeaponTier
  >;
  hammerPositionRef?: { current: { x: number; y: number } };
  interactiveModeRef: MutableRefObject<boolean>;
  isFiringRef: MutableRefObject<boolean>;
  lastFireTimeRef: MutableRefObject<Record<string, number>>;
  lastReportedLiveBugCountRef: MutableRefObject<number | null>;
  latestBugPositionsRef: MutableRefObject<RenderedBugPosition[]>;
  motionProfileRef: MutableRefObject<MotionProfile>;
  onHitRef: MutableRefObject<(payload: BugHitPayload) => void>;
  onLiveBugCountChangeRef: MutableRefObject<((count: number) => void) | undefined>;
  onWeaponFireRef: MutableRefObject<
    | ((
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
      ) => void)
    | undefined
  >;
  reseedInfoRef: MutableRefObject<ReseedInfo | null>;
  runtimeSpeedMultiplier: number;
  selectedWeaponIdRef: MutableRefObject<SiegeWeaponId>;
  setReseedInfo: Dispatch<SetStateAction<ReseedInfo | null>>;
  streakMultiplierRef: MutableRefObject<number>;
  swarmRef: MutableRefObject<any | null>;
  syncWeaponEvolutionStates: () => void;
  targetSettingsRef: MutableRefObject<{
    sizeMultiplier: number;
    speedMultiplier: number;
  }>;
  vfxRef: MutableRefObject<VfxEngine | null>;
}

export function setupBugCanvasRenderLoop({
  animatedStateRef,
  blackHoleVfxIdRef,
  boundsRef,
  canvas,
  canvasRef,
  chartFocusRef,
  currentMouseRef,
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
}: BugCanvasRenderLoopOptions) {
  const currentVfx = vfxRef.current;
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

    if (swarmRef.current && !gamePausedRef.current) {
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
      const cursorTarget = getInteractiveCursorTarget(
        boundsRef.current,
        hammerPositionRef,
      );
      for (let step = 0; step < steps; step += 1) {
        if ((swarmRef.current as any).update.length >= 1) {
          (swarmRef.current as any).update(
            1 / 60,
            cursorTarget?.targetX ?? null,
            cursorTarget?.targetY ?? null,
          );
        } else {
          (swarmRef.current as any).update();
        }
      }
    }

    context.clearRect(0, 0, width, height);

    if (!width || !height) {
      width = canvas.clientWidth || boundsRef.current.width || 800;
      height = canvas.clientHeight || boundsRef.current.height || 600;
    }
    const activeParticles = swarmRef.current
      ? swarmRef.current.getAllBugs()
      : [];
    const frameNow = performance.now();
    const drawStartedAt = performance.now();
    const nextBugPositions = drawBugFramePass({
      chartFocus: chartFocusRef.current,
      context,
      frameNow,
      height,
      interactiveMode: interactiveModeRef.current,
      motionProfile: motionProfileRef.current,
      particles: activeParticles,
      qaEnabled: isQaEnabled(),
      reusablePositions: latestBugPositionsRef.current,
      sizeMultiplier,
      width,
    });
    recordQaDurationSample("drawMs", performance.now() - drawStartedAt);
    latestBugPositionsRef.current = nextBugPositions;
    if (interactiveModeRef.current) {
      const liveBugCount = getActiveBugCount(activeParticles as Array<any>);
      if (lastReportedLiveBugCountRef.current !== liveBugCount) {
        lastReportedLiveBugCountRef.current = liveBugCount;
        onLiveBugCountChangeRef.current?.(liveBugCount);
      }
    } else {
      lastReportedLiveBugCountRef.current = null;
    }
    updateQaBugPositions(nextBugPositions, boundsRef.current);
    syncQaBugTelemetryFromEngine(swarmRef.current, boundsRef.current);
    recordQaFrameTiming(performance.now() - frameStart, nextBugPositions.length);

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
          if (blackHoleVfxIdRef.current && vfxRef.current) {
            vfxRef.current.destroyBlackHole(blackHoleVfxIdRef.current);
            blackHoleVfxIdRef.current = null;
          }
        },
      );
      const blackHoleId = blackHoleVfxIdRef.current;
      if (blackHoleId && vfxRef.current) {
        vfxRef.current.tickBlackHoleVfx(blackHoleId);
      }
    }

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

  const updateActivity = () => {
    isActive = !document.hidden && document.hasFocus();

    if (isActive && !animationFrameId) {
      animationFrameId = window.requestAnimationFrame(renderFrame);
    }
  };

  const handlePointerMove = (event: MouseEvent) => {
    currentMouseRef.current = { x: event.clientX, y: event.clientY };
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
  window.addEventListener("mousemove", handlePointerMove);
  window.addEventListener("mousedown", handleInteractivePointerDown);
  animationFrameId = window.requestAnimationFrame(renderFrame);

  return () => {
    resizeObserver.disconnect();
    document.removeEventListener("visibilitychange", updateActivity);
    window.removeEventListener("focus", updateActivity);
    window.removeEventListener("blur", updateActivity);
    window.removeEventListener("mousemove", handlePointerMove);
    window.removeEventListener("mousedown", handleInteractivePointerDown);
    if (blackHoleVfxIdRef.current && currentVfx) {
      currentVfx.destroyBlackHole(blackHoleVfxIdRef.current);
      blackHoleVfxIdRef.current = null;
    }
    if (animationFrameId) {
      window.cancelAnimationFrame(animationFrameId);
    }
  };
}