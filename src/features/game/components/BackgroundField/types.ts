import type { BugVariant } from "../../../../types/dashboard";

export interface BugTransitionSnapshotItem {
  heading: number;
  hp: number;
  maxHp: number;
  opacity: number;
  size: number;
  variant: BugVariant;
  vx: number;
  vy: number;
  x: number;
  y: number;
}

export interface BackgroundFieldHandle {
  captureTransitionSnapshot: () => BugTransitionSnapshotItem[];
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

export interface RenderedBugPosition {
  index: number;
  radius: number;
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
  enabled?: boolean;
  bugPositions?: Array<{ index: number; x: number; y: number; radius: number }>;
  clearLiveBugs?: () => number;
  getLiveBugCount?: () => number;
  lastHit?: {
    defeated: boolean;
    remainingHp: number;
    variant: BugVariant;
    x: number;
    y: number;
  };
  performanceMetrics?: QaPerformanceMetrics;
  stabilizeEngine?: boolean;
}
