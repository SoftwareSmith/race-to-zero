import type { CSSProperties } from "react";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  getBugCountsKey,
  getBugTotal,
  getBugVariantMaxHp,
} from "../../../constants/bugs";
import Engine from "@game/engine/Engine";
import { getCodex } from "@game/engine/bugCodex";
import type { GameConfig } from "@game/engine/types";
import { DEFAULT_GAME_CONFIG } from "@game/engine/types";
import {
  getEffectPalette,
  getMotionProfile,
  getSceneProfile,
} from "@game/utils/backgroundScene";
import { cn } from "@shared/utils/cn";
import { drawBugSprite } from "@game/utils/bugSprite";
import type {
  AgentCaptureState,
  PlacedStructure,
  SiegeCombatStats,
  SiegeWeaponId,
  SiegeZoneRect,
  StructureId,
  WeaponEffectEvent,
} from "@game/types";
import type {
  BugCounts,
  BugParticle,
  BugVariant,
  BugVisualSettings,
  ChartFocusState,
  MotionProfile,
  SceneProfile,
  Tone,
} from "../../../types/dashboard";
import { WEAPON_DEFS } from "@config/weaponConfig";
import { drawHealthBar, HEALTHBAR_SHOW_DURATION } from "@game/utils/healthbar";
import WeaponCursor from "@game/components/WeaponCursor";
import WeaponEffectLayer from "@game/components/WeaponEffectLayer";
import StructureLayer from "@game/components/StructureLayer";
import { createEffectEvent, isEffectAlive } from "@game/utils/weaponEffects";

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
  pointValue?: number;
  frozen?: boolean;
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

interface QaWindowState {
  enabled?: boolean;
  bugPositions?: Array<{ index: number; x: number; y: number; radius: number }>;
  lastHit?: {
    defeated: boolean;
    remainingHp: number;
    variant: BugVariant;
    x: number;
    y: number;
  };
}

function updateQaBugPositions(
  bugPositions: RenderedBugPosition[],
  bounds: { left: number; top: number },
) {
  if (typeof window === "undefined") {
    return;
  }

  const qaState = (window as Window & { __RTZ_QA__?: QaWindowState })
    .__RTZ_QA__;
  if (!qaState?.enabled) {
    return;
  }

  qaState.bugPositions = bugPositions.map((position) => ({
    index: position.index,
    radius: position.radius,
    x: position.x + bounds.left,
    y: position.y + bounds.top,
  }));
}

function syncQaBugPositionsFromEngine(
  engine: { getAllBugs: () => Array<any> } | null,
  bounds: { left: number; top: number },
) {
  if (!engine) {
    return;
  }

  updateQaBugPositions(
    engine.getAllBugs().map((bug, index) => ({
      index,
      radius: Math.max((bug.size ?? 12) * 0.7, 12),
      x: bug.x,
      y: bug.y,
    })),
    bounds,
  );
}

function updateQaLastHit(payload: BugHitPayload) {
  if (typeof window === "undefined") {
    return;
  }

  const qaState = (window as Window & { __RTZ_QA__?: QaWindowState })
    .__RTZ_QA__;
  if (!qaState?.enabled) {
    return;
  }

  qaState.lastHit = payload;
}

function stabilizeQaEngine(
  engine: { getAllBugs: () => Array<any> } | null,
  width: number,
  height: number,
) {
  if (typeof window === "undefined" || !engine) {
    return;
  }

  const qaState = (window as Window & { __RTZ_QA__?: QaWindowState })
    .__RTZ_QA__;
  if (!qaState?.enabled) {
    return;
  }

  const bugs = engine.getAllBugs();
  for (const bug of bugs) {
    bug.x = width * 0.5;
    bug.y = height * 0.5;
    bug.vx = 0;
    bug.vy = 0;
  }
}

function getSplatClassName(variant: BugVariant) {
  if (variant === "urgent") {
    return "fixed z-[80] h-16 w-16 -translate-x-1/2 -translate-y-1/2 rounded-[52%_48%_55%_45%/43%_57%_46%_54%] bg-[radial-gradient(circle_at_38%_34%,rgba(255,214,214,0.18),transparent_22%),radial-gradient(circle_at_64%_62%,rgba(220,38,38,0.74),rgba(127,29,29,0.88)_64%,rgba(69,10,10,0.18)_86%,transparent_94%)] [animation:urgent-splatter_760ms_ease-out_forwards] pointer-events-none";
  }

  if (variant === "high") {
    return "fixed z-[80] h-14 w-14 -translate-x-1/2 -translate-y-1/2 rounded-[38%] bg-[radial-gradient(circle_at_38%_36%,rgba(255,180,160,0.22),transparent_18%),radial-gradient(circle_at_center,rgba(244,63,94,0.9),rgba(153,27,27,0.2)_68%,transparent_74%)] [animation:bug-splat_520ms_ease-out_forwards] pointer-events-none";
  }

  if (variant === "medium") {
    return "fixed z-[80] h-9 w-9 -translate-x-1/2 -translate-y-1/2 rounded-[45%] bg-[radial-gradient(circle_at_42%_38%,rgba(255,230,200,0.22),transparent_18%),radial-gradient(circle_at_center,rgba(250,130,100,0.86),rgba(160,40,30,0.16)_70%,transparent_76%)] [animation:bug-splat_440ms_ease-out_forwards] pointer-events-none";
  }

  return "fixed z-[80] h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle_at_40%_40%,rgba(255,255,255,0.2),transparent_20%),radial-gradient(circle_at_center,rgba(248,113,113,0.82),rgba(185,28,28,0.14)_70%,transparent_75%)] [animation:bug-splat_380ms_ease-out_forwards] pointer-events-none";
}

interface BugCanvasProps {
  bugVisualSettings: BugVisualSettings;
  bugCountsKey: string;
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
  bugCounts: BugCounts;
  sceneProfile: SceneProfile;
  sessionKey: string;
  siegeZones?: SiegeZoneRect[];
  terminatorMode: boolean;
  onEntityDeath?: (x: number, y: number, variant: string) => void;
  onStructureKill?: (x: number, y: number, variant: string) => void;
  onAgentAbsorb?: (data: {
    structureId: string;
    phase: "absorbing" | "done" | "failed";
    variant: string;
    bugX: number;
    bugY: number;
    processingMs?: number;
  }) => void;
  onTurretFire?: (data: {
    structureId: string;
    srcX: number;
    srcY: number;
    targetX: number;
    targetY: number;
    angle: number;
  }) => void;
  gameConfig?: GameConfig;
  hammerPositionRef?: { current: { x: number; y: number } };
}

const BugCanvas = memo(function BugCanvas({
  bugVisualSettings,
  bugCountsKey,
  chartFocus,
  combatStats,
  motionProfile,
  onHit,
  onWeaponFire,
  placingStructureId,
  onStructurePlace,
  selectedWeaponId = "wrench",
  bugCounts,
  sceneProfile,
  sessionKey,
  siegeZones = [],
  terminatorMode,
  onEntityDeath,
  onStructureKill,
  onAgentAbsorb,
  onTurretFire,
  gameConfig,
  hammerPositionRef,
}: BugCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const swarmRef = useRef<any | null>(null);
  const motionProfileRef = useRef(motionProfile);
  const sceneProfileRef = useRef(sceneProfile);
  const chartFocusRef = useRef(chartFocus);
  const terminatorModeRef = useRef(terminatorMode);
  const combatStatsRef = useRef<SiegeCombatStats | null>(combatStats ?? null);
  const onHitRef = useRef(onHit);
  const onEntityDeathRef = useRef(onEntityDeath);
  const onStructureKillRef = useRef(onStructureKill);
  const onAgentAbsorbRef = useRef(onAgentAbsorb);
  const onTurretFireRef = useRef(onTurretFire);
  const onWeaponFireRef = useRef(onWeaponFire);
  const placingStructureIdRef = useRef(placingStructureId);
  const onStructurePlaceRef = useRef(onStructurePlace);

  useEffect(() => {
    terminatorModeRef.current = terminatorMode;
  }, [terminatorMode]);
  const selectedWeaponIdRef = useRef<SiegeWeaponId>(selectedWeaponId);
  const lastFireTimeRef = useRef<Record<string, number>>({});
  const reseedInfoRef = useRef<{
    ts: number;
    clustered: number;
    total: number;
  } | null>(null);
  const siegeZonesRef = useRef<SiegeZoneRect[]>(siegeZones);
  const boundsRef = useRef({ height: 0, left: 0, top: 0, width: 0 });
  const latestBugPositionsRef = useRef<RenderedBugPosition[]>([]);
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
  const gameConfigKey = useMemo(
    () => JSON.stringify(gameConfig ?? {}),
    [gameConfig],
  );

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
            onEntityDeathRef.current?.(
              Math.round(x + (boundsRef.current.left || 0)),
              Math.round(y + (boundsRef.current.top || 0)),
              variant,
            );
          } catch {
            void 0;
          }
        },
        onStructureKill: (x, y, variant) => {
          try {
            onStructureKillRef.current?.(
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
            onAgentAbsorbRef.current?.(data);
          } catch {
            void 0;
          }
        },
        onTurretFire: (data) => {
          try {
            const vx = Math.round(data.srcX + (boundsRef.current.left || 0));
            const vy = Math.round(data.srcY + (boundsRef.current.top || 0));
            const vtx = Math.round(
              data.targetX + (boundsRef.current.left || 0),
            );
            const vty = Math.round(data.targetY + (boundsRef.current.top || 0));
            onWeaponFireRef.current?.("pointer", vx, vy, {
              targetX: vtx,
              targetY: vty,
              color: "#22d3ee",
            });
            onTurretFireRef.current?.(data);
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
      stabilizeQaEngine(engine, w, h);
      swarmRef.current = engine;
      syncQaBugPositionsFromEngine(engine, boundsRef.current);
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
    // Note: terminatorMode is intentionally excluded from this dep array.
    // Removing it prevents the engine from being destroyed and recreated when
    // siege mode activates, giving a seamless visual transition.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bugCountsKey, gameConfigKey, getLocalSiegeZones]);

  useEffect(() => {
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
    onEntityDeathRef.current = onEntityDeath;
  }, [onEntityDeath]);

  useEffect(() => {
    onStructureKillRef.current = onStructureKill;
  }, [onStructureKill]);

  useEffect(() => {
    onAgentAbsorbRef.current = onAgentAbsorb;
  }, [onAgentAbsorb]);

  useEffect(() => {
    onTurretFireRef.current = onTurretFire;
  }, [onTurretFire]);

  useEffect(() => {
    onWeaponFireRef.current = onWeaponFire;
  }, [onWeaponFire]);

  useEffect(() => {
    placingStructureIdRef.current = placingStructureId;
  }, [placingStructureId]);

  useEffect(() => {
    onStructurePlaceRef.current = onStructurePlace;
  }, [onStructurePlace]);

  useEffect(() => {
    selectedWeaponIdRef.current = selectedWeaponId;
  }, [selectedWeaponId]);

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
        stabilizeQaEngine(swarmRef.current, nextWidth, nextHeight);
        syncQaBugPositionsFromEngine(swarmRef.current, boundsRef.current);
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
      const focusX = activeChartFocus?.relativeIndex ?? 0.5;
      latestBugPositionsRef.current = [];

      for (let index = 0; index < activeParticles.length; index += 1) {
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

        // Health bar: shown after a hit on multi-HP bugs until HEALTHBAR_SHOW_DURATION elapses
        const lastHitTime: number = (particle as any).lastHitTime ?? 0;
        const bugMaxHp: number = (particle as any).maxHp ?? 1;
        const bugHp: number = (particle as any).hp ?? 1;
        if (lastHitTime > 0 && bugMaxHp > 1 && bugHp < bugMaxHp) {
          const elapsed = performance.now() - lastHitTime;
          if (elapsed < HEALTHBAR_SHOW_DURATION) {
            drawHealthBar(context, x, y, bugHp, bugMaxHp, size, elapsed);
          }
        }
      }

      updateQaBugPositions(latestBugPositionsRef.current, boundsRef.current);

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
      if (!terminatorModeRef.current) {
        return;
      }

      // Keep bounds fresh on scroll; stale viewport offsets break click→canvas mapping.
      const liveBounds = canvas.getBoundingClientRect();
      if (liveBounds.width && liveBounds.height) {
        boundsRef.current = {
          height: liveBounds.height,
          left: liveBounds.left,
          top: liveBounds.top,
          width: liveBounds.width,
        };
      }

      const targetElement =
        event.target instanceof Element ? event.target : null;
      if (targetElement?.closest("[data-no-hammer]")) {
        return;
      }

      const bounds = boundsRef.current;
      if (!bounds.width || !bounds.height) {
        return;
      }

      const clickX = event.clientX - bounds.left;
      const clickY = event.clientY - bounds.top;
      const hpRef = hammerPositionRef;
      const hasLiveCursor =
        hpRef != null &&
        Number.isFinite(hpRef.current.x) &&
        Number.isFinite(hpRef.current.y) &&
        (hpRef.current.x !== 0 || hpRef.current.y !== 0);
      const fireX = hasLiveCursor ? hpRef!.current.x : event.clientX;
      const fireY = hasLiveCursor ? hpRef!.current.y : event.clientY;
      const targetX = fireX - bounds.left;
      const targetY = fireY - bounds.top;

      // ── Structure placement takes priority over weapon fire ─────
      const placingId = placingStructureIdRef.current;
      if (placingId) {
        const placedStructureId = `${placingId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        const engine = swarmRef.current;
        if (engine) {
          (engine as any).addStructure(
            clickX,
            clickY,
            placingId,
            placedStructureId,
          );
        }
        onStructurePlaceRef.current?.(
          placingId,
          event.clientX,
          event.clientY,
          clickX,
          clickY,
          placedStructureId,
        );
        return;
      }

      const weaponId = selectedWeaponIdRef.current;
      const weaponDef =
        WEAPON_DEFS.find((w) => w.id === weaponId) ?? WEAPON_DEFS[0];

      // Per-weapon cooldown enforcement
      if (weaponDef.cooldownMs > 0) {
        const now = performance.now();
        const lastFire = lastFireTimeRef.current[weaponId] ?? 0;
        if (now - lastFire < weaponDef.cooldownMs) {
          return;
        }
        lastFireTimeRef.current[weaponId] = now;
      }

      const centerX = bounds.width / 2;
      const centerY = bounds.height / 2;

      const engine = swarmRef.current;
      if (!engine) return;

      if (weaponDef.hitPattern === "point") {
        // ── Wrench: hit nearest bug within radius ────────────────
        onWeaponFireRef.current?.(weaponId, fireX, fireY);

        let hitCandidate: { distance: number; index: number } | null = null;

        try {
          if (typeof engine.hitTest === "function") {
            const res = engine.hitTest(targetX, targetY);
            if (res)
              hitCandidate = { distance: res.distance, index: res.index };
          }
        } catch {
          void 0;
        }

        if (!hitCandidate) {
          for (const bugPosition of latestBugPositionsRef.current) {
            const distance = Math.hypot(
              targetX - bugPosition.x,
              targetY - bugPosition.y,
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
          const particle = engine.getAllBugs()[hitCandidate.index];
          if (particle) {
            if (typeof engine.handleHit === "function") {
              const result = engine.handleHit(
                hitCandidate.index,
                weaponDef.damage ?? 1,
              );
              if (result) {
                onHitRef.current({
                  defeated: result.defeated,
                  remainingHp: result.remainingHp,
                  variant: result.variant,
                  x: event.clientX,
                  y: event.clientY,
                  pointValue: result.pointValue,
                  frozen: result.frozen,
                });
                updateQaLastHit({
                  defeated: result.defeated,
                  remainingHp: result.remainingHp,
                  variant: result.variant,
                  x: event.clientX,
                  y: event.clientY,
                });
                return;
              }
            }

            const currentHp =
              hitPointsRef.current.get(hitCandidate.index) ??
              getBugVariantMaxHp(particle.variant);
            const remainingHp = Math.max(
              0,
              currentHp - (weaponDef.damage ?? 1),
            );
            hitPointsRef.current.set(hitCandidate.index, remainingHp);
            const defeated = remainingHp === 0;
            onHitRef.current({
              defeated,
              remainingHp,
              variant: particle.variant,
              x: event.clientX,
              y: event.clientY,
            });
            updateQaLastHit({
              defeated,
              remainingHp,
              variant: particle.variant,
              x: event.clientX,
              y: event.clientY,
            });
          }
        }
      } else if (weaponDef.hitPattern === "line") {
        // ── Laser: directional beam with optional 8-way snap ────
        let beamAngleRad = 0;

        if (weaponDef.snapAngle) {
          // Snap angle from click to screen center to nearest 45 degrees
          const rawAngle = Math.atan2(centerY - targetY, centerX - targetX);
          const snapped = Math.round(rawAngle / (Math.PI / 4)) * (Math.PI / 4);
          beamAngleRad = snapped;
        }

        onWeaponFireRef.current?.(weaponId, fireX, fireY, {
          angle: beamAngleRad,
        });

        if (typeof engine.lineHitTest === "function") {
          let hitIndexes: number[];
          if (weaponDef.snapAngle) {
            // Snapped directional beam: line from edge to edge through click along angle
            const length = Math.max(bounds.width, bounds.height) * 1.5;
            const cos = Math.cos(beamAngleRad);
            const sin = Math.sin(beamAngleRad);
            hitIndexes = engine.lineHitTest(
              targetX - cos * length,
              targetY - sin * length,
              targetX + cos * length,
              targetY + sin * length,
              weaponDef.hitRadius,
            );
          } else {
            const isVertical = weaponDef.hitOrientation === "vertical";
            hitIndexes = isVertical
              ? engine.lineHitTest(
                  targetX,
                  0,
                  targetX,
                  bounds.height,
                  weaponDef.hitRadius,
                )
              : engine.lineHitTest(
                  0,
                  targetY,
                  bounds.width,
                  targetY,
                  weaponDef.hitRadius,
                );
          }
          for (const idx of hitIndexes) {
            const result = engine.handleHit(idx, weaponDef.damage ?? 1);
            if (!result) continue;
            const bugPos = engine.getAllBugs()[idx];
            const vx = bugPos
              ? Math.round(bugPos.x + bounds.left)
              : event.clientX;
            const vy = bugPos
              ? Math.round(bugPos.y + bounds.top)
              : event.clientY;
            onHitRef.current({
              defeated: result.defeated,
              remainingHp: result.remainingHp,
              variant: result.variant,
              x: vx,
              y: vy,
              pointValue: result.pointValue,
              frozen: result.frozen,
            });
            updateQaLastHit({
              defeated: result.defeated,
              remainingHp: result.remainingHp,
              variant: result.variant,
              x: vx,
              y: vy,
            });
          }
        }
      } else if (weaponDef.hitPattern === "area") {
        // ── Pulse / Bomb / Shockwave / Zapper ───────────────────
        onWeaponFireRef.current?.(weaponId, fireX, fireY);

        if (typeof engine.radiusHitTest === "function") {
          const hitIndexes = engine.radiusHitTest(
            targetX,
            targetY,
            weaponDef.hitRadius,
          );
          for (const idx of hitIndexes) {
            const bug = engine.getAllBugs()[idx];
            let damage = weaponDef.damage ?? 1;

            // Instakill 1-HP bugs if weapon has that flag
            if (weaponDef.instakillLowHp && bug) {
              const bugHp: number = (bug as any).hp ?? 1;
              if (bugHp <= 1) damage = 999;
            }

            const result = engine.handleHit(idx, damage);
            if (!result) continue;

            // Knockback surviving bugs
            if (weaponDef.appliesKnockback && !result.defeated && bug) {
              const dx = bug.x - targetX || 1;
              const dy = bug.y - targetY || 1;
              const dist = Math.hypot(dx, dy) || 1;
              if (typeof (bug as any).knockback === "function") {
                (bug as any).knockback((dx / dist) * 180, (dy / dist) * 180);
              }
            }

            const bugPos = bug;
            const vx = bugPos
              ? Math.round(bugPos.x + bounds.left)
              : event.clientX;
            const vy = bugPos
              ? Math.round(bugPos.y + bounds.top)
              : event.clientY;
            onHitRef.current({
              defeated: result.defeated,
              remainingHp: result.remainingHp,
              variant: result.variant,
              x: vx,
              y: vy,
              pointValue: result.pointValue,
              frozen: result.frozen,
            });
            updateQaLastHit({
              defeated: result.defeated,
              remainingHp: result.remainingHp,
              variant: result.variant,
              x: vx,
              y: vy,
            });
          }
        }
      } else if (weaponDef.hitPattern === "cone") {
        // ── Freeze: icy cone spray from click toward center ──────
        const angleDeg =
          (Math.atan2(centerY - targetY, centerX - targetX) * 180) / Math.PI;
        const arcDeg = weaponDef.coneArcDeg ?? 90;

        onWeaponFireRef.current?.(weaponId, fireX, fireY, {
          angle: (angleDeg * Math.PI) / 180,
        });

        if (typeof engine.coneHitTest === "function") {
          const hitIndexes = engine.coneHitTest(
            targetX,
            targetY,
            angleDeg,
            arcDeg,
            weaponDef.hitRadius,
          );
          for (const idx of hitIndexes) {
            const result = engine.handleHit(idx, weaponDef.damage ?? 1);
            if (!result) continue;

            // Apply slow to surviving or just-hit bugs
            const bug = engine.getAllBugs()[idx];
            if (weaponDef.appliesSlow && bug) {
              if (typeof (bug as any).applyFreeze === "function") {
                (bug as any).applyFreeze(0.35, 3500);
              }
            }

            const bugPos = bug;
            const vx = bugPos
              ? Math.round(bugPos.x + bounds.left)
              : event.clientX;
            const vy = bugPos
              ? Math.round(bugPos.y + bounds.top)
              : event.clientY;
            onHitRef.current({
              defeated: result.defeated,
              remainingHp: result.remainingHp,
              variant: result.variant,
              x: vx,
              y: vy,
              pointValue: result.pointValue,
              frozen: result.frozen,
            });
            updateQaLastHit({
              defeated: result.defeated,
              remainingHp: result.remainingHp,
              variant: result.variant,
              x: vx,
              y: vy,
            });
          }
        }
      } else if (weaponDef.hitPattern === "chain") {
        // ── Chain Zap: bounce lightning between nearby bugs ──────
        let hitCandidate: { distance: number; index: number } | null = null;

        try {
          if (typeof engine.hitTest === "function") {
            const res = engine.hitTest(targetX, targetY);
            if (res)
              hitCandidate = { distance: res.distance, index: res.index };
          }
        } catch {
          void 0;
        }

        if (!hitCandidate) {
          for (const bugPosition of latestBugPositionsRef.current) {
            const distance = Math.hypot(
              targetX - bugPosition.x,
              targetY - bugPosition.y,
            );
            if (
              distance <= Math.max(bugPosition.radius, weaponDef.hitRadius) &&
              (!hitCandidate || distance < hitCandidate.distance)
            ) {
              hitCandidate = { distance, index: bugPosition.index };
            }
          }
        }

        if (!hitCandidate) {
          // No initial target, show effect at click
          onWeaponFireRef.current?.(weaponId, fireX, fireY);
          return;
        }

        const chainIndexes =
          typeof engine.chainHitTest === "function"
            ? [
                hitCandidate.index,
                ...engine.chainHitTest(
                  hitCandidate.index,
                  weaponDef.hitRadius,
                  weaponDef.chainMaxBounces ?? 3,
                ),
              ]
            : [hitCandidate.index];

        // Build chain node positions for the effect (viewport-space)
        const chainNodes = chainIndexes
          .map((idx) => {
            const bug = engine.getAllBugs()[idx];
            if (!bug) return null;
            return {
              x: Math.round(bug.x + bounds.left),
              y: Math.round(bug.y + bounds.top),
            };
          })
          .filter(Boolean) as Array<{ x: number; y: number }>;

        onWeaponFireRef.current?.(weaponId, fireX, fireY, {
          chainNodes,
        });

        for (const idx of chainIndexes) {
          const result = engine.handleHit(idx, weaponDef.damage ?? 1);
          if (!result) continue;
          const bugPos = engine.getAllBugs()[idx];
          const vx = bugPos
            ? Math.round(bugPos.x + bounds.left)
            : event.clientX;
          const vy = bugPos ? Math.round(bugPos.y + bounds.top) : event.clientY;
          onHitRef.current({
            defeated: result.defeated,
            remainingHp: result.remainingHp,
            variant: result.variant,
            x: vx,
            y: vy,
            pointValue: result.pointValue,
            frozen: result.frozen,
          });
          updateQaLastHit({
            defeated: result.defeated,
            remainingHp: result.remainingHp,
            variant: result.variant,
            x: vx,
            y: vy,
          });
        }
      } else if (weaponDef.hitPattern === "seeking") {
        // ── Pointer / Null Pointer: auto-seek closest bug ────────
        let targetIdx = -1;

        try {
          if (typeof engine.closestTargetIndex === "function") {
            const sr =
              weaponDef.seekRadius === undefined ||
              weaponDef.seekRadius === Infinity
                ? Infinity
                : weaponDef.seekRadius;
            targetIdx = engine.closestTargetIndex(targetX, targetY, sr);
          }
        } catch {
          void 0;
        }

        const seekTargetBug =
          targetIdx >= 0 ? engine.getAllBugs()[targetIdx] : null;
        const seekTargetVx = seekTargetBug
          ? Math.round(seekTargetBug.x + bounds.left)
          : event.clientX;
        const seekTargetVy = seekTargetBug
          ? Math.round(seekTargetBug.y + bounds.top)
          : event.clientY;
        onWeaponFireRef.current?.(weaponId, fireX, fireY, {
          targetX: seekTargetVx,
          targetY: seekTargetVy,
        });

        if (targetIdx >= 0) {
          const result = engine.handleHit(targetIdx, weaponDef.damage ?? 1);
          if (result) {
            const bugPos = engine.getAllBugs()[targetIdx];
            const vx = bugPos
              ? Math.round(bugPos.x + bounds.left)
              : event.clientX;
            const vy = bugPos
              ? Math.round(bugPos.y + bounds.top)
              : event.clientY;
            onHitRef.current({
              defeated: result.defeated,
              remainingHp: result.remainingHp,
              variant: result.variant,
              x: vx,
              y: vy,
              pointValue: result.pointValue,
              frozen: result.frozen,
            });
            updateQaLastHit({
              defeated: result.defeated,
              remainingHp: result.remainingHp,
              variant: result.variant,
              x: vx,
              y: vy,
            });

            // Splash damage for nullpointer
            if (
              weaponDef.splashRadius &&
              typeof engine.radiusHitTest === "function"
            ) {
              const primaryBug = engine.getAllBugs()[targetIdx];
              if (primaryBug) {
                const splashTargets = engine
                  .radiusHitTest(
                    primaryBug.x,
                    primaryBug.y,
                    weaponDef.splashRadius,
                  )
                  .filter((i: number) => i !== targetIdx);
                for (const idx of splashTargets) {
                  const sr = engine.handleHit(idx, 1);
                  if (!sr) continue;
                  const sp = engine.getAllBugs()[idx];
                  onHitRef.current({
                    defeated: sr.defeated,
                    remainingHp: sr.remainingHp,
                    variant: sr.variant,
                    x: sp ? Math.round(sp.x + bounds.left) : vx,
                    y: sp ? Math.round(sp.y + bounds.top) : vy,
                    pointValue: sr.pointValue,
                  });
                }
              }
            }
          }
        }
      }
    };

    document.addEventListener("visibilitychange", updateActivity);
    window.addEventListener("focus", updateActivity);
    window.addEventListener("blur", updateActivity);
    // Single registration - the useEffect cleanup in React Strict Mode re-runs will
    // remove the previous listener before re-registering, so no double-fire risk.
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

interface BackgroundFieldProps {
  bugCounts: BugCounts;
  bugVisualSettings: BugVisualSettings;
  chartFocus: ChartFocusState | null;
  className?: string;
  combatStats?: SiegeCombatStats | null;
  interactiveSessionKey?: string | null;
  onStructurePlace?: (
    structureType: StructureId,
    viewportX: number,
    viewportY: number,
    canvasX: number,
    canvasY: number,
    structureId?: string,
  ) => void;
  onTerminatorHit?: (payload: BugHitPayload) => void;
  onWeaponFired?: (id: SiegeWeaponId, firedAt: number) => void;
  placedStructures?: PlacedStructure[];
  agentCaptures?: Record<string, AgentCaptureState>;
  onAgentAbsorb?: (data: {
    structureId: string;
    phase: "absorbing" | "done" | "failed";
    variant: string;
    bugX: number;
    bugY: number;
    processingMs?: number;
  }) => void;
  placingStructureId?: StructureId | null;
  remainingBugCount?: number;
  selectedWeaponId?: SiegeWeaponId;
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
  onStructurePlace,
  onTerminatorHit,
  onWeaponFired,
  placedStructures,
  agentCaptures,
  onAgentAbsorb,
  placingStructureId,
  remainingBugCount,
  selectedWeaponId = "wrench",
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
  const [cursorLastFireTimes, setCursorLastFireTimes] = useState<
    Partial<Record<SiegeWeaponId, number>>
  >({});
  const [turretLastFireTimes, setTurretLastFireTimes] = useState<
    Record<string, number>
  >({});
  const hammerPositionRef = useRef({ x: 0, y: 0 });
  const weaponCursorRef = useRef<HTMLDivElement | null>(null);
  const hammerMoveFrameRef = useRef<number | null>(null);
  const [weaponEffects, setWeaponEffects] = useState<WeaponEffectEvent[]>([]);
  const onWeaponFiredRef = useRef(onWeaponFired);

  useEffect(() => {
    onWeaponFiredRef.current = onWeaponFired;
  }, [onWeaponFired]);

  useEffect(() => {
    if (!terminatorMode) {
      setCursorLastFireTimes({});
      setTurretLastFireTimes({});
      return;
    }

    setCursorLastFireTimes({});
    setTurretLastFireTimes({});
  }, [gameSessionKey, terminatorMode]);

  const handleTurretFire = useCallback(
    (data: {
      structureId: string;
      srcX: number;
      srcY: number;
      targetX: number;
      targetY: number;
      angle: number;
    }) => {
      setTurretLastFireTimes((prev) => ({
        ...prev,
        [data.structureId]: performance.now(),
      }));
    },
    [],
  );

  const handleWeaponFire = useCallback(
    (
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
      },
    ) => {
      const event = createEffectEvent(weapon, x, y, extras);
      setWeaponEffects((prev) => {
        const now = performance.now();
        return [...prev.filter((e) => isEffectAlive(e, now)), event];
      });
      setCursorLastFireTimes((prev) => ({
        ...prev,
        [weapon]: event.startedAt,
      }));
      // Always swing wrench cursor on any wrench fire (hit or miss)
      if (weapon === "wrench") {
        setHammerSwing(true);
      }
      // Notify parent so it can update reload bar state
      onWeaponFiredRef.current?.(weapon, event.startedAt);
    },
    [],
  );

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
      setWeaponEffects([]);
      return undefined;
    }

    if (weaponEffects.length === 0) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      const now = performance.now();
      setWeaponEffects((previous) =>
        previous.filter((effect) => isEffectAlive(effect, now)),
      );
    }, 80);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [terminatorMode, weaponEffects.length]);

  useEffect(() => {
    if (!terminatorMode) {
      hammerPositionRef.current = { x: 0, y: 0 };
      if (weaponCursorRef.current) {
        weaponCursorRef.current.style.transform = "translate3d(0px, 0px, 0)";
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
        const cursor = weaponCursorRef.current;
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

  const handleStructureKill = useCallback(
    (x: number, y: number, variant: string) => {
      onTerminatorHit?.({
        defeated: true,
        remainingHp: 0,
        variant: variant as BugVariant,
        x,
        y,
        pointValue: 1,
      });
      setGameState((currentValue) => {
        const nextState =
          currentValue.sessionKey === gameSessionKey
            ? currentValue
            : {
                remainingTargets: totalBugCount,
                sessionKey: gameSessionKey,
                splats: [] as GameState["splats"],
              };
        return {
          ...nextState,
          remainingTargets: Math.max(0, nextState.remainingTargets - 1),
          splats: [
            ...nextState.splats.slice(-5),
            {
              id: `${x}-${y}-${Date.now()}`,
              variant: variant as BugVariant,
              x,
              y,
            },
          ],
        };
      });
    },
    [gameSessionKey, onTerminatorHit, totalBugCount],
  );

  const handleEntityDeath = useCallback(
    (_x: number, _y: number, _variant: string) => {
      // Weapon/structure handlers already update kill state and splats.
      // Avoid duplicate delayed splats when engine transitions dying->dead.
    },
    [],
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
      {chartFocus ? (
        <div
          className="absolute inset-y-0 w-48 -translate-x-1/2 blur-3xl opacity-[0.22]"
          style={{
            left: `${(chartFocus.relativeIndex ?? 0.5) * 100}%`,
            background: colors.bug,
          }}
        />
      ) : null}
      <BugCanvas
        bugVisualSettings={bugVisualSettings}
        bugCountsKey={bugCountsKey}
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
        onEntityDeath={handleEntityDeath}
        onStructureKill={terminatorMode ? handleStructureKill : undefined}
        onAgentAbsorb={terminatorMode ? onAgentAbsorb : undefined}
        onTurretFire={terminatorMode ? handleTurretFire : undefined}
        placingStructureId={terminatorMode ? placingStructureId : null}
        onStructurePlace={terminatorMode ? onStructurePlace : undefined}
        selectedWeaponId={selectedWeaponId}
        onWeaponFire={terminatorMode ? handleWeaponFire : undefined}
        hammerPositionRef={hammerPositionRef}
      />
      {effectiveBugCount === 0 ? (
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(187,247,208,0.12),transparent_28%),radial-gradient(circle_at_60%_68%,rgba(125,211,252,0.08),transparent_34%)] [animation:all-clear-breathe_6s_ease-in-out_infinite]" />
      ) : null}
      <WeaponEffectLayer effects={terminatorMode ? weaponEffects : []} />
      {terminatorMode && placedStructures && placedStructures.length > 0 ? (
        <StructureLayer
          structures={placedStructures}
          agentCaptures={agentCaptures}
          turretLastFireTimes={turretLastFireTimes}
        />
      ) : null}
      {terminatorMode ? (
        <WeaponCursor
          hideSystemCursor={
            selectedWeaponId === "wrench" || !!placingStructureId
          }
          lastFiredAt={cursorLastFireTimes[selectedWeaponId]}
          structureId={placingStructureId ?? undefined}
          weaponId={selectedWeaponId}
          swinging={hammerSwing}
        />
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
