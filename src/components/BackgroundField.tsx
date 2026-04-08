import type { CSSProperties } from "react";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  getBugCountsKey,
  getBugTotal,
  getBugVariantMaxHp,
} from "../constants/bugs";
import Engine from "../engine/Engine";
import { getCodex } from "../engine/bugCodex";
import type { GameConfig } from "../engine/types";
import { DEFAULT_GAME_CONFIG } from "../engine/types";
import {
  getEffectPalette,
  getMotionProfile,
  getSceneProfile,
} from "../utils/backgroundScene";
import { cn } from "../utils/cn";
import { drawBugSprite } from "../utils/bugSprite";
import type {
  SiegeCombatStats,
  SiegeZoneRect,
} from "../features/background-game/types";
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

function getSpeedMultiplier(chaosMultiplier?: number) {
  return clampNumber(Math.sqrt(Math.max(0.2, chaosMultiplier ?? 1)), 0.45, 2.2);
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
  combatStats?: SiegeCombatStats | null;
  motionProfile: MotionProfile;
  onHit: (payload: BugHitPayload) => void;
  bugCounts: BugCounts;
  sceneProfile: SceneProfile;
  sessionKey: string;
  siegeZones?: SiegeZoneRect[];
  terminatorMode: boolean;
  onEntityDeath?: (x: number, y: number, variant: string) => void;
  gameConfig?: GameConfig;
}

const BugCanvas = memo(function BugCanvas({
  bugVisualSettings,
  chartFocus,
  combatStats,
  motionProfile,
  onHit,
  bugCounts,
  sceneProfile,
  sessionKey,
  siegeZones = [],
  terminatorMode,
  onEntityDeath,
  gameConfig,
}: BugCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const swarmRef = useRef<any | null>(null);
  const motionProfileRef = useRef(motionProfile);
  const sceneProfileRef = useRef(sceneProfile);
  const chartFocusRef = useRef(chartFocus);
  const combatStatsRef = useRef<SiegeCombatStats | null>(combatStats ?? null);
  const onHitRef = useRef(onHit);
  const reseedInfoRef = useRef<{
    ts: number;
    clustered: number;
    total: number;
  } | null>(null);
  const siegeZonesRef = useRef<SiegeZoneRect[]>(siegeZones);
  const boundsRef = useRef({ height: 0, left: 0, top: 0, width: 0 });
  const latestBugPositionsRef = useRef<RenderedBugPosition[]>([]);
  const deadBugIndexesRef = useRef<Set<number>>(new Set());
  const hitPointsRef = useRef<Map<number, number>>(new Map());
  const targetSettingsRef = useRef({
    sizeMultiplier: bugVisualSettings?.sizeMultiplier ?? 1,
    speedMultiplier: getSpeedMultiplier(bugVisualSettings?.chaosMultiplier),
  });
  const animatedStateRef = useRef({
    sizeMultiplier: bugVisualSettings?.sizeMultiplier ?? 1,
    speedMultiplier: getSpeedMultiplier(bugVisualSettings?.chaosMultiplier),
  });
  const [reseedInfo, setReseedInfo] = useState<{
    ts: number;
    clustered: number;
    total: number;
  } | null>(null);

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

  const triggerAutoHits = useCallback(
    (damage: number, volleyCount: number, preferZones: boolean) => {
      const engine = swarmRef.current;
      if (!engine || volleyCount <= 0) {
        return;
      }

      const localZones = getLocalSiegeZones();
      const candidates = latestBugPositionsRef.current
        .filter((position) => !deadBugIndexesRef.current.has(position.index))
        .map((position) => ({
          ...position,
          inZone: localZones.some(
            (zone) =>
              position.x >= zone.left &&
              position.x <= zone.left + zone.width &&
              position.y >= zone.top &&
              position.y <= zone.top + zone.height,
          ),
        }))
        .sort((leftCandidate, rightCandidate) => {
          if (leftCandidate.inZone !== rightCandidate.inZone) {
            return leftCandidate.inZone ? -1 : 1;
          }

          return leftCandidate.y - rightCandidate.y;
        });

      const orderedCandidates =
        preferZones && candidates.some((candidate) => candidate.inZone)
          ? candidates
          : candidates;

      for (const candidate of orderedCandidates.slice(0, volleyCount)) {
        const result = engine.handleHit(candidate.index, damage);
        if (!result) {
          continue;
        }

        if (result.defeated) {
          deadBugIndexesRef.current.add(candidate.index);
        }

        onHitRef.current({
          defeated: result.defeated,
          remainingHp: result.remainingHp,
          variant: result.variant,
          x: Math.round(candidate.x + boundsRef.current.left),
          y: Math.round(candidate.y + boundsRef.current.top),
        });
      }
    },
    [getLocalSiegeZones],
  );

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
        config: (gameConfig as any) ?? undefined,
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
      // store original baseSpeed so we can apply UI speedMultiplier without compounding
      try {
        (engine as any).__baseSpeedOriginal = engine.config.baseSpeed;
      } catch {
        // ignore in case shape differs
      }
      engine.spawnFromCounts(
        bugCounts as any,
        terminatorMode ? getLocalSiegeZones() : [],
      );
      swarmRef.current = engine;
    }
    // if many bugs were seeded at (0,0) (canvas not measured yet), reseed
    const maybeBugs = swarmRef.current.getAllBugs() as Array<any>;
    const clustered = maybeBugs.filter((b: any) => b.x <= 1 && b.y <= 1).length;
    if (clustered > 0 && clustered / Math.max(1, maybeBugs.length) > 0.25) {
      for (const b of maybeBugs) {
        b.x = Math.random() * w;
        b.y = Math.random() * h;
        const base =
          (swarmRef.current as any)?.__baseSpeedOriginal ??
          DEFAULT_GAME_CONFIG.baseSpeed;
        const speed =
          base *
          targetSettingsRef.current.speedMultiplier *
          (0.75 + Math.random() * 0.35);
        const angle = Math.random() * Math.PI * 2;
        b.vx = Math.cos(angle) * speed;
        b.vy = Math.sin(angle) * speed;
        b.heading = angle;
      }
      setReseedInfo({ ts: Date.now(), clustered, total: maybeBugs.length });
    }
    deadBugIndexesRef.current = new Set();
    const bugs = swarmRef.current.getAllBugs() as Array<any>;
    hitPointsRef.current = new Map(
      bugs.map((b: any, i: number) => [i, getBugVariantMaxHp(b.variant)]),
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
  }, [
    bugCounts,
    gameConfig,
    getLocalSiegeZones,
    onEntityDeath,
    terminatorMode,
  ]);

  useEffect(() => {
    deadBugIndexesRef.current = new Set();
    const bugs = (swarmRef.current?.getAllBugs() ?? []) as Array<any>;
    hitPointsRef.current = new Map(
      bugs.map((b: any, i: number) => [i, getBugVariantMaxHp(b.variant)]),
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
    onHitRef.current = onHit;
  }, [onHit]);

  useEffect(() => {
    combatStatsRef.current = combatStats ?? null;
  }, [combatStats]);

  useEffect(() => {
    reseedInfoRef.current = reseedInfo;
  }, [reseedInfo]);

  useEffect(() => {
    siegeZonesRef.current = siegeZones;
  }, [siegeZones]);

  useEffect(() => {
    targetSettingsRef.current = {
      sizeMultiplier: bugVisualSettings?.sizeMultiplier ?? 1,
      speedMultiplier: getSpeedMultiplier(bugVisualSettings?.chaosMultiplier),
    };
  }, [bugVisualSettings]);

  useEffect(() => {
    if (!terminatorMode) {
      deadBugIndexesRef.current = new Set();
    }
  }, [terminatorMode]);

  useEffect(() => {
    if (!terminatorMode) {
      return undefined;
    }

    const intervalIds: number[] = [];
    const initialStats = combatStatsRef.current;

    if (initialStats?.pulseUnlocked) {
      intervalIds.push(
        window.setInterval(() => {
          const nextStats = combatStatsRef.current;
          if (!nextStats?.pulseUnlocked) {
            return;
          }

          triggerAutoHits(
            nextStats.pulseDamage,
            nextStats.pulseVolleyCount,
            true,
          );
        }, initialStats.pulseInterval),
      );
    }

    if (initialStats?.laserUnlocked) {
      intervalIds.push(
        window.setInterval(() => {
          const nextStats = combatStatsRef.current;
          if (!nextStats?.laserUnlocked) {
            return;
          }

          triggerAutoHits(
            nextStats.laserDamage,
            nextStats.laserVolleyCount,
            false,
          );
        }, initialStats.laserInterval),
      );
    }

    return () => {
      for (const intervalId of intervalIds) {
        window.clearInterval(intervalId);
      }
    };
  }, [
    combatStats?.laserInterval,
    combatStats?.laserUnlocked,
    gameConfig,
    combatStats?.pulseInterval,
    combatStats?.pulseUnlocked,
    sessionKey,
    terminatorMode,
    triggerAutoHits,
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
        const bugs = swarmRef.current.getAllBugs() as Array<any>;
        const clustered = bugs.filter((b: any) => b.x <= 1 && b.y <= 1).length;
        if (clustered > 0 && clustered / Math.max(1, bugs.length) > 0.2) {
          // reseed positions and velocities
          for (const b of bugs) {
            b.x = Math.random() * nextWidth;
            b.y = Math.random() * nextHeight;
            const speed =
              DEFAULT_GAME_CONFIG.baseSpeed *
              targetSettingsRef.current.speedMultiplier *
              (0.75 + Math.random() * 0.35);
            const angle = Math.random() * Math.PI * 2;
            b.vx = Math.cos(angle) * speed;
            b.vy = Math.sin(angle) * speed;
            b.heading = angle;
          }
          // lightweight debug log to help diagnose in dev

          console.debug("Engine reseeded on resize", {
            nextWidth,
            nextHeight,
            clustered,
            total: bugs.length,
          });
          const nextReseedInfo = {
            ts: Date.now(),
            clustered,
            total: bugs.length,
          };
          reseedInfoRef.current = nextReseedInfo;
          setReseedInfo(nextReseedInfo);
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
        const steps = Math.max(1, Math.floor(dtSec * 60));
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
      const deadBugIndexes = deadBugIndexesRef.current;
      const focusX = activeChartFocus?.relativeIndex ?? 0.5;
      latestBugPositionsRef.current = [];

      for (let index = 0; index < activeParticles.length; index += 1) {
        if (deadBugIndexes.has(index)) {
          continue;
        }

        const particle = activeParticles[index];
        const normalizedX = particle.x / width;
        const focusDistance = Math.abs(normalizedX - focusX);
        const focusFalloff = activeChartFocus
          ? Math.max(0, 1 - focusDistance * 3.1)
          : 0;
        const x = particle.x;
        const y = particle.y;
        const opacity = clampNumber(
          (particle.opacity ?? 1) * activeMotionProfile.opacityMultiplier,
          0.06,
          1,
        );
        const size =
          particle.size *
          activeMotionProfile.scale *
          sizeMultiplier *
          (getCodex()[particle.variant as BugVariant]?.size ?? 1) *
          (activeChartFocus ? 0.92 + focusFalloff * 0.26 : 1);
        const velX = particle.vx ?? particle.driftX ?? 1;
        const velY = particle.vy ?? particle.driftY ?? 0;
        const rotation =
          typeof particle.heading === "number"
            ? particle.heading
            : Math.atan2(velY, velX);

        latestBugPositionsRef.current.push({
          index,
          radius: Math.max(size * 0.7, 12),
          x,
          y,
        });

        drawBugSprite(context, {
          color: getCodex()[particle.variant as BugVariant]?.color,
          opacity,
          rotation,
          size,
          variant: particle.variant,
          x,
          y,
        });
      }

      // one-time safety reseed: if many bugs still sit at 0,0, reseed and surface badge
      if (!reseedInfoRef.current && swarmRef.current) {
        const bugs = swarmRef.current.getAllBugs() as Array<any>;
        const clustered = bugs.filter((b: any) => b.x <= 1 && b.y <= 1).length;
        if (clustered > 0 && clustered / Math.max(1, bugs.length) > 0.2) {
          for (const b of bugs) {
            b.x = Math.random() * width;
            b.y = Math.random() * height;
            const base =
              (swarmRef.current as any)?.__baseSpeedOriginal ??
              DEFAULT_GAME_CONFIG.baseSpeed;
            const speed =
              base *
              targetSettingsRef.current.speedMultiplier *
              (0.75 + Math.random() * 0.35);
            const angle = Math.random() * Math.PI * 2;
            b.vx = Math.cos(angle) * speed;
            b.vy = Math.sin(angle) * speed;
            b.heading = angle;
          }
          const nextReseedInfo = {
            ts: Date.now(),
            clustered,
            total: bugs.length,
          };
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

    const handlePointerDown = (event: MouseEvent) => {
      if (!terminatorMode) {
        return;
      }

      const targetElement =
        event.target instanceof Element ? event.target : null;
      if (
        targetElement?.closest(
          "[data-no-hammer], button, a, input, select, textarea, label, summary",
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

      // Prefer engine-provided hitTest when available
      try {
        const engine = swarmRef.current;
        if (engine && typeof engine.hitTest === "function") {
          const res = engine.hitTest(clickX, clickY);
          if (res) {
            hitCandidate = { distance: res.distance, index: res.index };
          }
        }
      } catch {
        void 0;
      }

      // fallback: check last computed positions
      if (!hitCandidate) {
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

            onHitRef.current({
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

        onHitRef.current({
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
  }, [terminatorMode]);

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
  className?: string;
  combatStats?: SiegeCombatStats | null;
  interactiveSessionKey?: string | null;
  milestoneFlash: { threshold: number; token: number } | null;
  onTerminatorHit?: (payload: BugHitPayload) => void;
  remainingBugCount?: number;
  showParticleCount: boolean;
  showTerminatorStatusBadge?: boolean;
  siegeZones?: SiegeZoneRect[];
  terminatorMode: boolean;
  tone: Tone;
  gameConfig?: GameConfig;
}

const BackgroundField = memo(function BackgroundField({
  bugCounts,
  bugVisualSettings,
  chartFocus,
  className = "",
  combatStats = null,
  interactiveSessionKey = null,
  milestoneFlash,
  onTerminatorHit,
  remainingBugCount,
  showParticleCount,
  showTerminatorStatusBadge = true,
  siegeZones = [],
  terminatorMode,
  gameConfig,
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
  const hammerPositionRef = useRef({ x: 0, y: 0 });
  const hammerCursorRef = useRef<HTMLDivElement | null>(null);
  const hammerMoveFrameRef = useRef<number | null>(null);

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
      hammerPositionRef.current = { x: 0, y: 0 };
      if (hammerCursorRef.current) {
        hammerCursorRef.current.style.transform = "translate3d(0px, 0px, 0)";
      }
      return undefined;
    }

    const handlePointerMove = (event: globalThis.MouseEvent) => {
      hammerPositionRef.current = {
        x: event.clientX,
        y: event.clientY,
      };

      if (hammerMoveFrameRef.current != null) {
        return;
      }

      hammerMoveFrameRef.current = window.requestAnimationFrame(() => {
        hammerMoveFrameRef.current = null;
        const cursor = hammerCursorRef.current;
        if (!cursor) {
          return;
        }

        const { x, y } = hammerPositionRef.current;
        cursor.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      });
    };

    window.addEventListener("mousemove", handlePointerMove);
    return () => {
      if (hammerMoveFrameRef.current != null) {
        window.cancelAnimationFrame(hammerMoveFrameRef.current);
        hammerMoveFrameRef.current = null;
      }
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
      setHammerPosition(hammerPositionRef.current);
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
          remainingTargets: payload.defeated
            ? Math.max(0, nextState.remainingTargets - 1)
            : nextState.remainingTargets,
          sessionKey: gameSessionKey,
          splats: payload.defeated
            ? [
                ...nextState.splats.slice(-5),
                {
                  id: `${payload.x}-${payload.y}-${Date.now()}`,
                  variant: payload.variant,
                  x: payload.x,
                  y: payload.y,
                },
              ]
            : nextState.splats,
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
      className={cn(
        "pointer-events-none absolute inset-0 overflow-hidden",
        className,
      )}
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
        combatStats={combatStats}
        motionProfile={motionProfile}
        onHit={handleBugHit}
        bugCounts={normalizedBugCounts}
        sceneProfile={sceneProfile}
        sessionKey={gameSessionKey}
        siegeZones={siegeZones}
        terminatorMode={terminatorMode}
        gameConfig={gameConfig}
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
          ref={hammerCursorRef}
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
