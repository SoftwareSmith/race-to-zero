import Engine from "@game/engine/Engine";
import {
  createPreferredPhysicsAdapter,
  type PhysicsAdapter,
} from "@game/engine/physicsAdapter";
import type { GameConfig } from "@game/engine/types";
import { DEFAULT_GAME_CONFIG } from "@game/engine/types";
import { isTerminalEntityState } from "@game/types";
import type {
  SiegeWeaponId,
  WeaponEvolutionState,
  WeaponTier,
} from "@game/types";
import type { SiegeStatusId } from "@game/status/statusCatalog";
import type { BugCounts } from "../../../../types/dashboard";
import {
  reseedClusteredBugs,
  type CanvasBounds,
  type ReseedInfo,
} from "./canvasState";
import {
  isQaSessionEnabled,
  preloadQaRuntime,
  recordQaDurationSample,
  stabilizeQaEngine,
  syncQaBugPositionsFromEngine,
  syncQaBugTelemetryFromEngine,
  updateQaBugPositions,
  updateQaBugTelemetry,
} from "./qaLoader";
import type { BugTransitionSnapshotItem, RenderedBugPosition } from "./types";
import type { SiegeZoneRect } from "@game/types";

type SiegeZoneLocalRect = Pick<SiegeZoneRect, "height" | "left" | "top" | "width">;

type QaWindowState = {
  __bugCanvasBindingOwner?: object;
  bugTelemetry?: Array<any>;
  clearLiveBugs?: () => number;
  enabled?: boolean;
  getLiveBugCount?: () => number;
  getLiveBugTelemetry?: () => Array<any>;
  repositionLiveBug?: (request: {
    heading?: number;
    index: number;
    vx?: number;
    vy?: number;
    x: number;
    y: number;
  }) => boolean;
};

type QaWindow = Window & { __RTZ_QA__?: QaWindowState };

function getActiveBugCount(bugs: Array<any> | undefined | null) {
  if (!bugs?.length) {
    return 0;
  }

  return bugs.reduce((count, bug) => {
    return isTerminalEntityState(bug?.state) ? count : count + 1;
  }, 0);
}

export interface SetupBugCanvasEngineOptions {
  bugCounts: BugCounts;
  bounds: CanvasBounds;
  canvas: HTMLCanvasElement;
  gameConfig?: GameConfig;
  getLocalSiegeZones: () => SiegeZoneLocalRect[];
  height: number;
  initialEvolutionStates?: Partial<Record<SiegeWeaponId, WeaponEvolutionState>>;
  interactiveMode: boolean;
  latestBugPositionsRef: { current: RenderedBugPosition[] };
  maxWeaponTier?: WeaponTier;
  notifyPhysicsBackendChange?: (backendId: string) => void;
  notifyWeaponEvolution?: (weaponId: SiegeWeaponId, newTier: WeaponTier) => void;
  onEntityDeath: (
    x: number,
    y: number,
    variant: string,
    meta: {
      credited: boolean;
      finisherStatus?: SiegeStatusId | null;
      frozen: boolean;
      pointValue: number;
      supportStatuses?: SiegeStatusId[];
    },
  ) => void;
  onLiveBugCountChange?: (count: number) => void;
  reseedSpeedMultiplier: number;
  syncWeaponEvolutionStates: () => void;
  consumeTransitionSwarm?: () => Engine | null;
  transitionSnapshot?: BugTransitionSnapshotItem[] | null;
  transitionSwarm?: Engine | null;
  width: number;
}

export interface SetupBugCanvasEngineResult {
  engine: Engine;
  physicsAdapter: PhysicsAdapter;
  reseedInfo: ReseedInfo | null;
}

export async function setupBugCanvasEngine(
  options: SetupBugCanvasEngineOptions,
): Promise<SetupBugCanvasEngineResult> {
  const qaEnabled = isQaSessionEnabled();
  const qaPreloadPromise = qaEnabled ? preloadQaRuntime() : null;
  const physicsAdapter = await createPreferredPhysicsAdapter(options.interactiveMode);
  await qaPreloadPromise;
  options.notifyPhysicsBackendChange?.(physicsAdapter.id);

  const transitionSwarm =
    options.consumeTransitionSwarm?.() ?? options.transitionSwarm ?? null;

  if (transitionSwarm) {
    const engine = transitionSwarm;

    engine.canvas = options.canvas;
    const context = options.canvas.getContext("2d", { alpha: true });
    if (!context) {
      throw new Error("Canvas 2D context not available");
    }

    engine.ctx = context;
    engine.setSize(options.width, options.height);
    engine.onEntityDeath = options.onEntityDeath;
    engine.onWeaponEvolution = (weaponId, newTier) => {
      options.notifyWeaponEvolution?.(weaponId, newTier);
    };
    (engine as any).onPerformanceSample = (sample: {
      entityUpdateMs: number;
      evolutionMs: number;
      spatialGridMs: number;
      totalMs: number;
    }) => {
      if (qaEnabled) {
        recordQaDurationSample("engineUpdateMs", sample.totalMs);
        recordQaDurationSample("engineGridMs", sample.spatialGridMs);
        recordQaDurationSample("engineEntityMs", sample.entityUpdateMs);
        recordQaDurationSample("engineEvolutionMs", sample.evolutionMs);
      }
    };
    if (options.maxWeaponTier != null) {
      (engine as any).maxWeaponTier = options.maxWeaponTier;
    }
    if (options.initialEvolutionStates) {
      for (const [weaponId, state] of engine.weaponEvolutionStates.entries()) {
        const initialState = options.initialEvolutionStates[weaponId];
        if (!initialState) {
          continue;
        }

        state.kills = initialState.kills;
        state.tier = initialState.tier;
      }
    }
    try {
      (engine as any).__baseSpeedOriginal ??= engine.config.baseSpeed;
    } catch {
      void 0;
    }

    if (qaEnabled) {
      stabilizeQaEngine(engine, options.width, options.height);
      syncQaBugPositionsFromEngine(engine, options.bounds);
      syncQaBugTelemetryFromEngine(engine, options.bounds);
    }
    options.syncWeaponEvolutionStates();

    return {
      engine,
      physicsAdapter,
      reseedInfo: null,
    };
  }

  const engine = new Engine(options.canvas, {
    width: options.width,
    height: options.height,
    config: options.gameConfig,
    maxWeaponTier: options.maxWeaponTier,
    onPerformanceSample: (sample) => {
      if (qaEnabled) {
        recordQaDurationSample("engineUpdateMs", sample.totalMs);
        recordQaDurationSample("engineGridMs", sample.spatialGridMs);
        recordQaDurationSample("engineEntityMs", sample.entityUpdateMs);
        recordQaDurationSample("engineEvolutionMs", sample.evolutionMs);
      }
    },
    onEntityDeath: options.onEntityDeath,
    onWeaponEvolution: (weaponId, newTier) => {
      options.notifyWeaponEvolution?.(weaponId, newTier);
    },
    initialEvolutionStates: options.initialEvolutionStates,
  });

  try {
    (engine as any).__baseSpeedOriginal = engine.config.baseSpeed;
  } catch {
    void 0;
  }

  if (options.interactiveMode && options.transitionSnapshot?.length) {
    engine.spawnFromSnapshot(options.transitionSnapshot);
  } else {
    engine.spawnFromCounts(
      options.bugCounts as any,
      options.interactiveMode ? options.getLocalSiegeZones() : [],
    );
  }

  if (qaEnabled) {
    stabilizeQaEngine(engine, options.width, options.height);
    syncQaBugPositionsFromEngine(engine, options.bounds);
    syncQaBugTelemetryFromEngine(engine, options.bounds);
  }

  const reseedInfo = reseedClusteredBugs(
    engine.getAllBugs() as Array<any>,
    options.width,
    options.height,
    options.reseedSpeedMultiplier,
    {
      baseSpeed:
        (engine as any)?.__baseSpeedOriginal ?? DEFAULT_GAME_CONFIG.baseSpeed,
      thresholdRatio: 0.25,
    },
  );

  options.syncWeaponEvolutionStates();

  return {
    engine,
    physicsAdapter,
    reseedInfo,
  };
}

export function installBugCanvasQaBindings({
  bounds,
  engine,
  height,
  latestBugPositionsRef,
  onLiveBugCountChange,
  width,
}: {
  bounds: CanvasBounds;
  engine: Engine;
  height: number;
  latestBugPositionsRef: { current: RenderedBugPosition[] };
  onLiveBugCountChange?: (count: number) => void;
  width: number;
}) {
  const bindingOwner = {};

  if (typeof window === "undefined") {
    return bindingOwner;
  }

  const qaState = (window as QaWindow).__RTZ_QA__;

  if (!qaState?.enabled) {
    return bindingOwner;
  }

  qaState.__bugCanvasBindingOwner = bindingOwner;
  qaState.getLiveBugCount = () =>
    getActiveBugCount(engine.getAllBugs() as Array<any>);
  qaState.getLiveBugTelemetry = () => qaState.bugTelemetry ?? [];
  qaState.clearLiveBugs = () => {
    const clearedCount = engine.clearAllBugs();
    latestBugPositionsRef.current = [];
    onLiveBugCountChange?.(0);
    updateQaBugPositions([], bounds);
    updateQaBugTelemetry([], bounds);
    return clearedCount;
  };
  qaState.repositionLiveBug = ({ heading, index, vx, vy, x, y }) => {
    const liveBugs = engine.getAllBugs() as Array<any>;
    const bug = liveBugs[index];

    if (!bug || isTerminalEntityState(bug.state)) {
      return false;
    }

    bug.x = x;
    bug.y = y;
    bug.prevX = x;
    bug.prevY = y;

    if (typeof vx === "number") {
      bug.vx = vx;
    }
    if (typeof vy === "number") {
      bug.vy = vy;
    }
    if (typeof heading === "number") {
      bug.heading = heading;
      bug.wanderAngle = heading;
    }

    bug.motionTime = 0;
    bug.cruiseSpeed = 0;
    bug.roamTargetX = x;
    bug.roamTargetY = y;
    bug.nextRoamTargetAt = performance.now() + 500;
    bug.movementMood = "patrol";

    if (x >= 0 && x <= width && y >= 0 && y <= height) {
      bug.hasEnteredField = true;
    }
    if ("roamTargetX" in bug) {
      bug.roamTargetX = null;
    }
    if ("roamTargetY" in bug) {
      bug.roamTargetY = null;
    }

    syncQaBugPositionsFromEngine(engine, bounds);
    syncQaBugTelemetryFromEngine(engine, bounds);
    return true;
  };

  return bindingOwner;
}

export function clearBugCanvasQaBindings(bindingOwner?: object) {
  if (typeof window === "undefined") {
    return;
  }

  const qaState = (window as QaWindow).__RTZ_QA__;

  if (!qaState) {
    return;
  }

  if (bindingOwner && qaState.__bugCanvasBindingOwner !== bindingOwner) {
    return;
  }

  if (qaState?.clearLiveBugs) {
    delete qaState.clearLiveBugs;
  }
  if (qaState?.getLiveBugCount) {
    delete qaState.getLiveBugCount;
  }
  if (qaState?.getLiveBugTelemetry) {
    delete qaState.getLiveBugTelemetry;
  }
  if (qaState?.repositionLiveBug) {
    delete qaState.repositionLiveBug;
  }
  if (qaState.__bugCanvasBindingOwner) {
    delete qaState.__bugCanvasBindingOwner;
  }
}