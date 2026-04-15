import {
  Suspense,
  lazy,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { getBugCountsKey, getBugTotal } from "../../../../constants/bugs";
import {
  getEffectPalette,
  getMotionProfile,
  getSceneProfile,
} from "@game/utils/backgroundScene";
import { cn } from "@shared/utils/cn";
import type {
  AgentCaptureState,
  PlacedStructure,
  SiegeCombatStats,
  SiegeWeaponId,
  SiegeZoneRect,
  StructureId,
  WeaponEffectEvent,
} from "@game/types";
import { WeaponId } from "@game/types";
import type {
  BugCounts,
  BugVisualSettings,
  ChartFocusState,
  Tone,
} from "../../../../types/dashboard";
import WeaponCursor from "@game/components/WeaponCursor";
import { createEffectEvent, isEffectAlive } from "@game/utils/weaponEffects";
import { getWeaponHeatProfile } from "@game/utils/weaponHeat";
import type { GameConfig } from "@game/engine/types";
import BugCanvas from "./BugCanvas";
import type { BugHitPayload, GameState } from "./types";
import { getSplatClassName } from "./splat";

const WeaponEffectLayer = lazy(
  () => import("@game/components/WeaponEffectLayer"),
);
const StructureLayer = lazy(() => import("@game/components/StructureLayer"));

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
  onBugHit?: (payload: BugHitPayload) => void;
  onStructureKill?: (structureId: string) => void;
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
  streakMultiplier?: number;
  siegeZones?: SiegeZoneRect[];
  interactiveMode: boolean;
  tone: Tone;
  gameConfig?: GameConfig;
  /** Returns the current evolution tier for a given weapon. Defaults to T1 when not provided. */
  getWeaponTier?: (id: SiegeWeaponId) => import("@game/types").WeaponTier;
  onWeaponEvolutionStatesChange?: (
    states: Map<SiegeWeaponId, import("@game/types").WeaponEvolutionState>,
  ) => void;
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
  onBugHit,
  onStructureKill,
  onWeaponFired,
  placedStructures,
  agentCaptures,
  onAgentAbsorb,
  placingStructureId,
  remainingBugCount,
  selectedWeaponId = "hammer",
  streakMultiplier = 1,
  siegeZones = [],
  interactiveMode,
  gameConfig,
  tone,
  getWeaponTier = () => 1 as import("@game/types").WeaponTier,
  onWeaponEvolutionStatesChange,
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
    : `${interactiveMode ? "interactive" : "ambient"}:${bugCountsKey}`;
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
  }, [gameSessionKey, interactiveMode]);

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
        segments?: Array<{ x1: number; y1: number; x2: number; y2: number }>;
      },
    ) => {
      const tier = getWeaponTier(weapon);
      const heat = getWeaponHeatProfile(tier);
      const event = createEffectEvent(weapon, x, y, {
        ...extras,
        heatColor: heat.accent,
        heatCore: heat.core,
        heatScale: heat.burstScale,
        heatStage: heat.stage,
      });
      const startedAt = event.startedAt;

      setWeaponEffects((prev) => {
        const now = performance.now();
        return [...prev.filter((e) => isEffectAlive(e, now)), event];
      });

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
    [getWeaponTier],
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
    document.body.classList.toggle("cursor-none", interactiveMode);

    return () => {
      document.body.classList.remove("cursor-none");
    };
  }, [interactiveMode]);

  useEffect(() => {
    if (!interactiveMode) {
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
  }, [interactiveMode, weaponEffects.length, hammerPositionRef]);

  useEffect(() => {
    if (!interactiveMode) {
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
  }, [interactiveMode]);

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
      onBugHit?.(payload);
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
    [gameSessionKey, onBugHit, totalBugCount],
  );

  const handleStructureKill = useCallback(
    (structureId: string, x: number, y: number, variant: string) => {
      onBugHit?.({
        defeated: true,
        remainingHp: 0,
        variant: variant as import("../../../../types/dashboard").BugVariant,
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
              variant:
                variant as import("../../../../types/dashboard").BugVariant,
              x,
              y,
            },
          ],
        };
      });
      onStructureKill?.(structureId);
    },
    [gameSessionKey, onBugHit, onStructureKill, totalBugCount],
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

      onBugHit?.({
        defeated: true,
        remainingHp: 0,
        variant: variant as import("../../../../types/dashboard").BugVariant,
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
              variant:
                variant as import("../../../../types/dashboard").BugVariant,
              x,
              y,
            },
          ],
        };
      });
    },
    [gameSessionKey, onBugHit, totalBugCount],
  );

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
        chartFocus={chartFocus}
        combatStats={combatStats}
        motionProfile={motionProfile}
        onHit={handleBugHit}
        bugCounts={normalizedBugCounts}
        sceneProfile={sceneProfile}
        sessionKey={gameSessionKey}
        siegeZones={siegeZones}
        interactiveMode={interactiveMode}
        gameConfig={gameConfig}
        onEntityDeath={handleEntityDeath}
        onStructureKill={interactiveMode ? handleStructureKill : undefined}
        placedStructures={placedStructures}
        onAgentAbsorb={interactiveMode ? onAgentAbsorb : undefined}
        onTurretFire={interactiveMode ? handleTurretFire : undefined}
        onTeslaFire={interactiveMode ? handleTeslaFire : undefined}
        placingStructureId={interactiveMode ? placingStructureId : null}
        onStructurePlace={interactiveMode ? onStructurePlace : undefined}
        selectedWeaponId={selectedWeaponId}
        streakMultiplier={streakMultiplier}
        onWeaponFire={interactiveMode ? handleWeaponFire : undefined}
        hammerPositionRef={hammerPositionRef}
        getWeaponTier={getWeaponTier}
        onWeaponEvolutionStatesChange={onWeaponEvolutionStatesChange}
        onWeaponEvolution={onWeaponEvolution}
        initialEvolutionStates={initialEvolutionStates}
      />
      {effectiveBugCount === 0 ? (
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(187,247,208,0.12),transparent_28%),radial-gradient(circle_at_60%_68%,rgba(125,211,252,0.08),transparent_34%)] [animation:all-clear-breathe_6s_ease-in-out_infinite]" />
      ) : null}
      {!interactiveMode && bugVisualSettings.showParticleCount ? (
        <div className="pointer-events-none absolute bottom-3 left-3 z-20 rounded-full border border-white/10 bg-black/45 px-2.5 py-1 text-[0.68rem] font-semibold tracking-[0.08em] text-stone-200 backdrop-blur-sm">
          {`${effectiveBugCount.toLocaleString()} bugs rendered`}
        </div>
      ) : null}
      {interactiveMode ? (
        <Suspense fallback={null}>
          <WeaponEffectLayer effects={weaponEffects} />
        </Suspense>
      ) : null}
      {interactiveMode && placedStructures && placedStructures.length > 0 ? (
        <Suspense fallback={null}>
          <StructureLayer
            structures={placedStructures}
            agentCaptures={agentCaptures}
            turretLastFireTimes={turretLastFireTimes}
            teslaLastFireTimes={teslaLastFireTimes}
          />
        </Suspense>
      ) : null}
      {interactiveMode ? (
        <WeaponCursor
          hideSystemCursor={
            selectedWeaponId === "hammer" || !!placingStructureId
          }
          lastFiredAt={cursorLastFireTimes[selectedWeaponId]}
          structureId={placingStructureId ?? undefined}
          weaponTier={getWeaponTier(selectedWeaponId)}
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
    </div>
  );
});

export default BackgroundField;
