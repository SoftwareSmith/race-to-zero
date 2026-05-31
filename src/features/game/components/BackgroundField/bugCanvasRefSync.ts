import type { SiegeCombatStats, SiegeWeaponId, SiegeZoneRect } from "@game/types";
import type { SurvivalSpawnPlan } from "@game/sim/survivalDirector";
import type { GameConfig } from "@game/engine/types";
import type { BugTransitionSnapshotItem } from "./types";
import type { ReseedInfo } from "./canvasState";
import type {
  BugVisualSettings,
  ChartFocusState,
  MotionProfile,
  SceneProfile,
} from "../../../../types/dashboard";

type RefValue<T> = {
  current: T;
};

function clampNumber(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getSpeedMultiplier(chaosMultiplier?: number) {
  return clampNumber(
    Math.pow(Math.max(0.25, chaosMultiplier ?? 1), 0.32),
    0.5,
    1.35,
  );
}

export function getBugCanvasTargetSettings(
  bugVisualSettings?: BugVisualSettings,
) {
  return {
    sizeMultiplier: bugVisualSettings?.sizeMultiplier ?? 1,
    speedMultiplier: getSpeedMultiplier(bugVisualSettings?.chaosMultiplier),
  };
}

interface SyncBugCanvasRefsOptions {
  bugVisualSettings?: BugVisualSettings;
  chartFocus: ChartFocusState | null;
  chartFocusRef: RefValue<ChartFocusState | null>;
  combatStats: SiegeCombatStats | null | undefined;
  combatStatsRef: RefValue<SiegeCombatStats | null>;
  consumeTransitionSwarm?: () => import("@game/engine/Engine").default | null;
  consumeTransitionSwarmRef: RefValue<
    (() => import("@game/engine/Engine").default | null) | undefined
  >;
  gameConfig?: GameConfig;
  gameConfigRef: RefValue<GameConfig | undefined>;
  gamePaused: boolean;
  gamePausedRef: RefValue<boolean>;
  getWeaponTier: (id: SiegeWeaponId) => import("@game/types").WeaponTier;
  getWeaponTierRef: RefValue<
    (id: SiegeWeaponId) => import("@game/types").WeaponTier
  >;
  initialEvolutionStates?: Partial<
    Record<SiegeWeaponId, import("@game/types").WeaponEvolutionState>
  >;
  initialEvolutionStatesRef: RefValue<
    | Partial<Record<SiegeWeaponId, import("@game/types").WeaponEvolutionState>>
    | undefined
  >;
  interactiveMode: boolean;
  interactiveModeRef: RefValue<boolean>;
  motionProfile: MotionProfile;
  motionProfileRef: RefValue<MotionProfile>;
  onCoreBreach?: (payload: { damage: number; variant: string }) => void;
  onCoreBreachRef: RefValue<
    | ((payload: { damage: number; variant: string }) => void)
    | undefined
  >;
  onEntityDeath?: (
    x: number,
    y: number,
    variant: string,
    meta: {
      credited: boolean;
      finisherStatus?:
        | import("@game/status/statusCatalog").SiegeStatusId
        | null;
      frozen: boolean;
      pointValue: number;
      supportStatuses?: import("@game/status/statusCatalog").SiegeStatusId[];
    },
  ) => void;
  onEntityDeathRef: RefValue<
    | ((
        x: number,
        y: number,
        variant: string,
        meta: {
          credited: boolean;
          finisherStatus?:
            | import("@game/status/statusCatalog").SiegeStatusId
            | null;
          frozen: boolean;
          pointValue: number;
          supportStatuses?: import("@game/status/statusCatalog").SiegeStatusId[];
        },
      ) => void)
    | undefined
  >;
  onHit: (payload: import("./types").BugHitPayload) => void;
  onHitRef: RefValue<(payload: import("./types").BugHitPayload) => void>;
  onLiveBugCountChange?: (
    count: number,
    bugCounts?: import("../../../../types/dashboard").BugCounts,
    sourceSessionKey?: string | null,
  ) => void;
  onLiveBugCountChangeRef: RefValue<
    | ((
        count: number,
        bugCounts?: import("../../../../types/dashboard").BugCounts,
        sourceSessionKey?: string | null,
      ) => void)
    | undefined
  >;
  onPhysicsBackendChange?: (backendId: string) => void;
  onPhysicsBackendChangeRef: RefValue<((backendId: string) => void) | undefined>;
  onWeaponEvolutionStatesChange?: (
    states: Map<
      SiegeWeaponId,
      import("@game/types").WeaponEvolutionState
    >,
  ) => void;
  onWeaponEvolutionStatesChangeRef: RefValue<
    | ((
        states: Map<
          SiegeWeaponId,
          import("@game/types").WeaponEvolutionState
        >,
      ) => void)
    | undefined
  >;
  onWeaponFire?: (
    weapon: SiegeWeaponId,
    x: number,
    y: number,
    extras?: {
      angle?: number;
      beamGlowWidth?: number;
      beamWidth?: number;
      chainNodes?: Array<{ x: number; y: number }>;
      chaosScale?: number;
      color?: string;
      impactRadius?: number;
      jagOffsets?: number[];
      reticleRadius?: number;
      segments?: Array<{ x1: number; y1: number; x2: number; y2: number }>;
      shockwaveRadius?: number;
      targetPoints?: Array<{ x: number; y: number }>;
      targetX?: number;
      targetY?: number;
    },
  ) => void;
  onWeaponFireRef: RefValue<
    | ((
        weapon: SiegeWeaponId,
        x: number,
        y: number,
        extras?: {
          angle?: number;
          beamGlowWidth?: number;
          beamWidth?: number;
          chainNodes?: Array<{ x: number; y: number }>;
          chaosScale?: number;
          color?: string;
          impactRadius?: number;
          jagOffsets?: number[];
          reticleRadius?: number;
          segments?: Array<{ x1: number; y1: number; x2: number; y2: number }>;
          shockwaveRadius?: number;
          targetPoints?: Array<{ x: number; y: number }>;
          targetX?: number;
          targetY?: number;
        },
      ) => void)
    | undefined
  >;
  reseedInfo: ReseedInfo | null;
  reseedInfoRef: RefValue<ReseedInfo | null>;
  sceneProfile: SceneProfile;
  sceneProfileRef: RefValue<SceneProfile>;
  selectedWeaponId: SiegeWeaponId;
  selectedWeaponIdRef: RefValue<SiegeWeaponId>;
  sessionKey: string;
  sessionKeyRef: RefValue<string>;
  siegeZones: SiegeZoneRect[];
  siegeZonesRef: RefValue<SiegeZoneRect[]>;
  streakMultiplier: number;
  streakMultiplierRef: RefValue<number>;
  survivalSpawnPlan: (SurvivalSpawnPlan & { sequenceId: number }) | null;
  survivalSpawnPlanRef: RefValue<
    (SurvivalSpawnPlan & { sequenceId: number }) | null
  >;
  targetSettingsRef: RefValue<{ sizeMultiplier: number; speedMultiplier: number }>;
  transitionSnapshot: BugTransitionSnapshotItem[] | null;
  transitionSnapshotRef: RefValue<BugTransitionSnapshotItem[] | null>;
}

export function syncBugCanvasRefs({
  bugVisualSettings,
  chartFocus,
  chartFocusRef,
  combatStats,
  combatStatsRef,
  consumeTransitionSwarm,
  consumeTransitionSwarmRef,
  gameConfig,
  gameConfigRef,
  gamePaused,
  gamePausedRef,
  getWeaponTier,
  getWeaponTierRef,
  initialEvolutionStates,
  initialEvolutionStatesRef,
  interactiveMode,
  interactiveModeRef,
  motionProfile,
  motionProfileRef,
  onCoreBreach,
  onCoreBreachRef,
  onEntityDeath,
  onEntityDeathRef,
  onHit,
  onHitRef,
  onLiveBugCountChange,
  onLiveBugCountChangeRef,
  onPhysicsBackendChange,
  onPhysicsBackendChangeRef,
  onWeaponEvolutionStatesChange,
  onWeaponEvolutionStatesChangeRef,
  onWeaponFire,
  onWeaponFireRef,
  reseedInfo,
  reseedInfoRef,
  sceneProfile,
  sceneProfileRef,
  selectedWeaponId,
  selectedWeaponIdRef,
  sessionKey,
  sessionKeyRef,
  siegeZones,
  siegeZonesRef,
  streakMultiplier,
  streakMultiplierRef,
  survivalSpawnPlan,
  survivalSpawnPlanRef,
  targetSettingsRef,
  transitionSnapshot,
  transitionSnapshotRef,
}: SyncBugCanvasRefsOptions) {
  interactiveModeRef.current = interactiveMode;
  gamePausedRef.current = gamePaused;
  onWeaponEvolutionStatesChangeRef.current = onWeaponEvolutionStatesChange;
  getWeaponTierRef.current = getWeaponTier;
  onLiveBugCountChangeRef.current = onLiveBugCountChange;
  onPhysicsBackendChangeRef.current = onPhysicsBackendChange;
  gameConfigRef.current = gameConfig;
  initialEvolutionStatesRef.current = initialEvolutionStates;
  consumeTransitionSwarmRef.current = consumeTransitionSwarm;
  transitionSnapshotRef.current = transitionSnapshot;
  streakMultiplierRef.current = streakMultiplier;
  motionProfileRef.current = motionProfile;
  sceneProfileRef.current = sceneProfile;
  chartFocusRef.current = chartFocus;
  onHitRef.current = onHit;
  onCoreBreachRef.current = onCoreBreach;
  onEntityDeathRef.current = onEntityDeath;
  onWeaponFireRef.current = onWeaponFire;
  selectedWeaponIdRef.current = selectedWeaponId;
  combatStatsRef.current = combatStats ?? null;
  reseedInfoRef.current = reseedInfo;
  siegeZonesRef.current = siegeZones;
  survivalSpawnPlanRef.current = survivalSpawnPlan;
  sessionKeyRef.current = sessionKey;
  targetSettingsRef.current = getBugCanvasTargetSettings(bugVisualSettings);
}