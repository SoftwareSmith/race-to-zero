import { isTerminalEntityState, type SiegeZoneRect } from "@game/types";
import type { SurvivalSpawnPlan } from "@game/sim/survivalDirector";
import {
  createEmptyBugCounts,
  getBugCountsKey,
} from "../../../../constants/bugs";
import type { BugCounts, BugVariant } from "../../../../types/dashboard";
import type { MutableRefObject, RefObject } from "react";
import { isQaSessionEnabled, updateQaBugPositions } from "./qaLoader";
import type { CanvasBounds } from "./canvasState";
import type { RenderedBugPosition } from "./types";

export function getActiveBugCount(bugs: Array<any> | undefined | null) {
  if (!bugs?.length) {
    return 0;
  }

  return bugs.reduce((count, bug) => {
    return isTerminalEntityState(bug?.state) ? count : count + 1;
  }, 0);
}

export function getActiveBugCounts(bugs: Array<any> | undefined | null): BugCounts {
  const counts = createEmptyBugCounts();

  if (!bugs?.length) {
    return counts;
  }

  for (const bug of bugs) {
    if (isTerminalEntityState(bug?.state)) {
      continue;
    }

    const variant = bug?.variant;
    if (
      variant === "low" ||
      variant === "medium" ||
      variant === "high" ||
      variant === "urgent"
    ) {
      counts[variant as BugVariant] += 1;
    }
  }

  return counts;
}

export function getLocalSiegeZones(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  boundsRef: MutableRefObject<CanvasBounds>,
  siegeZonesRef: MutableRefObject<SiegeZoneRect[]>,
) {
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
}

export function applySurvivalSpawnPlan({
  getLocalZones,
  interactiveMode,
  onLiveBugCountChange,
  sessionKey,
  spawnPlan,
  swarm,
  lastAppliedSpawnPlanRef,
}: {
  getLocalZones: () => Array<{
    height: number;
    left: number;
    top: number;
    width: number;
  }>;
  interactiveMode: boolean;
  onLiveBugCountChange?: (
    count: number,
    bugCounts?: BugCounts,
    sourceSessionKey?: string | null,
  ) => void;
  sessionKey: string | null;
  spawnPlan: (SurvivalSpawnPlan & { sequenceId: number }) | null;
  swarm: any | null;
  lastAppliedSpawnPlanRef: MutableRefObject<number>;
}) {
  if (
    !interactiveMode ||
    !spawnPlan ||
    !swarm ||
    spawnPlan.sequenceId <= lastAppliedSpawnPlanRef.current
  ) {
    return;
  }

  lastAppliedSpawnPlanRef.current = spawnPlan.sequenceId;
  swarm.spawnBurst?.(spawnPlan.counts as any, getLocalZones());
  const activeBugs = swarm.getAllBugs?.() as Array<any>;
  onLiveBugCountChange?.(
    getActiveBugCount(activeBugs),
    getActiveBugCounts(activeBugs),
    sessionKey,
  );
}

export function clearInteractiveSwarm({
  boundsRef,
  clearSwarmRequestId,
  interactiveMode,
  latestBugPositionsRef,
  lastReportedLiveBugCountRef,
  lastReportedLiveBugCountsKeyRef,
  onLiveBugCountChange,
  sessionKey,
  swarm,
}: {
  boundsRef: MutableRefObject<CanvasBounds>;
  clearSwarmRequestId: number;
  interactiveMode: boolean;
  latestBugPositionsRef: MutableRefObject<RenderedBugPosition[]>;
  lastReportedLiveBugCountRef: MutableRefObject<number | null>;
  lastReportedLiveBugCountsKeyRef: MutableRefObject<string | null>;
  onLiveBugCountChange?: (
    count: number,
    bugCounts?: BugCounts,
    sourceSessionKey?: string | null,
  ) => void;
  sessionKey: string | null;
  swarm: ({ clearAllBugs?: () => number } & object) | null;
}) {
  if (!interactiveMode || clearSwarmRequestId === 0) {
    return;
  }

  if (!swarm?.clearAllBugs) {
    return;
  }

  swarm.clearAllBugs();
  latestBugPositionsRef.current = [];
  lastReportedLiveBugCountRef.current = 0;
  lastReportedLiveBugCountsKeyRef.current = getBugCountsKey(createEmptyBugCounts());
  onLiveBugCountChange?.(0, createEmptyBugCounts(), sessionKey);
  if (isQaSessionEnabled()) {
    updateQaBugPositions([], boundsRef.current);
  }
}