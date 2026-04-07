import type { CSSProperties } from "react";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createBugParticles,
  createFireflyParticles,
  getEffectPalette,
  getMotionProfile,
  getSceneProfile,
} from "../utils/backgroundEffects";
import type {
  BugParticle,
  BugVisualSettings,
  ChartFocusState,
  FireflyParticle,
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

function drawBug(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  opacity: number,
  rotation: number,
  color: string,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.scale(size / 24, size / 24);
  ctx.globalAlpha = opacity;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 1.4;
  ctx.lineCap = "round";

  ctx.beginPath();
  ctx.moveTo(-3.5, -4.8);
  ctx.lineTo(-7.5, -7.2);
  ctx.moveTo(3.5, -4.8);
  ctx.lineTo(7.5, -7.2);
  ctx.moveTo(-4.2, -0.8);
  ctx.lineTo(-8.2, -0.8);
  ctx.moveTo(4.2, -0.8);
  ctx.lineTo(8.2, -0.8);
  ctx.moveTo(-4.4, 3.1);
  ctx.lineTo(-8, 5.3);
  ctx.moveTo(4.4, 3.1);
  ctx.lineTo(8, 5.3);
  ctx.moveTo(-1.7, 7.7);
  ctx.lineTo(-3.2, 10.2);
  ctx.moveTo(1.7, 7.7);
  ctx.lineTo(3.2, 10.2);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(0, -7.4, 2.4, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.ellipse(0, 1.8, 4.4, 7.1, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

interface BugHitPayload {
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
  splats: Array<{ id: string; x: number; y: number }>;
}

type FireflyStyle = CSSProperties &
  Record<
    | "--firefly-color"
    | "--firefly-delay"
    | "--firefly-drift-x"
    | "--firefly-duration"
    | "--firefly-size"
    | "--firefly-x"
    | "--firefly-y",
    string
  >;

interface BugCanvasProps {
  bugColor: string;
  bugVisualSettings: BugVisualSettings;
  chartFocus: ChartFocusState | null;
  motionProfile: MotionProfile;
  onHit: (payload: BugHitPayload) => void;
  particles: BugParticle[];
  sceneProfile: SceneProfile;
  terminatorMode: boolean;
}

const BugCanvas = memo(function BugCanvas({
  bugColor,
  bugVisualSettings,
  chartFocus,
  motionProfile,
  onHit,
  particles,
  sceneProfile,
  terminatorMode,
}: BugCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const particlesRef = useRef(particles);
  const motionProfileRef = useRef(motionProfile);
  const sceneProfileRef = useRef(sceneProfile);
  const chartFocusRef = useRef(chartFocus);
  const bugColorRef = useRef(bugColor);
  const boundsRef = useRef({ height: 0, left: 0, top: 0, width: 0 });
  const latestBugPositionsRef = useRef<RenderedBugPosition[]>([]);
  const deadBugIndexesRef = useRef<Set<number>>(new Set());
  const targetSettingsRef = useRef({
    sizeMultiplier: bugVisualSettings?.sizeMultiplier ?? 1,
    speedMultiplier: Math.max(0.2, bugVisualSettings?.chaosMultiplier ?? 1),
  });
  const animatedStateRef = useRef({
    sizeMultiplier: bugVisualSettings?.sizeMultiplier ?? 1,
    speedMultiplier: Math.max(0.2, bugVisualSettings?.chaosMultiplier ?? 1),
  });

  useEffect(() => {
    particlesRef.current = particles;
    deadBugIndexesRef.current = new Set();
  }, [particles]);

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
    bugColorRef.current = bugColor;
  }, [bugColor]);

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
    };

    const updateActivity = () => {
      isActive = !document.hidden && document.hasFocus();
      if (isActive && !animationFrameId) {
        animationFrameId = window.requestAnimationFrame(renderFrame);
      }
    };

    const renderFrame = (timestamp: number) => {
      animationFrameId = 0;

      if (!isActive) {
        return;
      }

      if (timestamp - lastDrawTime < TARGET_FRAME_MS) {
        animationFrameId = window.requestAnimationFrame(renderFrame);
        return;
      }

      lastDrawTime = timestamp;
      context.clearRect(0, 0, width, height);

      const timeSeconds = timestamp / 1000;
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
      const activeParticles = particlesRef.current;
      const activeMotionProfile = motionProfileRef.current;
      const activeSceneProfile = sceneProfileRef.current;
      const activeChartFocus = chartFocusRef.current;
      const activeBugColor = bugColorRef.current;
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
        const cycleDuration = Math.max(
          4,
          (particle.duration * activeMotionProfile.durationMultiplier) /
            speedMultiplier,
        );
        const cycleProgress =
          ((timeSeconds + particle.delay) % cycleDuration) / cycleDuration;
        const driftWave = Math.sin(cycleProgress * Math.PI * 2);
        const swayWave = Math.cos(cycleProgress * Math.PI * 2 * 1.35);
        const normalizedX = particle.x / 100;
        const normalizedY = particle.y / 100;
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
          normalizedX * width +
          clusterShiftX +
          chartShiftX +
          driftWave * particle.driftX * speedMultiplier;
        const y =
          normalizedY * height +
          clusterShiftY +
          swayWave * particle.driftY * speedMultiplier;
        const opacity = Math.max(
          0.08,
          particle.opacity *
            activeMotionProfile.opacityMultiplier *
            (0.76 +
              0.32 * Math.sin(cycleProgress * Math.PI * 2 + index * 0.2)) *
            (activeChartFocus ? 0.72 + focusFalloff * 0.6 : 1),
        );
        const size =
          particle.size *
          activeMotionProfile.scale *
          sizeMultiplier *
          (activeChartFocus ? 0.92 + focusFalloff * 0.26 : 1);
        const rotation =
          Math.sin(cycleProgress * Math.PI * 4 + index * 0.12) * 0.22;

        latestBugPositionsRef.current.push({
          index,
          radius: Math.max(size * 0.7, 12),
          x,
          y,
        });

        drawBug(context, x, y, size, opacity, rotation, activeBugColor);
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

        deadBugIndexesRef.current.add(hitCandidate.index);
        onHit({ x: event.clientX, y: event.clientY });
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
  }, [onHit, terminatorMode]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 h-full w-full opacity-96"
      aria-hidden="true"
    />
  );
});

interface FirefliesProps {
  tone: "all-clear" | Tone;
}

const Fireflies = memo(function Fireflies({ tone }: FirefliesProps) {
  const particles = useMemo(() => createFireflyParticles(tone), [tone]);

  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden"
      aria-hidden="true"
    >
      {particles.map((particle, index) => (
        <span
          key={index}
          className="absolute rounded-full bg-[var(--firefly-color)] opacity-[0.55] shadow-[0_0_12px_var(--firefly-color),0_0_24px_color-mix(in_srgb,var(--firefly-color)_55%,transparent)] [animation:firefly-drift_var(--firefly-duration)_ease-in-out_infinite,firefly-pulse_3.2s_ease-in-out_infinite] [animation-delay:var(--firefly-delay),var(--firefly-delay)] [height:var(--firefly-size)] [left:var(--firefly-x)] [top:var(--firefly-y)] [width:var(--firefly-size)]"
          style={
            {
              "--firefly-x": particle.x,
              "--firefly-y": particle.y,
              "--firefly-size": particle.size,
              "--firefly-duration": particle.duration,
              "--firefly-delay": particle.delay,
              "--firefly-drift-x": particle.driftX,
              "--firefly-color": particle.color,
            } as FireflyStyle
          }
        />
      ))}
    </div>
  );
});

interface BackgroundFieldProps {
  bugCount: number;
  bugVisualSettings: BugVisualSettings;
  chartFocus: ChartFocusState | null;
  milestoneFlash: { threshold: number; token: number } | null;
  showParticleCount: boolean;
  terminatorMode: boolean;
  tone: Tone;
}

const BackgroundField = memo(function BackgroundField({
  bugCount,
  bugVisualSettings,
  chartFocus,
  milestoneFlash,
  showParticleCount,
  terminatorMode,
  tone,
}: BackgroundFieldProps) {
  const visualTone = bugCount === 0 ? "all-clear" : tone;
  const colors = useMemo(() => getEffectPalette(visualTone), [visualTone]);
  const particles = useMemo(() => createBugParticles(bugCount), [bugCount]);
  const motionProfile = useMemo(
    () => getMotionProfile(visualTone),
    [visualTone],
  );
  const sceneProfile = useMemo(() => getSceneProfile(visualTone), [visualTone]);
  const totalBugCount = Math.max(0, Math.floor(bugCount ?? 0));
  const gameSessionKey = `${terminatorMode ? "terminator" : "ambient"}:${totalBugCount}`;
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
      setHammerPosition({ x: event.clientX, y: event.clientY });
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
              x: payload.x,
              y: payload.y,
            },
          ],
        };
      });
    },
    [gameSessionKey, totalBugCount],
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
      <Fireflies tone={visualTone} />
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
        bugColor={colors.bug}
        bugVisualSettings={bugVisualSettings}
        chartFocus={chartFocus}
        motionProfile={motionProfile}
        onHit={handleBugHit}
        particles={particles}
        sceneProfile={sceneProfile}
        terminatorMode={terminatorMode}
      />
      {totalBugCount === 0 ? (
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
          className="fixed z-[80] h-7 w-7 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle_at_40%_40%,rgba(255,255,255,0.2),transparent_20%),radial-gradient(circle_at_center,rgba(248,113,113,0.82),rgba(185,28,28,0.14)_70%,transparent_75%)] [animation:bug-splat_420ms_ease-out_forwards] pointer-events-none"
          style={{ left: `${splat.x}px`, top: `${splat.y}px` }}
        />
      ))}
      {showParticleCount || terminatorMode ? (
        <div className="absolute bottom-5 right-5 rounded-full border border-white/8 bg-black/35 px-3 py-1.5 text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-stone-300 backdrop-blur-xl">
          {overlayLabel}
        </div>
      ) : null}
    </div>
  );
});

export default BackgroundField;
