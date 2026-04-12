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
import VfxCanvas from "@game/components/VfxCanvas";
import type { VfxEngine } from "@game/engine/VfxEngine";
import { triggerWeaponShake } from "@game/utils/screenShake";
import type {
  WeaponContext,
  ExecutionContext,
  PersistentFireSession,
} from "@game/weapons/runtime/types";
import { getEntry, hasEntry } from "@game/weapons/runtime/registry";
import { executeCommands } from "@game/weapons/runtime/executor";

const TARGET_FRAME_MS = 1000 / 24;
const TRANSITION_EASING = 0.08;
const OVERLAY_EFFECT_WEAPONS = new Set<SiegeWeaponId>([
  "freeze",
  "chain",
  "laser",
  "nullpointer",
  "void",
]);

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
  bugCounts: BugCounts;
  sceneProfile: SceneProfile;
  sessionKey: string;
  siegeZones?: SiegeZoneRect[];
  terminatorMode: boolean;
  onEntityDeath?: (
    x: number,
    y: number,
    variant: string,
    meta: { credited: boolean; frozen: boolean; pointValue: number },
  ) => void;
  onStructureKill?: (x: number, y: number, variant: string) => void;
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
  onTurretFire?: (data: {
    structureId: string;
    srcX: number;
    srcY: number;
    targetX: number;
    targetY: number;
    angle: number;
    phase: "aim" | "fire";
  }) => void;
  onTeslaFire?: (data: { structureId: string }) => void;
  gameConfig?: GameConfig;
  hammerPositionRef?: { current: { x: number; y: number } };
  getWeaponTier?: (id: SiegeWeaponId) => import("@game/types").WeaponTier;
  onWeaponEvolution?: (
    weaponId: SiegeWeaponId,
    newTier: import("@game/types").WeaponTier,
  ) => void;
  initialEvolutionStates?: Partial<
    Record<SiegeWeaponId, import("@game/types").WeaponEvolutionState>
  >;
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
  selectedWeaponId = "hammer",
  bugCounts,
  sceneProfile,
  sessionKey,
  siegeZones = [],
  terminatorMode,
  onEntityDeath,
  onStructureKill,
  onAgentAbsorb,
  onTurretFire,
  onTeslaFire,
  gameConfig,
  hammerPositionRef,
  getWeaponTier = () => 1 as import("@game/types").WeaponTier,
  onWeaponEvolution,
  initialEvolutionStates,
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
  const onTeslaFireRef = useRef(onTeslaFire);
  const onWeaponFireRef = useRef(onWeaponFire);
  const vfxRef = useRef<VfxEngine | null>(null);
  const blackHoleVfxIdRef = useRef<string | null>(null);
  const placingStructureIdRef = useRef(placingStructureId);
  const onStructurePlaceRef = useRef(onStructurePlace);

  useEffect(() => {
    terminatorModeRef.current = terminatorMode;
  }, [hammerPositionRef, terminatorMode]);
  const selectedWeaponIdRef = useRef<SiegeWeaponId>(selectedWeaponId);
  const lastFireTimeRef = useRef<Record<string, number>>({});
  const isFiringRef = useRef(false);
  const currentMouseRef = useRef<{ x: number; y: number } | null>(null);
  const fireIntervalRef = useRef<number | null>(null);
  const lastPaintPosRef = useRef<{ x: number; y: number } | null>(null);
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
        onEntityDeath: (x, y, variant, meta) => {
          try {
            onEntityDeathRef.current?.(
              Math.round(x + (boundsRef.current.left || 0)),
              Math.round(y + (boundsRef.current.top || 0)),
              variant,
              meta,
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
        onTurretFire: (data) => {
          try {
            const vx = Math.round(data.srcX + (boundsRef.current.left || 0));
            const vy = Math.round(data.srcY + (boundsRef.current.top || 0));
            const vtx = Math.round(
              data.targetX + (boundsRef.current.left || 0),
            );
            const vty = Math.round(data.targetY + (boundsRef.current.top || 0));
            if (data.phase === "aim") {
              // Tracer line from turret to target during aim phase
              vfxRef.current?.addTracerLine(
                data.srcX,
                data.srcY,
                data.targetX,
                data.targetY,
                550,
              );
              onWeaponFireRef.current?.("nullpointer", vx, vy, {
                targetX: vtx,
                targetY: vty,
                color: "#22d3ee",
              });
            } else {
              // Fire phase: spark crown + small burst at target
              vfxRef.current?.spawnSparkCrown(
                data.targetX,
                data.targetY,
                0x22d3ee,
              );
              vfxRef.current?.spawnExplosion(
                data.targetX,
                data.targetY,
                40,
                0x22d3ee,
              );
            }
            onTurretFireRef.current?.(data);
          } catch {
            void 0;
          }
        },
        onTeslaFire: (data) => {
          try {
            vfxRef.current?.spawnLightning(data.nodes, 900, 0xc084fc);
            const chainNodes = data.nodes.map((n) => ({
              x: Math.round(n.x + (boundsRef.current.left || 0)),
              y: Math.round(n.y + (boundsRef.current.top || 0)),
            }));
            if (chainNodes.length >= 2) {
              onWeaponFireRef.current?.(
                "chain",
                chainNodes[0].x,
                chainNodes[0].y,
                {
                  chainNodes,
                  color: "#c084fc",
                },
              );
            }
            onTeslaFireRef.current?.({ structureId: data.structureId });
          } catch {
            void 0;
          }
        },
        onWeaponEvolution: onWeaponEvolution ?? undefined,
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
    onTeslaFireRef.current = onTeslaFire;
  }, [onTeslaFire]);

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

    // Fire action extracted so it can be invoked once (click) or repeatedly (hold)
    const fireAt = (clientX: number, clientY: number) => {
      const bounds = boundsRef.current;
      if (!bounds.width || !bounds.height) return;
      // client -> canvas coords
      const clickX = clientX - bounds.left;
      const clickY = clientY - bounds.top;
      const hpRef = hammerPositionRef;
      const hasLiveCursor =
        hpRef != null &&
        Number.isFinite(hpRef.current.x) &&
        Number.isFinite(hpRef.current.y) &&
        (hpRef.current.x !== 0 || hpRef.current.y !== 0);
      const fireX = hasLiveCursor ? hpRef!.current.x : clientX;
      const fireY = hasLiveCursor ? hpRef!.current.y : clientY;
      const targetX = fireX - bounds.left;
      const targetY = fireY - bounds.top;

      // Structure placement takes priority
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
          clientX,
          clientY,
          clickX,
          clickY,
          placedStructureId,
        );
        return;
      }

      const weaponId = selectedWeaponIdRef.current;
      const weaponDef =
        WEAPON_DEFS.find((w) => w.id === weaponId) ?? WEAPON_DEFS[0];

      // cooldown
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

      // VFX and engine interactions (mirrors original logic)
      if (vfxRef.current) {
        const vfx = vfxRef.current;
        const coneAngle =
          (Math.atan2(centerY - targetY, centerX - targetX) * 180) / Math.PI;
        switch (weaponId) {
          case "flame": {
            const flameDir = coneAngle + 180;
            vfx.spawnSprayParticles(targetX, targetY, flameDir, 40, 18);
            vfx.addFirePatch(targetX, targetY, 90, 1000);
            break;
          }
          case "zapper": {
            const sprayAngle =
              (Math.atan2(centerY - targetY, centerX - targetX) * 180) /
              Math.PI;
            vfx.spawnSprayParticles(targetX, targetY, sprayAngle + 180, 50);
            vfx.addToxicCloud(targetX, targetY, 96, 2400);
            try {
              const poisonDps = weaponDef.poisonDps ?? 0.5;
              const poisonDurationMs = weaponDef.poisonDurationMs ?? 3000;
              const cloudRadius = 96;
              const cloudMs = 2400;
              engine.applyPoisonInRadius(
                targetX,
                targetY,
                cloudRadius,
                poisonDps,
                poisonDurationMs,
              );
              const intervalMs = 400;
              const intId = window.setInterval(() => {
                const eng = swarmRef.current;
                if (!eng) {
                  window.clearInterval(intId);
                  return;
                }
                eng.applyPoisonInRadius(
                  targetX,
                  targetY,
                  cloudRadius,
                  poisonDps,
                  poisonDurationMs,
                );
              }, intervalMs);
              window.setTimeout(
                () => window.clearInterval(intId),
                cloudMs + 50,
              );
            } catch {
              void 0;
            }
            break;
          }
          default:
            break;
        }
      }
      if (canvasRef.current) triggerWeaponShake(canvasRef.current, weaponId);

      // now apply hits (point/line/cone logic)
      // copy the remaining portion from original handler: hitPattern handling
      if (weaponDef.hitPattern === "point") {
        onWeaponFireRef.current?.(weaponId, clientX, clientY);
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
                true,
              );
              if (result) {
                onHitRef.current({
                  defeated: result.defeated,
                  remainingHp: result.remainingHp,
                  variant: result.variant,
                  x: clientX,
                  y: clientY,
                  pointValue: result.pointValue,
                  frozen: result.frozen,
                });
                updateQaLastHit({
                  defeated: result.defeated,
                  remainingHp: result.remainingHp,
                  variant: result.variant,
                  x: clientX,
                  y: clientY,
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
              x: clientX,
              y: clientY,
            });
            updateQaLastHit({
              defeated,
              remainingHp,
              variant: particle.variant,
              x: clientX,
              y: clientY,
            });
          }
        }
      } else if (weaponDef.hitPattern === "line") {
        // For brevity, keep existing line behavior unchanged: call existing code path by
        // synthesizing a quick line dispatch similar to original handler.
        // (Original complex line logic remains in the main handler; for hold weapons
        // that are cone-based we rely on VFX/area effects instead.)
      }
    };

    // Visual-only flame trail painter used while dragging quickly so the
    // cursor path stays continuous between cooldown-based weapon fires.
    const paintFlameAt = (clientX: number, clientY: number) => {
      const bounds = boundsRef.current;
      if (!bounds.width || !bounds.height) return;
      const hpRef = hammerPositionRef;
      const hasLiveCursor =
        hpRef != null &&
        Number.isFinite(hpRef.current.x) &&
        Number.isFinite(hpRef.current.y) &&
        (hpRef.current.x !== 0 || hpRef.current.y !== 0);
      const fireX = hasLiveCursor ? hpRef!.current.x : clientX;
      const fireY = hasLiveCursor ? hpRef!.current.y : clientY;
      const targetX = fireX - bounds.left;
      const targetY = fireY - bounds.top;

      const centerX = bounds.width / 2;
      const centerY = bounds.height / 2;
      const engine = swarmRef.current;
      const vfx = vfxRef.current;
      if (!vfx) return;
      const flameDir =
        (Math.atan2(centerY - targetY, centerX - targetX) * 180) / Math.PI +
        180;
      if (typeof (vfx as any).spawnFlameTrailBurst === "function") {
        (vfx as any).spawnFlameTrailBurst(targetX, targetY, flameDir, 4);
      }
      if (typeof (vfx as any).addFireTrailStamp === "function") {
        (vfx as any).addFireTrailStamp(targetX, targetY, 52, 180);
      }
      try {
        engine?.applyBurnInRadius(targetX, targetY, 52, 4.5, 850, 3.2);
      } catch {
        void 0;
      }
    };

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

      // update current mouse position
      currentMouseRef.current = { x: event.clientX, y: event.clientY };

      const holdWeaponId = selectedWeaponIdRef.current;
      const holdWeaponDef =
        WEAPON_DEFS.find((w) => w.id === holdWeaponId) ?? WEAPON_DEFS[0];

      if (holdWeaponDef.inputMode === "hold") {
        // start continuous firing while mouse is held
        if (isFiringRef.current) return;
        isFiringRef.current = true;
        // ── New-path seam: registered hold-weapon plugin ──────────────────
        if (hasEntry(holdWeaponId)) {
          const _hp = hammerPositionRef;
          const _resolveHoldCtx = (
            clientX: number,
            clientY: number,
          ): { wCtx: WeaponContext; eCtx: ExecutionContext } => {
            const _pos = _hp?.current ?? { x: 0, y: 0 };
            const _hasLive =
              _hp != null &&
              Number.isFinite(_pos.x) &&
              Number.isFinite(_pos.y) &&
              (_pos.x !== 0 || _pos.y !== 0);
            const _vx = _hasLive ? _pos.x : clientX;
            const _vy = _hasLive ? _pos.y : clientY;
            const _b = boundsRef.current;
            const wCtx: WeaponContext = {
              targetX: _vx - _b.left,
              targetY: _vy - _b.top,
              centerX: _b.width / 2,
              centerY: _b.height / 2,
              canvasWidth: _b.width,
              canvasHeight: _b.height,
              viewportX: _vx,
              viewportY: _vy,
              bounds: _b,
              now: performance.now(),
              engine: swarmRef.current as unknown as WeaponContext["engine"],
              tier: getWeaponTier(holdWeaponId),
              weaponId: holdWeaponId,
            };
            const eCtx: ExecutionContext = {
              engine: swarmRef.current as unknown as ExecutionContext["engine"],
              vfx: vfxRef.current,
              canvas: canvasRef.current,
              bounds: _b,
              viewportX: _vx,
              viewportY: _vy,
              weaponId: holdWeaponId,
              onHit: (p) => onHitRef.current(p as any),
              updateQaLastHit: (p) => updateQaLastHit(p as any),
              enqueueOverlay: (wid, evx, evy, extras) =>
                onWeaponFireRef.current?.(wid, evx, evy, extras as any),
              blackHoleVfxIdRef,
            };
            return { wCtx, eCtx };
          };
          const { wCtx: _initWCtx, eCtx: _initECtx } = _resolveHoldCtx(
            event.clientX,
            event.clientY,
          );
          const _holdSession = getEntry(holdWeaponId)!.createSession(_initWCtx);
          if (_holdSession.mode === "hold") {
            lastFireTimeRef.current[holdWeaponId] = performance.now();
            executeCommands(_holdSession.begin(_initWCtx), _initECtx);
            lastPaintPosRef.current = {
              x: event.clientX,
              y: event.clientY,
            };
            const _hMoveHandler = (ev: MouseEvent) => {
              currentMouseRef.current = { x: ev.clientX, y: ev.clientY };
              if (_holdSession.paint) {
                const { wCtx: _pw, eCtx: _pe } = _resolveHoldCtx(
                  ev.clientX,
                  ev.clientY,
                );
                executeCommands(_holdSession.paint(_pw), _pe);
              }
            };
            window.addEventListener("mousemove", _hMoveHandler);
            const _tickCooldown = Math.max(
              60,
              getEntry(holdWeaponId)!.config.cooldownMs ?? 120,
            );
            let _rafId = 0;
            const _rafTick = () => {
              if (!isFiringRef.current) return;
              const _m = currentMouseRef.current;
              const _now = performance.now();
              const _last = lastFireTimeRef.current[holdWeaponId] ?? 0;
              if (_m && _now - _last >= _tickCooldown) {
                lastFireTimeRef.current[holdWeaponId] = _now;
                const { wCtx: _tw, eCtx: _te } = _resolveHoldCtx(_m.x, _m.y);
                executeCommands(_holdSession.tick(_tw), _te);
              }
              _rafId = window.requestAnimationFrame(_rafTick);
            };
            _rafId = window.requestAnimationFrame(_rafTick);
            fireIntervalRef.current = _rafId as unknown as number;
            const _hUpHandler = () => {
              isFiringRef.current = false;
              _holdSession.end();
              if (fireIntervalRef.current) {
                window.cancelAnimationFrame(fireIntervalRef.current);
                fireIntervalRef.current = null;
              }
              lastPaintPosRef.current = null;
              window.removeEventListener("mousemove", _hMoveHandler);
              window.removeEventListener("mouseup", _hUpHandler);
            };
            window.addEventListener("mouseup", _hUpHandler);
            return;
          }
          isFiringRef.current = false; // plugin did not return a hold session
        }
        // ── End new-path seam ──────────────────────────────────────────────
        // update mouse on move
        const moveHandler = (ev: MouseEvent) => {
          currentMouseRef.current = { x: ev.clientX, y: ev.clientY };
          if (holdWeaponId !== "flame") {
            return;
          }
          const prev = lastPaintPosRef.current ?? {
            x: ev.clientX,
            y: ev.clientY,
          };
          const dx = ev.clientX - prev.x;
          const dy = ev.clientY - prev.y;
          const dist = Math.hypot(dx, dy);
          const spacing = 8;
          const steps = Math.max(1, Math.ceil(dist / spacing));
          for (let s = 1; s <= steps; s++) {
            const t = s / steps;
            const ix = Math.round(prev.x + dx * t);
            const iy = Math.round(prev.y + dy * t);
            paintFlameAt(ix, iy);
          }
          lastPaintPosRef.current = { x: ev.clientX, y: ev.clientY };
        };
        window.addEventListener("mousemove", moveHandler);
        // fire immediately, then drive continuous firing via RAF to keep up with fast mouse movement
        fireAt(event.clientX, event.clientY);
        lastPaintPosRef.current = { x: event.clientX, y: event.clientY };
        const cooldown = Math.max(60, holdWeaponDef.cooldownMs ?? 120);
        let rafId = 0;
        const rafTick = () => {
          if (!isFiringRef.current) return;
          const m = currentMouseRef.current;
          const now = performance.now();
          const last = lastFireTimeRef.current[holdWeaponId] ?? 0;
          if (m && now - last >= cooldown) {
            fireAt(m.x, m.y);
          }
          rafId = window.requestAnimationFrame(rafTick);
        };
        rafId = window.requestAnimationFrame(rafTick);
        fireIntervalRef.current = rafId as unknown as number;

        const upHandler = () => {
          isFiringRef.current = false;
          if (fireIntervalRef.current) {
            window.cancelAnimationFrame(fireIntervalRef.current);
            fireIntervalRef.current = null;
          }
          lastPaintPosRef.current = null;
          window.removeEventListener("mousemove", moveHandler);
          window.removeEventListener("mouseup", upHandler);
        };
        window.addEventListener("mouseup", upHandler);
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

      // ── New-path seam: delegated to registered weapon plugin ──────────
      if (hasEntry(weaponId)) {
        const _np_wCtx: WeaponContext = {
          targetX,
          targetY,
          centerX: bounds.width / 2,
          centerY: bounds.height / 2,
          canvasWidth: bounds.width,
          canvasHeight: bounds.height,
          viewportX: fireX,
          viewportY: fireY,
          bounds,
          now: performance.now(),
          engine: engine as unknown as WeaponContext["engine"],
          tier: getWeaponTier(weaponId),
          weaponId,
        };
        const _np_eCtx: ExecutionContext = {
          engine: engine as unknown as ExecutionContext["engine"],
          vfx: vfxRef.current,
          canvas: canvasRef.current,
          bounds,
          viewportX: fireX,
          viewportY: fireY,
          weaponId,
          onHit: (p) => onHitRef.current(p as any),
          updateQaLastHit: (p) => updateQaLastHit(p as any),
          enqueueOverlay: (wid, evx, evy, extras) =>
            onWeaponFireRef.current?.(wid, evx, evy, extras as any),
          blackHoleVfxIdRef,
        };
        const _np_session = getEntry(weaponId)!.createSession(_np_wCtx);
        if (_np_session.mode === "once") {
          executeCommands(_np_session.commands, _np_eCtx);
        } else if (_np_session.mode === "persistent") {
          executeCommands(
            (_np_session as PersistentFireSession).begin(_np_wCtx),
            _np_eCtx,
          );
        }
        return;
      }
      // ── End new-path seam ─────────────────────────────────────────────

      // ── Pixi VFX dispatch ─────────────────────────────────────────────
      if (vfxRef.current) {
        const vfx = vfxRef.current;
        const coneAngle =
          (Math.atan2(centerY - targetY, centerX - targetX) * 180) / Math.PI;
        switch (weaponId) {
          case "flame": {
            const flameDir = coneAngle + 180;
            // Remove long-distance flame projectiles and char-ring; rely on emitter-based patch
            // small local ember burst to emphasize impact
            if (typeof (vfx as any).spawnFlameTrailBurst === "function") {
              (vfx as any).spawnFlameTrailBurst(targetX, targetY, flameDir, 10);
            }
            // persistent flame patch (short-lived — 1s)
            vfx.addFirePatch(targetX, targetY, 90, 700);
            try {
              engine.applyBurnInRadius(
                targetX,
                targetY,
                90,
                weaponDef.burnDps ?? 6,
                weaponDef.burnDurationMs ?? 1200,
                weaponDef.burnDecayPerSecond ?? 3.2,
              );
            } catch {
              void 0;
            }
            break;
          }
          case "zapper": {
            // Bug Spray: lingering toxic cloud with aerosol particles, no SVG cone
            const sprayAngle =
              (Math.atan2(centerY - targetY, centerX - targetX) * 180) /
              Math.PI;
            vfx.spawnSprayParticles(targetX, targetY, sprayAngle + 180, 50);
            vfx.addToxicCloud(targetX, targetY, 96, 2400);
            // Apply poison to bugs passing through the cloud periodically
            try {
              const poisonDps = weaponDef.poisonDps ?? 0.5;
              const poisonDurationMs = weaponDef.poisonDurationMs ?? 3000;
              const cloudRadius = 96;
              const cloudMs = 2400;
              // immediate apply once, then periodic ticks while cloud exists
              engine.applyPoisonInRadius(
                targetX,
                targetY,
                cloudRadius,
                poisonDps,
                poisonDurationMs,
              );
              const intervalMs = 400;
              const intId = window.setInterval(() => {
                const eng = swarmRef.current;
                if (!eng) {
                  window.clearInterval(intId);
                  return;
                }
                eng.applyPoisonInRadius(
                  targetX,
                  targetY,
                  cloudRadius,
                  poisonDps,
                  poisonDurationMs,
                );
              }, intervalMs);
              window.setTimeout(
                () => window.clearInterval(intId),
                cloudMs + 50,
              );
            } catch {
              // safe no-op if engine API unavailable
            }
            break;
          }
          case "shockwave": {
            // Static Net: wire mesh + EMP ring
            vfx.spawnNetCast(targetX, targetY, 200, 3000);
            vfx.spawnEMP(targetX, targetY, 200);
            break;
          }
          case "plasma": {
            // Fork Bomb: clustered detonations around the click point
            vfx.spawnPlasmaImplosion(targetX, targetY, 170);
            setTimeout(() => {
              if (vfxRef.current) {
                vfxRef.current.spawnPlasmaFountain(targetX, targetY);
                vfxRef.current.addPlasmaCrater(targetX, targetY);
              }
            }, 400);
            break;
          }
          case "void":
            // Void handled in blackhole dispatch below — skip duplicate VFX here
            break;
          case "laser": {
            // Bouncing disc: burn scars are added per-segment in the line dispatch.
            // Legacy snap-angle beam: add a single scar now.
            if (!weaponDef.bouncingDisc) {
              const laserAngle = weaponDef.snapAngle
                ? Math.round(
                    Math.atan2(centerY - targetY, centerX - targetX) /
                      (Math.PI / 4),
                  ) *
                  (Math.PI / 4)
                : 0;
              const beamLen = Math.max(bounds.width, bounds.height) * 1.5;
              vfx.addBurnScar(
                targetX - Math.cos(laserAngle) * beamLen,
                targetY - Math.sin(laserAngle) * beamLen,
                targetX + Math.cos(laserAngle) * beamLen,
                targetY + Math.sin(laserAngle) * beamLen,
              );
            }
            break;
          }
          case "nullpointer":
            // VFX handled in seeking dispatch at bug position — skip here
            break;
          case "hammer":
            vfx.addCrack(targetX, targetY);
            break;
          case "freeze":
            vfx.spawnExplosion(targetX, targetY, 180, 0x93c5fd);
            if (typeof (vfx as any).spawnSnowflakeDecals === "function") {
              (vfx as any).spawnSnowflakeDecals(targetX, targetY, 24, 200);
            }
            break;
          default:
            break;
        }
      }
      if (canvasRef.current) triggerWeaponShake(canvasRef.current, weaponId);

      if (weaponDef.hitPattern === "point") {
        // ── Hammer: hit nearest bug within radius ────────────────
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
                true,
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
        // ── Laser: bouncing disc or legacy beam ────────────────
        if (weaponDef.bouncingDisc) {
          // Bouncing disc: fire from center toward click, reflect off canvas walls
          const maxBounces = weaponDef.maxBounces ?? 2;
          const discAngle = Math.atan2(targetY - centerY, targetX - centerX);
          const discLen = Math.max(bounds.width, bounds.height) * 2;

          // Build reflected path segments
          const segments: Array<{
            x1: number;
            y1: number;
            x2: number;
            y2: number;
          }> = [];
          let px = centerX,
            py = centerY;
          let dx = Math.cos(discAngle),
            dy = Math.sin(discAngle);
          const W = bounds.width,
            H = bounds.height;

          for (let bounce = 0; bounce <= maxBounces; bounce++) {
            // Find first wall intersection
            let tMin = discLen;
            if (dx > 0) tMin = Math.min(tMin, (W - px) / dx);
            else if (dx < 0) tMin = Math.min(tMin, -px / dx);
            if (dy > 0) tMin = Math.min(tMin, (H - py) / dy);
            else if (dy < 0) tMin = Math.min(tMin, -py / dy);

            const nx = px + dx * tMin;
            const ny = py + dy * tMin;
            segments.push({ x1: px, y1: py, x2: nx, y2: ny });

            if (bounce < maxBounces) {
              // Reflect: determine which wall was hit
              const hitLeft = Math.abs(nx) < 1;
              const hitRight = Math.abs(nx - W) < 1;
              const hitTop = Math.abs(ny) < 1;
              const hitBottom = Math.abs(ny - H) < 1;
              if (hitLeft || hitRight) dx = -dx;
              if (hitTop || hitBottom) dy = -dy;

              // VFX: spark at bounce point
              vfxRef.current?.spawnSparkCrown(nx, ny, 0xf87171);
            }
            px = nx;
            py = ny;
          }

          // Viewport-space segments for WeaponEffectLayer
          const viewportSegments = segments.map((s) => ({
            x1: Math.round(s.x1 + bounds.left),
            y1: Math.round(s.y1 + bounds.top),
            x2: Math.round(s.x2 + bounds.left),
            y2: Math.round(s.y2 + bounds.top),
          }));
          onWeaponFireRef.current?.(weaponId, fireX, fireY, {
            segments: viewportSegments,
          });

          // Hit detection on all segments
          const hitSet = new Set<number>();
          if (typeof engine.lineHitTest === "function") {
            for (const seg of segments) {
              for (const idx of engine.lineHitTest(
                seg.x1,
                seg.y1,
                seg.x2,
                seg.y2,
                weaponDef.hitRadius,
              )) {
                hitSet.add(idx);
              }
            }
          }
          // Add burn scar along each segment
          for (const seg of segments) {
            vfxRef.current?.addBurnScar(seg.x1, seg.y1, seg.x2, seg.y2);
          }
          for (const idx of hitSet) {
            const result = engine.handleHit(idx, weaponDef.damage ?? 1, true);
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
        } else {
          let beamAngleRad = 0;

          if (weaponDef.snapAngle) {
            // Snap angle from click to screen center to nearest 45 degrees
            const rawAngle = Math.atan2(centerY - targetY, centerX - targetX);
            const snapped =
              Math.round(rawAngle / (Math.PI / 4)) * (Math.PI / 4);
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
              const result = engine.handleHit(idx, weaponDef.damage ?? 1, true);
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
        } // end else (legacy beam)
      } else if (weaponDef.hitPattern === "blackhole") {
        // ── Void Pulse: persistent gravity well ─────────────────
        onWeaponFireRef.current?.(weaponId, fireX, fireY);
        const started =
          typeof engine.startBlackHole === "function"
            ? engine.startBlackHole(
                targetX,
                targetY,
                weaponDef.blackHoleRadius ?? 300,
                weaponDef.blackHoleCoreRadius ?? 80,
                weaponDef.blackHoleDurationMs ?? 2000,
                weaponDef.damage ?? 3,
              )
            : false;
        if (started && vfxRef.current) {
          const bhId = vfxRef.current.createBlackHole(targetX, targetY);
          blackHoleVfxIdRef.current = bhId;
        }
      } else if (weaponDef.hitPattern === "area") {
        // ── Pulse / Bomb / Shockwave / Zapper ───────────────────
        onWeaponFireRef.current?.(weaponId, fireX, fireY);

        // Static Net: ensnare all bugs in radius
        if (
          weaponDef.applyEnsnare &&
          typeof engine.applyEnsnareInRadius === "function"
        ) {
          engine.applyEnsnareInRadius(
            targetX,
            targetY,
            weaponDef.hitRadius,
            weaponDef.ensnareDurationMs ?? 3000,
          );
        }

        // Freeze Blast: slow/freeze all bugs in radius
        if (
          weaponDef.appliesSlow &&
          typeof engine.radiusHitTest === "function"
        ) {
          const freezeIdxs = engine.radiusHitTest(
            targetX,
            targetY,
            weaponDef.hitRadius,
          );
          for (const idx of freezeIdxs) {
            const bug = engine.getAllBugs()[idx];
            if (bug && typeof (bug as any).applyFreeze === "function") {
              (bug as any).applyFreeze(0.35, 3500);
            }
          }
        }

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

            const result = engine.handleHit(idx, damage, true);
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
        // ── Flame / Bug Spray: cone spray from click toward center ──────
        const angleDeg =
          (Math.atan2(centerY - targetY, centerX - targetX) * 180) / Math.PI;
        const arcDeg = weaponDef.coneArcDeg ?? 90;
        // Flamethrower fires AWAY from center (coneAngle+180); freeze aims TOWARD center
        const hitAngleDeg =
          weaponId === "flame" || weaponId === "zapper"
            ? angleDeg + 180
            : angleDeg;

        onWeaponFireRef.current?.(weaponId, fireX, fireY, {
          angle: (hitAngleDeg * Math.PI) / 180,
        });

        if (typeof engine.coneHitTest === "function") {
          const hitIndexes = engine.coneHitTest(
            targetX,
            targetY,
            hitAngleDeg,
            arcDeg,
            weaponDef.hitRadius,
          );
          for (const idx of hitIndexes) {
            const result = engine.handleHit(idx, weaponDef.damage ?? 0, true);
            if (!result) continue;

            const bug = engine.getAllBugs()[idx];
            // Apply slow/freeze
            if (weaponDef.appliesSlow && bug) {
              if (typeof (bug as any).applyFreeze === "function") {
                (bug as any).applyFreeze(0.35, 3500);
              }
            }
            // Apply poison (Bug Spray)
            if (weaponDef.applyPoison && bug) {
              if (typeof (bug as any).applyPoison === "function") {
                (bug as any).applyPoison(
                  weaponDef.poisonDps ?? 0.5,
                  weaponDef.poisonDurationMs ?? 4000,
                );
              }
            }
            if (weaponDef.applyBurn && bug) {
              const distance = Math.hypot(bug.x - targetX, bug.y - targetY);
              const normalized = distance / Math.max(1, weaponDef.hitRadius);
              const intensity =
                0.2 + 0.8 * Math.exp(-3.2 * normalized * normalized);
              if (typeof (bug as any).applyBurn === "function") {
                (bug as any).applyBurn(
                  (weaponDef.burnDps ?? 6) * intensity,
                  weaponDef.burnDurationMs ?? 1200,
                  weaponDef.burnDecayPerSecond ?? 3.2,
                );
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

        // Prefer unfrozen targets for chain bounces
        const chainFn =
          typeof engine.chainHitTestPreferUnfrozen === "function"
            ? engine.chainHitTestPreferUnfrozen.bind(engine)
            : typeof engine.chainHitTest === "function"
              ? engine.chainHitTest.bind(engine)
              : null;
        const chainIndexes = chainFn
          ? [
              hitCandidate.index,
              ...chainFn(
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
        // Spawn Pixi lightning + spark crown at each bounce node
        if (vfxRef.current && chainIndexes.length > 0) {
          const canvasNodes = chainIndexes
            .map((idx) => {
              const b = engine.getAllBugs()[idx];
              return b ? { x: b.x, y: b.y } : null;
            })
            .filter(Boolean) as Array<{ x: number; y: number }>;
          if (canvasNodes.length > 0) {
            vfxRef.current.spawnLightning(
              [{ x: targetX, y: targetY }, ...canvasNodes],
              1200,
              0x6ee7b7,
            );
            // Spark crown at every bounce node
            for (const node of canvasNodes) {
              vfxRef.current.spawnSparkCrown(node.x, node.y, 0x6ee7b7);
            }
          }
        }

        for (const idx of chainIndexes) {
          const result = engine.handleHit(idx, weaponDef.damage ?? 1, true);
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
          // Null pointer VFX fires at the actual bug position (not cursor)
          if (weaponId === "nullpointer" && vfxRef.current && seekTargetBug) {
            vfxRef.current.spawnExplosion(
              seekTargetBug.x,
              seekTargetBug.y,
              120,
              0xfb7185,
            );
            vfxRef.current.spawnBinaryBurst(seekTargetBug.x, seekTargetBug.y);
          }
          const result = engine.handleHit(
            targetIdx,
            weaponDef.damage ?? 1,
            true,
          );
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
                  const sr = engine.handleHit(idx, 1, true);
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
  }, [hammerPositionRef, terminatorMode]);

  return (
    <>
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full opacity-96"
        aria-hidden="true"
      />
      <VfxCanvas ref={vfxRef} />
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
    phase: "absorbing" | "pulling" | "done" | "failed";
    variant: string;
    bugX: number;
    bugY: number;
    srcX?: number;
    srcY?: number;
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
  /** Returns the current evolution tier for a given weapon. Defaults to T1 when not provided. */
  getWeaponTier?: (id: SiegeWeaponId) => import("@game/types").WeaponTier;
  /** Called when a weapon evolves to a new tier. */
  onWeaponEvolution?: (
    weaponId: SiegeWeaponId,
    newTier: import("@game/types").WeaponTier,
  ) => void;
  /** Initial evolution states loaded from localStorage. */
  initialEvolutionStates?: Partial<
    Record<SiegeWeaponId, import("@game/types").WeaponEvolutionState>
  >;
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
  selectedWeaponId = "hammer",
  showParticleCount,
  showTerminatorStatusBadge = true,
  siegeZones = [],
  terminatorMode,
  gameConfig,
  tone,
  getWeaponTier = () => 1 as import("@game/types").WeaponTier,
  onWeaponEvolution,
  initialEvolutionStates,
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
  const [hammerSwing, setHammerSwing] = useState(false);
  const [cursorLastFireTimes, setCursorLastFireTimes] = useState<
    Partial<Record<SiegeWeaponId, number>>
  >({});
  const [turretLastFireTimes, setTurretLastFireTimes] = useState<
    Record<string, number>
  >({});
  const [teslaLastFireTimes, setTeslaLastFireTimes] = useState<
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
    const timeoutId = window.setTimeout(() => {
      setCursorLastFireTimes({});
      setTurretLastFireTimes({});
      setTeslaLastFireTimes({});
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
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

  const handleTeslaFire = useCallback((data: { structureId: string }) => {
    setTeslaLastFireTimes((prev) => ({
      ...prev,
      [data.structureId]: performance.now(),
    }));
  }, []);

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
      let startedAt = performance.now();

      // Weapons that already have upgraded Pixi VFX should not also render the
      // legacy overlay effect, otherwise both old and new visuals stack.
      if (OVERLAY_EFFECT_WEAPONS.has(weapon)) {
        const event = createEffectEvent(weapon, x, y, extras);
        startedAt = event.startedAt;
        setWeaponEffects((prev) => {
          const now = performance.now();
          return [...prev.filter((e) => isEffectAlive(e, now)), event];
        });
      }

      setCursorLastFireTimes((prev) => ({
        ...prev,
        [weapon]: startedAt,
      }));
      // Always swing hammer cursor on any hammer fire (hit or miss)
      if (weapon === "hammer") {
        setHammerSwing(true);
      }
      // Notify parent so it can update reload bar state
      onWeaponFiredRef.current?.(weapon, startedAt);
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
      const timeoutId = window.setTimeout(() => {
        setWeaponEffects([]);
      }, 0);

      return () => {
        window.clearTimeout(timeoutId);
      };
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
  }, [terminatorMode, weaponEffects.length, hammerPositionRef]);

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
    (
      x: number,
      y: number,
      variant: string,
      meta: { credited: boolean; frozen: boolean; pointValue: number },
    ) => {
      if (meta.credited) {
        return;
      }

      onTerminatorHit?.({
        defeated: true,
        remainingHp: 0,
        variant: variant as BugVariant,
        x,
        y,
        pointValue: meta.pointValue,
        frozen: meta.frozen,
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
        onTeslaFire={terminatorMode ? handleTeslaFire : undefined}
        placingStructureId={terminatorMode ? placingStructureId : null}
        onStructurePlace={terminatorMode ? onStructurePlace : undefined}
        selectedWeaponId={selectedWeaponId}
        onWeaponFire={terminatorMode ? handleWeaponFire : undefined}
        hammerPositionRef={hammerPositionRef}
        getWeaponTier={getWeaponTier}
        onWeaponEvolution={onWeaponEvolution}
        initialEvolutionStates={initialEvolutionStates}
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
          teslaLastFireTimes={teslaLastFireTimes}
        />
      ) : null}
      {terminatorMode ? (
        <WeaponCursor
          hideSystemCursor={
            selectedWeaponId === "hammer" || !!placingStructureId
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
