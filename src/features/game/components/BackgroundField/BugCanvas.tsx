import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getBugVariantMaxHp } from "../../../../constants/bugs";
import Engine from "@game/engine/Engine";
import { getCodex } from "@game/engine/bugCodex";
import type { GameConfig } from "@game/engine/types";
import { DEFAULT_GAME_CONFIG } from "@game/engine/types";
import { drawBugSprite } from "@game/utils/bugSprite";
import type {
  SiegeCombatStats,
  SiegeWeaponId,
  SiegeZoneRect,
  StructureId,
} from "@game/types";
import type {
  BugCounts,
  BugVariant,
  BugVisualSettings,
  ChartFocusState,
  MotionProfile,
  SceneProfile,
} from "../../../../types/dashboard";
import { WEAPON_DEFS } from "@config/weaponConfig";
import { drawHealthBar, HEALTHBAR_SHOW_DURATION } from "@game/utils/healthbar";
import VfxCanvas from "@game/components/VfxCanvas";
import type { VfxEngine } from "@game/engine/VfxEngine";
import type {
  WeaponContext,
  ExecutionContext,
  PersistentFireSession,
} from "@game/weapons/runtime/types";
import { getEntry, hasEntry } from "@game/weapons/runtime/registry";
import { executeCommands } from "@game/weapons/runtime/executor";
import type { BugHitPayload, RenderedBugPosition } from "./types";
import {
  updateQaBugPositions,
  syncQaBugPositionsFromEngine,
  updateQaLastHit,
  stabilizeQaEngine,
} from "./qa";

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
  onWeaponEvolutionStatesChange?: (
    states: Map<SiegeWeaponId, import("@game/types").WeaponEvolutionState>,
  ) => void;
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
  onAgentAbsorb,
  onTurretFire,
  onTeslaFire,
  gameConfig,
  hammerPositionRef,
  getWeaponTier = () => 1 as import("@game/types").WeaponTier,
  onWeaponEvolutionStatesChange,
  onWeaponEvolution,
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
  const onTurretFireRef = useRef(onTurretFire);
  const onTeslaFireRef = useRef(onTeslaFire);
  const onWeaponFireRef = useRef(onWeaponFire);
  const onWeaponEvolutionStatesChangeRef = useRef(
    onWeaponEvolutionStatesChange,
  );
  const getWeaponTierRef = useRef(getWeaponTier);
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

  useEffect(() => {
    interactiveModeRef.current = interactiveMode;
    onWeaponEvolutionStatesChangeRef.current = onWeaponEvolutionStatesChange;
    getWeaponTierRef.current = getWeaponTier;
    streakMultiplierRef.current = streakMultiplier;
    motionProfileRef.current = motionProfile;
    sceneProfileRef.current = sceneProfile;
    chartFocusRef.current = chartFocus;
    onHitRef.current = onHit;
    onEntityDeathRef.current = onEntityDeath;
    onStructureKillRef.current = onStructureKill;
    onAgentAbsorbRef.current = onAgentAbsorb;
    onTurretFireRef.current = onTurretFire;
    onTeslaFireRef.current = onTeslaFire;
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
    onTeslaFire,
    onTurretFire,
    onWeaponEvolutionStatesChange,
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
    // Note: interactiveMode is intentionally excluded from this dep array.
    // Removing it prevents the engine from being destroyed and recreated when
    // siege mode activates, giving a seamless visual transition.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionKey, gameConfigKey, getLocalSiegeZones]);

  useEffect(() => {
    const bugs = (swarmRef.current?.getAllBugs() ?? []) as Array<any>;
    hitPointsRef.current = new Map(
      bugs.map((b: any, i: number) => [i, getBugVariantMaxHp(b.variant)]),
    );
  }, [sessionKey]);

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

    const handlePointerDown = (event: MouseEvent) => {
      if (!interactiveModeRef.current) {
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
              tier: getWeaponTierRef.current(holdWeaponId),
              weaponId: holdWeaponId,
            };
            const eCtx: ExecutionContext = {
              engine: swarmRef.current as unknown as ExecutionContext["engine"],
              vfx: vfxRef.current,
              damageMultiplier: streakMultiplierRef.current,
              canvas: canvasRef.current,
              bounds: _b,
              viewportX: _vx,
              viewportY: _vy,
              weaponId: holdWeaponId,
              onHit: (p) => {
                onHitRef.current(p as any);
                if (p.defeated) {
                  syncWeaponEvolutionStates();
                }
              },
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

        // hold weapon not registered or session was not hold mode — exit hold branch
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

      const engine = swarmRef.current;
      if (!engine) return;

      // All click weapons are registered; route through weapon plugin system.
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
          tier: getWeaponTierRef.current(weaponId),
          weaponId,
        };
        const _np_eCtx: ExecutionContext = {
          engine: engine as unknown as ExecutionContext["engine"],
          vfx: vfxRef.current,
          damageMultiplier: streakMultiplierRef.current,
          canvas: canvasRef.current,
          bounds,
          viewportX: fireX,
          viewportY: fireY,
          weaponId,
          onHit: (p) => {
            onHitRef.current(p as any);
            if (p.defeated) {
              syncWeaponEvolutionStates();
            }
          },
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
  }, [hammerPositionRef, syncWeaponEvolutionStates]);

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

export default BugCanvas;
