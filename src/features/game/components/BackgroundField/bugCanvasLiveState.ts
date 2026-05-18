import { isTerminalEntityState, type SiegeZoneRect } from "@game/types";
import type { SurvivalSpawnPlan } from "@game/sim/survivalDirector";
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
  onLiveBugCountChange?: (count: number) => void;
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
  onLiveBugCountChange?.(getActiveBugCount(swarm.getAllBugs?.() as Array<any>));
}

export function clearInteractiveSwarm({
  boundsRef,
  clearSwarmRequestId,
  interactiveMode,
  latestBugPositionsRef,
  lastReportedLiveBugCountRef,
  onLiveBugCountChange,
  swarm,
}: {
  boundsRef: MutableRefObject<CanvasBounds>;
  clearSwarmRequestId: number;
  interactiveMode: boolean;
  latestBugPositionsRef: MutableRefObject<RenderedBugPosition[]>;
  lastReportedLiveBugCountRef: MutableRefObject<number | null>;
  onLiveBugCountChange?: (count: number) => void;
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
  onLiveBugCountChange?.(0);
  if (isQaSessionEnabled()) {
    updateQaBugPositions([], boundsRef.current);
  }
}