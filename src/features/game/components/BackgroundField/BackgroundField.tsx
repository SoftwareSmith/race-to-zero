import {
  Suspense,
  lazy,
  memo,
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { getBugCountsKey, getBugTotal } from "../../../../constants/bugs";
import { cn } from "@shared/utils/cn";
import type {
  SiegeCombatStats,
  SiegeWeaponId,
  SiegeZoneRect,
  WeaponEffectEvent,
} from "@game/types";
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
import { getOverlayRenderer } from "@game/weapons/runtime/registry";
import BugCanvas from "./BugCanvas";
import type {
  BackgroundFieldHandle,
  BugHitPayload,
  BugTransitionSnapshotItem,
} from "./types";
import { getSplatClassName } from "./splat";
import { getBackgroundSceneConfig } from "./sceneConfig";
import { useWeaponCursorState } from "./useWeaponCursorState";
import { useWeaponFireTimes } from "./useWeaponFireTimes";
import { useBackgroundGameState } from "./useBackgroundGameState";

const WeaponEffectLayer = lazy(
  () => import("@game/components/WeaponEffectLayer"),
);

interface BackgroundFieldProps {
  bugCounts: BugCounts;
  bugVisualSettings: BugVisualSettings;
  chartFocus: ChartFocusState | null;
  className?: string;
  combatStats?: SiegeCombatStats | null;
  interactiveSessionKey?: string | null;
  onBugHit?: (payload: BugHitPayload) => void;
  onWeaponFired?: (id: SiegeWeaponId, firedAt: number) => void;
  remainingBugCount?: number;
  openBugCount?: number;
  selectedWeaponId?: SiegeWeaponId;
  streakMultiplier?: number;
  siegeZones?: SiegeZoneRect[];
  interactiveMode: boolean;
  tone: Tone;
  gameConfig?: GameConfig;
  /** Returns the current evolution tier for a given weapon. Defaults to T1 when not provided. */
  getWeaponTier?: (id: SiegeWeaponId) => import("@game/types").WeaponTier;
  /** Highest weapon tier allowed for the active game mode. */
  maxWeaponTier?: import("@game/types").WeaponTier;
  onWeaponEvolutionStatesChange?: (
    states: Map<SiegeWeaponId, import("@game/types").WeaponEvolutionState>,
  ) => void;
  /** Called when a weapon evolves to a new tier. */
  onWeaponEvolution?: (
    weaponId: SiegeWeaponId,
    newTier: import("@game/types").WeaponTier,
  ) => void;
  clearSwarmRequestId?: number;
  onLiveBugCountChange?: (count: number) => void;
  /** Initial evolution states loaded from localStorage. */
  initialEvolutionStates?: Partial<
    Record<SiegeWeaponId, import("@game/types").WeaponEvolutionState>
  >;
  transitionSnapshot?: BugTransitionSnapshotItem[] | null;
}

const BackgroundField = memo(
  forwardRef<BackgroundFieldHandle, BackgroundFieldProps>(
    function BackgroundField(
      {
        bugCounts,
        bugVisualSettings,
        chartFocus,
        className = "",
        combatStats = null,
        interactiveSessionKey = null,
        onBugHit,
        onWeaponFired,
        remainingBugCount,
        openBugCount,
        selectedWeaponId = "hammer",
        streakMultiplier = 1,
        siegeZones = [],
        interactiveMode,
        gameConfig,
        tone,
        getWeaponTier = () => 1 as import("@game/types").WeaponTier,
        maxWeaponTier,
        onWeaponEvolutionStatesChange,
        onWeaponEvolution,
        clearSwarmRequestId = 0,
        onLiveBugCountChange,
        initialEvolutionStates,
        transitionSnapshot = null,
      }: BackgroundFieldProps,
      ref,
    ) {
      const normalizedBugCounts = useMemo(() => bugCounts, [bugCounts]);
      const totalBugCount = useMemo(
        () => getBugTotal(normalizedBugCounts),
        [normalizedBugCounts],
      );
      const effectiveBugCount = Math.max(
        0,
        Math.floor(remainingBugCount ?? totalBugCount),
      );
      const displayBugCount = Math.max(
        0,
        Math.floor(openBugCount ?? effectiveBugCount),
      );
      const { colors, motionProfile, sceneProfile } = useMemo(
        () => getBackgroundSceneConfig(tone, effectiveBugCount),
        [effectiveBugCount, tone],
      );
      const bugCountsKey = useMemo(
        () => getBugCountsKey(normalizedBugCounts),
        [normalizedBugCounts],
      );
      const gameSessionKey = interactiveSessionKey
        ? `interactive:${interactiveSessionKey}`
        : `${interactiveMode ? "interactive" : "ambient"}:${bugCountsKey}`;
      const { hammerPositionRef, hammerSwing, triggerHammerSwing } =
        useWeaponCursorState(interactiveMode);
      const bugCanvasRef = useRef<BackgroundFieldHandle | null>(null);
      const { cursorLastFireTimes, recordCursorFire } = useWeaponFireTimes(
        gameSessionKey,
        interactiveMode,
      );
      const [weaponEffects, setWeaponEffects] = useState<WeaponEffectEvent[]>(
        [],
      );
      const onWeaponFiredRef = useRef(onWeaponFired);

      useEffect(() => {
        onWeaponFiredRef.current = onWeaponFired;
      }, [onWeaponFired]);

      useImperativeHandle(
        ref,
        () => ({
          captureTransitionSnapshot: () =>
            bugCanvasRef.current?.captureTransitionSnapshot() ?? [],
        }),
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
            segments?: Array<{
              x1: number;
              y1: number;
              x2: number;
              y2: number;
            }>;
          },
        ) => {
          let startedAt = performance.now();
          if (getOverlayRenderer(weapon)) {
            const tier = getWeaponTier(weapon);
            const heat = getWeaponHeatProfile(tier);
            const event = createEffectEvent(weapon, x, y, {
              ...extras,
              heatColor: heat.accent,
              heatCore: heat.core,
              heatScale: heat.burstScale,
              heatStage: heat.stage,
            });
            startedAt = event.startedAt;

            setWeaponEffects((prev) => {
              const now = performance.now();
              return [...prev.filter((e) => isEffectAlive(e, now)), event];
            });
          }

          recordCursorFire(weapon, startedAt);
          // Always swing hammer cursor on any hammer fire (hit or miss)
          if (weapon === "hammer") {
            triggerHammerSwing(getWeaponTier(weapon));
          }
          // Notify parent so it can update reload bar state
          onWeaponFiredRef.current?.(weapon, startedAt);
        },
        [getWeaponTier, recordCursorFire, triggerHammerSwing],
      );
      const { activeGameState, handleBugHit, handleEntityDeath } =
        useBackgroundGameState({
          gameSessionKey,
          onBugHit,
          totalBugCount,
        });

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
      }, [interactiveMode, weaponEffects.length]);

      return (
        <div
          data-background-field-root="true"
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
            ref={bugCanvasRef}
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
            selectedWeaponId={selectedWeaponId}
            streakMultiplier={streakMultiplier}
            onWeaponFire={interactiveMode ? handleWeaponFire : undefined}
            hammerPositionRef={hammerPositionRef}
            getWeaponTier={getWeaponTier}
            maxWeaponTier={maxWeaponTier}
            clearSwarmRequestId={interactiveMode ? clearSwarmRequestId : 0}
            onLiveBugCountChange={
              interactiveMode ? onLiveBugCountChange : undefined
            }
            onWeaponEvolutionStatesChange={onWeaponEvolutionStatesChange}
            onWeaponEvolution={onWeaponEvolution}
            initialEvolutionStates={initialEvolutionStates}
            transitionSnapshot={transitionSnapshot}
          />
          {effectiveBugCount === 0 ? (
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(187,247,208,0.12),transparent_28%),radial-gradient(circle_at_60%_68%,rgba(125,211,252,0.08),transparent_34%)] [animation:all-clear-breathe_6s_ease-in-out_infinite]" />
          ) : null}
          {!interactiveMode && bugVisualSettings.showParticleCount ? (
            <div className="pointer-events-none absolute bottom-3 left-3 z-20 rounded-full border border-white/10 bg-black/45 px-2.5 py-1 text-[0.68rem] font-semibold tracking-[0.08em] text-stone-200 backdrop-blur-sm">
              <span>{`${displayBugCount.toLocaleString()} open bugs`}</span>
            </div>
          ) : null}
          {interactiveMode ? (
            <Suspense fallback={null}>
              <WeaponEffectLayer effects={weaponEffects} />
            </Suspense>
          ) : null}
          {interactiveMode ? (
            <WeaponCursor
              hideSystemCursor={selectedWeaponId === "hammer"}
              lastFiredAt={cursorLastFireTimes[selectedWeaponId]}
              positionRef={hammerPositionRef}
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
    },
  ),
);

export default BackgroundField;
