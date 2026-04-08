import type { CSSProperties } from "react";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BUG_VARIANT_CONFIG,
  getBugCountsKey,
  getBugTotal,
  getBugVariantMaxHp,
} from "../constants/bugs";
import Engine from "../engine/Engine";

// feature flag to toggle the new engine for homepage background only
const ENABLE_ENTITY_ENGINE = true;
import {
  getEffectPalette,
  getMotionProfile,
  getSceneProfile,
} from "../utils/backgroundScene";
import { drawBugSprite } from "../utils/bugSprite";
import type {
  BugCounts,
  BugParticle,
  BugVariant,
  BugVisualSettings,
  ChartFocusState,
  MotionProfile,
  SceneProfile,
  Tone,
} from "../types/dashboard";

const TARGET_FRAME_MS = 1000 / 24;
const TRANSITION_EASING = 0.08;

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

interface BugHitPayload {
  defeated: boolean;
  remainingHp: number;
  variant: BugVariant;
  x: number;
  y: number;
}

interface RenderedBugPosition {
  index: number;
  radius: number;
  x: number;
  y: number;
}

interface GameState {
  remainingTargets: number;
  sessionKey: string;
  splats: Array<{ id: string; variant: BugVariant; x: number; y: number }>;
}

function getSplatClassName(variant: BugVariant) {
  if (variant === "urgent") {
    return "fixed z-[80] h-12 w-12 -translate-x-1/2 -translate-y-1/2 rounded-[36%] bg-[radial-gradient(circle_at_35%_35%,rgba(255,200,200,0.26),transparent_18%),radial-gradient(circle_at_center,rgba(185,28,28,0.95),rgba(120,14,14,0.28)_68%,transparent_74%)] [animation:bug-splat_520ms_ease-out_forwards] pointer-events-none";
  }

  if (variant === "high") {
    return "fixed z-[80] h-10 w-10 -translate-x-1/2 -translate-y-1/2 rounded-[40%] bg-[radial-gradient(circle_at_38%_36%,rgba(255,180,160,0.22),transparent_18%),radial-gradient(circle_at_center,rgba(244,63,94,0.9),rgba(153,27,27,0.2)_68%,transparent_74%)] [animation:bug-splat_480ms_ease-out_forwards] pointer-events-none";
  }

  if (variant === "medium") {
    return "fixed z-[80] h-9 w-9 -translate-x-1/2 -translate-y-1/2 rounded-[45%] bg-[radial-gradient(circle_at_42%_38%,rgba(255,230,200,0.22),transparent_18%),radial-gradient(circle_at_center,rgba(250,130,100,0.86),rgba(160,40,30,0.16)_70%,transparent_76%)] [animation:bug-splat_440ms_ease-out_forwards] pointer-events-none";
  }

  return "fixed z-[80] h-7 w-7 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle_at_40%_40%,rgba(255,255,255,0.2),transparent_20%),radial-gradient(circle_at_center,rgba(248,113,113,0.82),rgba(185,28,28,0.14)_70%,transparent_75%)] [animation:bug-splat_420ms_ease-out_forwards] pointer-events-none";
}

interface BugCanvasProps {
  bugVisualSettings: BugVisualSettings;
  chartFocus: ChartFocusState | null;
  motionProfile: MotionProfile;
  onHit: (payload: BugHitPayload) => void;
  bugCounts: BugCounts;
  sceneProfile: SceneProfile;
  sessionKey: string;
  terminatorMode: boolean;
  onEntityDeath?: (x: number, y: number, variant: string) => void;
  cursorPosition?: { x: number; y: number } | null;
}

const BugCanvas = memo(function BugCanvas({
  bugVisualSettings,
  chartFocus,
  motionProfile,
  onHit,
  bugCounts,
  sceneProfile,
  sessionKey,
  terminatorMode,
  onEntityDeath,
  cursorPosition,
}: BugCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const swarmRef = useRef<any | null>(null);
  const motionProfileRef = useRef(motionProfile);
  const sceneProfileRef = useRef(sceneProfile);
  const chartFocusRef = useRef(chartFocus);
  const boundsRef = useRef({ height: 0, left: 0, top: 0, width: 0 });
  const latestBugPositionsRef = useRef<RenderedBugPosition[]>([]);
  const deadBugIndexesRef = useRef<Set<number>>(new Set());
  const hitPointsRef = useRef<Map<number, number>>(new Map());
  const targetSettingsRef = useRef({
    sizeMultiplier: bugVisualSettings?.sizeMultiplier ?? 1,
    speedMultiplier: Math.max(0.2, bugVisualSettings?.chaosMultiplier ?? 1),
  });
  const animatedStateRef = useRef({
    sizeMultiplier: bugVisualSettings?.sizeMultiplier ?? 1,
    speedMultiplier: Math.max(0.2, bugVisualSettings?.chaosMultiplier ?? 1),
  });
  const [reseedInfo, setReseedInfo] = useState<{
    ts: number;
    clustered: number;
    total: number;
  } | null>(null);

  useEffect(() => {
    // when incoming counts change, recreate swarm to match new counts
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
        onEntityDeath: (x, y, variant) => {
          try {
            onEntityDeath?.(
              Math.round(x + (boundsRef.current.left || 0)),
              Math.round(y + (boundsRef.current.top || 0)),
              variant,
            );
          } catch {
            void 0;
          }
        },
      });
      engine.spawnFromCounts(bugCounts as any);
      swarmRef.current = engine;
    }
    // if many bugs were seeded at (0,0) (canvas not measured yet), reseed
    const maybeBugs = swarmRef.current.getAllBugs();
    const clustered = maybeBugs.filter((b) => b.x <= 1 && b.y <= 1).length;
    if (clustered > 0 && clustered / Math.max(1, maybeBugs.length) > 0.25) {
      for (const b of maybeBugs) {
        b.x = Math.random() * w;
        b.y = Math.random() * h;
        const speed = 0.6 + Math.random() * 1.4;
        const angle = Math.random() * Math.PI * 2;
        b.vx = Math.cos(angle) * speed;
        b.vy = Math.sin(angle) * speed;
      }
      setReseedInfo({ ts: Date.now(), clustered, total: maybeBugs.length });
    }
    deadBugIndexesRef.current = new Set();
    const bugs = swarmRef.current.getAllBugs();
    hitPointsRef.current = new Map(
      bugs.map((b, i) => [i, getBugVariantMaxHp(b.variant)]),
    );
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
  }, [bugCounts, onEntityDeath]);

  useEffect(() => {
    deadBugIndexesRef.current = new Set();
    const bugs = swarmRef.current?.getAllBugs() ?? [];
    hitPointsRef.current = new Map(
      bugs.map((b, i) => [i, getBugVariantMaxHp(b.variant)]),
    );
  }, [sessionKey]);

  useEffect(() => {
    motionProfileRef.current = motionProfile;
  }, [motionProfile]);

  useEffect(() => {
    sceneProfileRef.current = sceneProfile;
  }, [sceneProfile]);

  useEffect(() => {
    chartFocusRef.current = chartFocus;
  }, [chartFocus]);

  useEffect(() => {
    targetSettingsRef.current = {
      sizeMultiplier: bugVisualSettings?.sizeMultiplier ?? 1,
      speedMultiplier: Math.max(0.2, bugVisualSettings?.chaosMultiplier ?? 1),
    };
  }, [bugVisualSettings]);

  useEffect(() => {
    if (!terminatorMode) {
      deadBugIndexesRef.current = new Set();
    }
  }, [terminatorMode]);

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
      const nextWidth = canvas.clientWidth;
      const nextHeight = canvas.clientHeight;
      const devicePixelRatio = window.devicePixelRatio || 1;

      if (!nextWidth || !nextHeight) {
        return;
      }

      width = nextWidth;
      height = nextHeight;
      boundsRef.current = {
        height: nextHeight,
        left: canvas.getBoundingClientRect().left,
        top: canvas.getBoundingClientRect().top,
        width: nextWidth,
      };
      canvas.width = Math.floor(nextWidth * devicePixelRatio);
      canvas.height = Math.floor(nextHeight * devicePixelRatio);
      context.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
      context.clearRect(0, 0, width, height);

      // update swarm size to current canvas and reseed if many bugs clustered at 0,0
      if (swarmRef.current) {
        swarmRef.current.width = nextWidth;
        swarmRef.current.height = nextHeight;
        const bugs = swarmRef.current.getAllBugs();
        const clustered = bugs.filter((b) => b.x <= 1 && b.y <= 1).length;
        if (clustered > 0 && clustered / Math.max(1, bugs.length) > 0.2) {
          // reseed positions and velocities
          for (const b of bugs) {
            b.x = Math.random() * nextWidth;
            b.y = Math.random() * nextHeight;
            const speed = 0.6 + Math.random() * 1.4;
            const angle = Math.random() * Math.PI * 2;
            b.vx = Math.cos(angle) * speed;
            b.vy = Math.sin(angle) * speed;
          }
          // lightweight debug log to help diagnose in dev

          console.debug("Engine reseeded on resize", {
            nextWidth,
            nextHeight,
            clustered,
            total: bugs.length,
          });
          setReseedInfo({ ts: Date.now(), clustered, total: bugs.length });
        }
      }
    };

    const updateActivity = () => {
      isActive = !document.hidden && document.hasFocus();
      if (isActive && !animationFrameId) {
        animationFrameId = window.requestAnimationFrame(renderFrame);
      }
    };

    // cursor is forwarded to the engine during update calls below

    const renderFrame = (timestamp: number) => {
      animationFrameId = 0;

      if (!isActive) {
        return;
      }

      if (timestamp - lastDrawTime < TARGET_FRAME_MS) {
        animationFrameId = window.requestAnimationFrame(renderFrame);
        return;
      }

      const dtSec = Math.min(0.12, (timestamp - lastDrawTime) / 1000);
      lastDrawTime = timestamp;
      // advance engine or swarm according to elapsed time to create continuous motion
      if (swarmRef.current) {
        const steps = Math.max(1, Math.floor(dtSec * 60));
        for (let s = 0; s < steps; s++) {
          if ((swarmRef.current as any).update.length >= 1) {
            // Engine.update expects dt and optional target
            const targetX =
              terminatorMode && cursorPosition
                ? cursorPosition.x - boundsRef.current.left
                : null;
            const targetY =
              terminatorMode && cursorPosition
                ? cursorPosition.y - boundsRef.current.top
                : null;
            (swarmRef.current as any).update(1 / 60, targetX, targetY);
          } else {
            (swarmRef.current as any).update();
          }
        }
      }
      context.clearRect(0, 0, width, height);

      const timeSeconds = timestamp / 1000;
      // ensure width/height are valid before math that divides by them
      if (!width || !height) {
        width = canvas.clientWidth || boundsRef.current.width || 800;
        height = canvas.clientHeight || boundsRef.current.height || 600;
      }
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
      const activeParticles = swarmRef.current
        ? swarmRef.current.getAllBugs()
        : [];
      const activeMotionProfile = motionProfileRef.current;
      const activeSceneProfile = sceneProfileRef.current;
      const activeChartFocus = chartFocusRef.current;
      const deadBugIndexes = deadBugIndexesRef.current;
      const focusX = activeChartFocus?.relativeIndex ?? 0.5;
      const focusStrength = activeChartFocus
        ? activeSceneProfile.chartFocusStrength
        : 0;
      const clusterCenterX = 0.5;
      const clusterCenterY = 0.48;
      latestBugPositionsRef.current = [];

      for (let index = 0; index < activeParticles.length; index += 1) {
        if (deadBugIndexes.has(index)) {
          continue;
        }

        const particle = activeParticles[index];
        const phase = (particle as any).phase ?? 0;
        const swayPhase = (particle as any).swayPhase ?? 0;
        const particleDuration = (particle as any).duration ?? 10;
        const particleDelay = (particle as any).delay ?? 0;
        const cycleDuration = Math.max(
          4,
          (particleDuration * activeMotionProfile.durationMultiplier) /
            speedMultiplier,
        );
        const cycleProgress =
          ((timeSeconds + particleDelay) % cycleDuration) / cycleDuration;
        const t = cycleProgress * Math.PI * 2;
        // combine long + short wavelength components for organic drift
        const longDrift = Math.sin(t + phase);
        const shortDrift = Math.sin(t * 2 + phase * 0.7);
        const driftWave = longDrift * 0.66 + shortDrift * 0.34;
        const longSway = Math.cos(t * 1.1 + swayPhase);
        const shortSway = Math.cos(t * 2.2 + swayPhase * 0.9);
        const swayWave = longSway * 0.7 + shortSway * 0.3;
        // particle.x/y are pixel positions from the entity engine
        const normalizedX = particle.x / width;
        const normalizedY = particle.y / height;
        const variantConfig = BUG_VARIANT_CONFIG[particle.variant];
        const variantBob =
          Math.sin(t * variantConfig.bobFrequency + index * 0.12 + phase) *
          variantConfig.bobAmplitude *
          0.9;
        const variantSway =
          Math.cos(t * variantConfig.swayFrequency + index * 0.16 + swayPhase) *
          variantConfig.swayAmplitude *
          0.9;
        const clusterShiftX =
          (clusterCenterX - normalizedX) *
          width *
          activeSceneProfile.clusterStrength *
          0.22;
        const clusterShiftY =
          (clusterCenterY - normalizedY) *
          height *
          activeSceneProfile.clusterStrength *
          0.12;
        const focusDistance = Math.abs(normalizedX - focusX);
        const focusFalloff = activeChartFocus
          ? Math.max(0, 1 - focusDistance * 3.1)
          : 0;
        const chartShiftX = activeChartFocus
          ? (focusX - normalizedX) * width * focusStrength * focusFalloff * 0.2
          : 0;
        const x =
          particle.x +
          clusterShiftX +
          chartShiftX +
          (driftWave * 0.7 + Math.sin(t * 0.37 + phase) * 0.3) *
            (particle.vx ?? particle.driftX ?? 1) *
            speedMultiplier +
          variantBob;
        const y =
          particle.y +
          clusterShiftY +
          (swayWave * 0.72 + Math.cos(t * 0.5 + swayPhase) * 0.28) *
            (particle.vy ?? particle.driftY ?? 1) *
            speedMultiplier +
          variantSway;
        // Use fixed opacity from particle profile + motion multiplier. Remove
        // per-frame sinusoidal modulation so SVGs don't flicker in opacity.
        const opacity = clampNumber(
          (particle.opacity ?? 1) * activeMotionProfile.opacityMultiplier,
          0.06,
          1,
        );
        const size =
          particle.size *
          activeMotionProfile.scale *
          sizeMultiplier *
          (activeChartFocus ? 0.92 + focusFalloff * 0.26 : 1);
        // Make bugs face their movement direction (crawling forward). Add a
        // small sway on top of the heading for organic motion.
        const velX = particle.vx ?? particle.driftX ?? 1;
        const velY = particle.vy ?? particle.driftY ?? 0;
        const heading = Math.atan2(velY, velX);
        const sway = Math.sin(t * 2 + phase) * 0.12;
        const rotation = heading + sway;

        latestBugPositionsRef.current.push({
          index,
          radius: Math.max(size * 0.7, 12),
          x,
          y,
        });

        drawBugSprite(context, {
          opacity,
          rotation,
          size,
          variant: particle.variant,
          x,
          y,
        });
      }

      // one-time safety reseed: if many bugs still sit at 0,0, reseed and surface badge
      if (!reseedInfo && swarmRef.current) {
        const bugs = swarmRef.current.getAllBugs();
        const clustered = bugs.filter((b) => b.x <= 1 && b.y <= 1).length;
        if (clustered > 0 && clustered / Math.max(1, bugs.length) > 0.2) {
          for (const b of bugs) {
            b.x = Math.random() * width;
            b.y = Math.random() * height;
            const speed = 0.6 + Math.random() * 1.4;
            const angle = Math.random() * Math.PI * 2;
            b.vx = Math.cos(angle) * speed;
            b.vy = Math.sin(angle) * speed;
          }
          setReseedInfo({ ts: Date.now(), clustered, total: bugs.length });
        }
      }

      animationFrameId = window.requestAnimationFrame(renderFrame);
    };

    resizeCanvas();

    const resizeObserver = new ResizeObserver(() => {
      resizeCanvas();
    });
    resizeObserver.observe(canvas);

    const handlePointerDown = (event: MouseEvent) => {
      if (!terminatorMode) {
        return;
      }

      const targetElement =
        event.target instanceof Element ? event.target : null;
      if (
        targetElement?.closest(
          "button, a, input, select, textarea, label, summary",
        )
      ) {
        return;
      }

      const bounds = boundsRef.current;
      if (!bounds.width || !bounds.height) {
        return;
      }

      const clickX = event.clientX - bounds.left;
      const clickY = event.clientY - bounds.top;
      let hitCandidate: { distance: number; index: number } | null = null;

      for (const bugPosition of latestBugPositionsRef.current) {
        const distance = Math.hypot(
          clickX - bugPosition.x,
          clickY - bugPosition.y,
        );
        if (
          distance <= bugPosition.radius &&
          (!hitCandidate || distance < hitCandidate.distance)
        ) {
          hitCandidate = { distance, index: bugPosition.index };
        }
      }

      if (hitCandidate) {
        if (deadBugIndexesRef.current.has(hitCandidate.index)) {
          return;
        }

        const particle = swarmRef.current?.getAllBugs()[hitCandidate.index];
        if (!particle) {
          return;
        }

        // If the engine supports handleHit, use it so Enemy manages HP/state
        if (typeof swarmRef.current?.handleHit === "function") {
          const result = swarmRef.current.handleHit(hitCandidate.index, 1);
          if (result) {
            if (result.defeated) {
              deadBugIndexesRef.current.add(hitCandidate.index);
            }

            onHit({
              defeated: result.defeated,
              remainingHp: result.remainingHp,
              variant: result.variant,
              x: event.clientX,
              y: event.clientY,
            });
            return;
          }
        }

        // Fallback to previous local HP tracking
        const currentHp =
          hitPointsRef.current.get(hitCandidate.index) ??
          getBugVariantMaxHp(particle.variant);
        const remainingHp = Math.max(0, currentHp - 1);
        hitPointsRef.current.set(hitCandidate.index, remainingHp);
        const defeated = remainingHp === 0;

        if (defeated) {
          deadBugIndexesRef.current.add(hitCandidate.index);
        }

        onHit({
          defeated,
          remainingHp,
          variant: particle.variant,
          x: event.clientX,
          y: event.clientY,
        });
      }
    };

    document.addEventListener("visibilitychange", updateActivity);
    window.addEventListener("focus", updateActivity);
    window.addEventListener("blur", updateActivity);
    window.addEventListener("mousedown", handlePointerDown);
    animationFrameId = window.requestAnimationFrame(renderFrame);

    return () => {
      resizeObserver.disconnect();
      document.removeEventListener("visibilitychange", updateActivity);
      window.removeEventListener("focus", updateActivity);
      window.removeEventListener("blur", updateActivity);
      window.removeEventListener("mousedown", handlePointerDown);
      if (animationFrameId) {
        window.cancelAnimationFrame(animationFrameId);
      }
    };
  }, [onHit, terminatorMode, cursorPosition, reseedInfo]);

  return (
    <>
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full opacity-96"
        aria-hidden="true"
      />
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

// Fireflies removed — keep only bug rendering. Palette still provided via getEffectPalette.

interface BackgroundFieldProps {
  bugCounts: BugCounts;
  bugVisualSettings: BugVisualSettings;
  chartFocus: ChartFocusState | null;
  interactiveSessionKey?: string | null;
  milestoneFlash: { threshold: number; token: number } | null;
  onTerminatorHit?: (payload: BugHitPayload) => void;
  remainingBugCount?: number;
  showParticleCount: boolean;
  showTerminatorStatusBadge?: boolean;
  terminatorMode: boolean;
  tone: Tone;
}

const BackgroundField = memo(function BackgroundField({
  bugCounts,
  bugVisualSettings,
  chartFocus,
  interactiveSessionKey = null,
  milestoneFlash,
  onTerminatorHit,
  remainingBugCount,
  showParticleCount,
  showTerminatorStatusBadge = true,
  terminatorMode,
  tone,
}: BackgroundFieldProps) {
  const normalizedBugCounts = useMemo(() => bugCounts, [bugCounts]);
  const totalBugCount = useMemo(
    () => getBugTotal(normalizedBugCounts),
    [normalizedBugCounts],
  );
  const effectiveBugCount = Math.max(
    0,
    Math.floor(remainingBugCount ?? totalBugCount),
  );
  const visualTone = effectiveBugCount === 0 ? "all-clear" : tone;
  const colors = useMemo(() => getEffectPalette(visualTone), [visualTone]);
  // particles are produced and managed by BugCanvas's internal entity engine
  const motionProfile = useMemo(
    () => getMotionProfile(visualTone),
    [visualTone],
  );
  const sceneProfile = useMemo(() => getSceneProfile(visualTone), [visualTone]);
  const bugCountsKey = useMemo(
    () => getBugCountsKey(normalizedBugCounts),
    [normalizedBugCounts],
  );
  const gameSessionKey = interactiveSessionKey
    ? `interactive:${interactiveSessionKey}`
    : `${terminatorMode ? "terminator" : "ambient"}:${bugCountsKey}`;
  const [hammerPosition, setHammerPosition] = useState({ x: 0, y: 0 });
  const [hammerSwing, setHammerSwing] = useState(false);

  const [gameState, setGameState] = useState<GameState>(() => ({
    remainingTargets: totalBugCount,
    sessionKey: gameSessionKey,
    splats: [],
  }));
  const activeGameState =
    gameState.sessionKey === gameSessionKey
      ? gameState
      : {
          remainingTargets: totalBugCount,
          sessionKey: gameSessionKey,
          splats: [],
        };

  useEffect(() => {
    document.body.classList.toggle("cursor-none", terminatorMode);

    return () => {
      document.body.classList.remove("cursor-none");
    };
  }, [terminatorMode]);

  useEffect(() => {
    if (!terminatorMode) {
      return undefined;
    }

    const handlePointerMove = (event: globalThis.MouseEvent) => {
      const x = event.clientX;
      const y = event.clientY;
      setHammerPosition({ x, y });
    };

    window.addEventListener("mousemove", handlePointerMove);
    return () => {
      window.removeEventListener("mousemove", handlePointerMove);
    };
  }, [terminatorMode]);

  useEffect(() => {
    if (!hammerSwing) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setHammerSwing(false);
    }, 180);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [hammerSwing]);

  useEffect(() => {
    if (activeGameState.splats.length === 0) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setGameState((currentValue) => {
        if (
          currentValue.sessionKey !== gameSessionKey ||
          currentValue.splats.length <= 3
        ) {
          return currentValue;
        }

        return {
          ...currentValue,
          splats: currentValue.splats.slice(-3),
        };
      });
    }, 420);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [activeGameState.splats.length, gameSessionKey]);

  const handleBugHit = useCallback(
    (payload: BugHitPayload) => {
      setHammerSwing(true);
      onTerminatorHit?.(payload);
      setGameState((currentValue) => {
        const nextState =
          currentValue.sessionKey === gameSessionKey
            ? currentValue
            : {
                remainingTargets: totalBugCount,
                sessionKey: gameSessionKey,
                splats: [],
              };

        return {
          remainingTargets: Math.max(0, nextState.remainingTargets - 1),
          sessionKey: gameSessionKey,
          splats: [
            ...nextState.splats.slice(-5),
            {
              id: `${payload.x}-${payload.y}-${Date.now()}`,
              variant: payload.variant,
              x: payload.x,
              y: payload.y,
            },
          ],
        };
      });
    },
    [gameSessionKey, onTerminatorHit, totalBugCount],
  );

  const overlayLabel = terminatorMode
    ? activeGameState.remainingTargets === 0
      ? "Target neutralized"
      : `${activeGameState.remainingTargets} targets left`
    : `${totalBugCount} bugs rendered`;

  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden"
      aria-hidden="true"
    >
      <div
        className="absolute left-[-10rem] top-[8rem] h-72 w-72 rounded-full blur-3xl"
        style={{ backgroundColor: colors.orbA }}
      />
      <div
        className="absolute right-[-8rem] top-[24rem] h-80 w-80 rounded-full blur-3xl"
        style={{ backgroundColor: colors.orbB }}
      />
      <div
        className="absolute bottom-[-8rem] left-[18%] h-72 w-72 rounded-full blur-3xl"
        style={{ backgroundColor: colors.orbB }}
      />

      {milestoneFlash ? (
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.12),transparent_16%),radial-gradient(circle_at_center,rgba(56,189,248,0.18),transparent_42%),radial-gradient(circle_at_center,rgba(16,185,129,0.14),transparent_62%)] [animation:milestone-burst_1.8s_ease-out_forwards]" />
      ) : null}
      {chartFocus ? (
        <div
          className="absolute inset-y-0 w-48 -translate-x-1/2 blur-3xl opacity-[0.22]"
          style={{
            left: `${(chartFocus.relativeIndex ?? 0.5) * 100}%`,
            background: colors.orbA,
          }}
        />
      ) : null}
      <BugCanvas
        bugVisualSettings={bugVisualSettings}
        chartFocus={chartFocus}
        motionProfile={motionProfile}
        onHit={handleBugHit}
        bugCounts={normalizedBugCounts}
        sceneProfile={sceneProfile}
        sessionKey={gameSessionKey}
        terminatorMode={terminatorMode}
        cursorPosition={terminatorMode ? hammerPosition : null}
        onEntityDeath={(x, y, variant) => {
          setGameState((currentValue) => {
            const nextState =
              currentValue.sessionKey === gameSessionKey
                ? currentValue
                : {
                    remainingTargets: totalBugCount,
                    sessionKey: gameSessionKey,
                    splats: [],
                  };
            return {
              ...nextState,
              splats: [
                ...nextState.splats.slice(-5),
                {
                  id: `${x}-${y}-${Date.now()}`,
                  variant: variant as any,
                  x,
                  y,
                },
              ],
            };
          });
        }}
      />
      {effectiveBugCount === 0 ? (
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(187,247,208,0.12),transparent_28%),radial-gradient(circle_at_60%_68%,rgba(125,211,252,0.08),transparent_34%)] [animation:all-clear-breathe_6s_ease-in-out_infinite]" />
      ) : null}
      {terminatorMode ? (
        <div
          className={`pointer-events-none fixed left-0 top-0 z-[90] [transform-origin:18px_14px] ${hammerSwing ? "[&>span]:animate-[hammer-swing_180ms_ease-out]" : ""}`}
          style={{
            transform: `translate3d(${hammerPosition.x}px, ${hammerPosition.y}px, 0)`,
          }}
        >
          <span className="inline-flex text-[1.9rem] [filter:drop-shadow(0_8px_18px_rgba(0,0,0,0.35))] [transform:translate3d(-6px,-6px,0)]">
            🔨
          </span>
        </div>
      ) : null}
      {activeGameState.splats.map((splat) => (
        <div
          key={splat.id}
          className={getSplatClassName(splat.variant)}
          style={{ left: `${splat.x}px`, top: `${splat.y}px` }}
        />
      ))}
      {showParticleCount || (terminatorMode && showTerminatorStatusBadge) ? (
        <div className="absolute bottom-5 right-5 rounded-full border border-white/8 bg-black/35 px-3 py-1.5 text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-stone-300 backdrop-blur-xl">
          {overlayLabel}
        </div>
      ) : null}
    </div>
  );
});

export default BackgroundField;
