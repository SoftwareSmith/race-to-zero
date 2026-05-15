import type { Engine } from "@game/engine/Engine";
import type { BugVariant } from "../../../../types/dashboard";

export interface BugTransitionSnapshotItem {
  cruiseSpeed?: number;
  fleeTimer?: number | null;
  hasEnteredField?: boolean;
  heading: number;
  hp: number;
  maxHp: number;
  motionTime?: number;
  movementMood?: "patrol" | "startled";
  nextRoamTargetDelayMs?: number;
  opacity: number;
  prevX?: number;
  prevY?: number;
  roamTargetGeneration?: number;
  roamTargetLongPath?: boolean;
  roamTargetWide?: boolean;
  roamTargetX?: number | null;
  roamTargetY?: number | null;
  seed?: number;
  size: number;
  state?: "patrol" | "flee";
  turnRate?: number;
  variant: BugVariant;
  vx: number;
  vy: number;
  wanderAngle?: number;
  x: number;
  y: number;
}

export interface BackgroundFieldHandle {
  captureTransitionSnapshot: () => BugTransitionSnapshotItem[];
  detachTransitionSwarm: () => Engine | null;
}

export interface BugHitPayload {
  credited?: boolean;
  defeated: boolean;
  remainingHp: number;
  variant: BugVariant;
  x: number;
  y: number;
  pointValue?: number;
  frozen?: boolean;
  comboEvents?: Array<"detonate" | "quench">;
}

export interface RenderedBugCopyPosition {
  copyIndex: number;
  isWrappedCopy: boolean;
  x: number;
  y: number;
}

export interface RenderedBugPosition {
  index: number;
  radius: number;
  renderedCopies?: RenderedBugCopyPosition[];
  x: number;
  y: number;
}

export interface QaBugTelemetryItem {
  crowdCount: number;
  crowdScore: number;
  heading: number;
  index: number;
  movementMood: string | null;
  neighborCount: number;
  radius: number;
  separationScale: number;
  targetX: number | null;
  targetY: number | null;
  variant: BugVariant;
  vx: number;
  vy: number;
  x: number;
  y: number;
}

export interface GameState {
  remainingTargets: number;
  sessionKey: string;
  splats: Array<{ id: string; variant: BugVariant; x: number; y: number }>;
}

export interface QaPerformanceMetrics {
  breakdown?: Partial<Record<QaDurationMetricKey, QaDurationMetric>>;
  firstBugPositionsAtMs?: number;
  firstFrameAtMs?: number;
  frameDurationsMs?: number[];
  heapPeakBytes?: number;
  heapUsedBytes?: number;
  lastFrameDurationMs?: number;
  lastRenderedBugCount?: number;
  longTaskCount?: number;
  longTaskDurationsMs?: number[];
  longTaskTotalMs?: number;
  maxFrameDurationMs?: number;
  maxRenderedBugCount?: number;
  measurementStartAtMs?: number;
  sampleLimit?: number;
}

export type QaDurationMetricKey =
  | "drawMs"
  | "engineEntityMs"
  | "engineEvolutionMs"
  | "engineGridMs"
  | "engineUpdateMs"
  | "vfxMs";

export interface QaDurationMetric {
  lastMs?: number;
  maxMs?: number;
  sampleCount?: number;
  samplesMs?: number[];
  totalMs?: number;
}

export interface QaWindowState {
  bugTelemetry?: QaBugTelemetryItem[];
  enabled?: boolean;
  bugPositions?: Array<{
    canonicalX?: number;
    canonicalY?: number;
    copyIndex?: number;
    index: number;
    isWrappedCopy?: boolean;
    x: number;
    y: number;
    radius: number;
  }>;
  clearLiveBugs?: () => number;
  getLiveBugCount?: () => number;
  getLiveBugTelemetry?: () => QaBugTelemetryItem[];
  lastHit?: {
    defeated: boolean;
    remainingHp: number;
    variant: BugVariant;
    x: number;
    y: number;
  };
  performanceMetrics?: QaPerformanceMetrics;
  repositionLiveBug?: (request: {
    heading?: number;
    index: number;
    vx?: number;
    vy?: number;
    x: number;
    y: number;
  }) => boolean;
  stabilizeEngine?: boolean;
}
